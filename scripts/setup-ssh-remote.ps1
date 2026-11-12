#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Deja este PC (Windows) listo como host SSH para Herdr.

.DESCRIPTION
  Instala/repara OpenSSH Server, crea sshd_config y las claves de host si
  faltan, arranca sshd al inicio, asegura la regla de firewall del puerto 22 y
  autoriza una o varias claves públicas para el usuario actual.

  Pensado para T-148: la otra computadora y la app móvil se conectan a este
  Herdr por SSH (hc machine add / Settings > Machines). No expone el puerto 22
  a Internet: úsalo en LAN o sobre una VPN (NordVPN Meshnet o Tailscale).

.PARAMETER PublicKeyPath
  Rutas a archivos .pub que se autorizan. Por defecto, la clave pública del
  usuario actual. Repite el parámetro o pásale una lista.

.EXAMPLE
  # En una PowerShell elevada, desde el repo:
  powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1

.EXAMPLE
  # Autorizar además la clave de la laptop y la del móvil:
  powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1 `
    -PublicKeyPath "$env:USERPROFILE\.ssh\id_ed25519.pub", "C:\keys\laptop.pub"
#>
[CmdletBinding()]
param(
  [string[]]$PublicKeyPath = @("$env:USERPROFILE\.ssh\id_ed25519.pub")
)

$ErrorActionPreference = 'Stop'
$sshDir = Join-Path $env:ProgramData 'ssh'
$sshdConfig = Join-Path $sshDir 'sshd_config'
$defaultConfig = Join-Path $env:WINDIR 'System32\OpenSSH\sshd_config_default'
$adminKeys = Join-Path $sshDir 'administrators_authorized_keys'
$userKeys = Join-Path $env:USERPROFILE '.ssh\authorized_keys'

function Write-Step([string]$message) {
  Write-Host "`n== $message" -ForegroundColor Cyan
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$identity).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

if (-not (Test-IsAdmin)) {
  throw 'Ejecuta este script en una PowerShell elevada (Ejecutar como administrador).'
}

Write-Step 'OpenSSH Server (capacidad de Windows)'
$capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0'
if ($capability.State -ne 'Installed') {
  Add-WindowsCapability -Online -Name $capability.Name | Out-Null
  Write-Host 'OpenSSH Server instalado.'
} else {
  Write-Host 'OpenSSH Server ya estaba instalado.'
}

Write-Step 'sshd_config'
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
if (-not (Test-Path $sshdConfig)) {
  if (-not (Test-Path $defaultConfig)) {
    throw "No existe $defaultConfig; repara OpenSSH Server con Windows Update."
  }
  Copy-Item $defaultConfig $sshdConfig
  Write-Host "sshd_config creado desde $defaultConfig."
} else {
  Write-Host 'sshd_config ya existía; se conserva.'
}
$configAcl = Get-Acl $sshdConfig
$configAcl.SetOwner([System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
Set-Acl -Path $sshdConfig -AclObject $configAcl

Write-Step 'Claves de host'
& (Join-Path $env:WINDIR 'System32\OpenSSH\ssh-keygen.exe') -A | Out-Null
# sshd rechaza claves privadas de host con ACE de usuario: la DACL debe contener
# solo SYSTEM y Administradores (sin herencia ni el usuario que ejecutó el script).
$administrators = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$system = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
Get-ChildItem -Path $sshDir -Filter 'ssh_host_*_key' | ForEach-Object {
  $acl = [System.Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  # OpenSSH también es estricto con el propietario: SYSTEM/Administradores.
  $acl.SetOwner($administrators)
  $acl.AddAccessRule(
    [System.Security.AccessControl.FileSystemAccessRule]::new(
      $administrators, 'FullControl', 'Allow'
    )
  )
  $acl.AddAccessRule(
    [System.Security.AccessControl.FileSystemAccessRule]::new($system, 'FullControl', 'Allow')
  )
  Set-Acl -Path $_.FullName -AclObject $acl
}
Write-Host 'Claves de host generadas o ya presentes, con DACL restringida.'

Write-Step 'Servicio sshd'
Set-Service -Name sshd -StartupType Automatic
try {
  if ((Get-Service sshd).Status -ne 'Running') { Start-Service sshd -ErrorAction Stop }
  Write-Host 'sshd en marcha.'
} catch {
  Write-Warning "No se pudo arrancar sshd: $($_.Exception.Message)"
  Write-Warning 'Revisa C:\ProgramData\ssh\logs\sshd.log y el Visor de eventos (System).'
}
Get-Service sshd | Format-Table Name, Status, StartType -AutoSize

Write-Step 'Firewall (TCP 22, todos los perfiles)'
$rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 `
    -Profile Domain, Private, Public | Out-Null
  Write-Host 'Regla de firewall creada.'
} else {
  Enable-NetFirewallRule -Name $rule.Name
  Write-Host 'Regla de firewall ya presente y habilitada.'
}

Write-Step 'Claves públicas autorizadas'
$authorized = @()
foreach ($path in $PublicKeyPath) {
  if (-not (Test-Path $path)) {
    Write-Warning "No se encuentra la clave pública: $path"
    continue
  }
  $key = (Get-Content -Path $path -Raw).Trim()
  if (-not $key) {
    Write-Warning "La clave pública está vacía: $path"
    continue
  }
  $authorized += $key
}
if ($authorized.Count -eq 0) {
  Write-Warning 'No se autorizó ninguna clave pública; se podrá entrar solo con contraseña.'
}

# El usuario actual está en Administradores, así que OpenSSH puede usar
# administrators_authorized_keys (Match Group administrators) o el archivo del
# usuario según cómo resuelva el grupo localizado. Se escriben ambos para no
# depender de esa diferencia.
foreach ($key in $authorized) {
  if (-not (Test-Path $adminKeys) -or -not (Select-String -Path $adminKeys -SimpleMatch $key -Quiet)) {
    Add-Content -Path $adminKeys -Value $key -Encoding ascii
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $userKeys) | Out-Null
  if (-not (Test-Path $userKeys) -or -not (Select-String -Path $userKeys -SimpleMatch $key -Quiet)) {
    Add-Content -Path $userKeys -Value $key -Encoding ascii
  }
}
if (Test-Path $adminKeys) {
  # OpenSSH rechaza el archivo si lo puede escribir cualquiera que no sea admin/SYSTEM.
  icacls $adminKeys /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
}
Write-Host "Claves autorizadas: $($authorized.Count)."

Write-Step 'Direcciones para conectarse'
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
  Select-Object InterfaceAlias, IPAddress |
  Format-Table -AutoSize

Write-Host @"

Listo. Desde la otra computadora o el móvil, apunta a:
  usuario: $env:USERNAME
  puerto:  22
  host:    la IPv4 de arriba (LAN) o la IP de Meshnet/Tailscale si estás fuera.

Comprobación desde el otro equipo:
  ssh $env:USERNAME@<IP>
  hc machine add $env:USERNAME@<IP> --name mamalona --install
  hc machine login mamalona    # solo si pide contraseña, código o host key

En la app de Herdr del otro equipo: Settings > Machines debe listar `mamalona`.
No expongas el puerto 22 a Internet; usa LAN o VPN.
"@
