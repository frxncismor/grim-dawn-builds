# Acceso remoto al Herdr de este PC (SSH)

**Objetivo (T-148)**: conectar al Herdr de este equipo (`mamalona`) desde otra
computadora y desde la app móvil, usando el mismo canal SSH que usa
`hc machine add`. No se abre un puerto nuevo ni se expone el 22 a Internet.

## Estado comprobado (2026-11-11)

- `hc server status`: core `mamalona` vivo, 1 terminal, versión 0.1.20.
- **`sshd` en marcha** (`Running`, `Automatic`) y escuchando en `0.0.0.0:22` y
  `[::]:22`. `Test-NetConnection 192.168.100.35 -Port 22` responde `True`.
- Autenticación por clave verificada:
  `ssh paco_@192.168.100.35 "echo hc-remote-ok"` devuelve `hc-remote-ok`.
  `hc machine add paco_@127.0.0.1` responde «este core», lo que confirma que el
  handshake de `hc` por SSH funciona; falta emparejar la laptop y el móvil.
- Clave `herdr-mobile` (ED25519, `SHA256:lxCHn2q1vkPjUiwBsjbnrzGdr8rtSE/wHFnQuZPYXCA`)
  autorizada en `administrators_authorized_keys` y en el archivo del usuario.
- El usuario `paco_` está en **Administradores** y tiene contraseña.
  `%USERPROFILE%\.ssh\authorized_keys` ya contiene su clave `id_ed25519.pub`.
- IPv4 de LAN: **192.168.100.35** (Ethernet, perfil Público).
- Firewall: regla `OpenSSH Server` habilitada, TCP 22, perfiles
  `Domain, Private, Public`.
- Sin Tailscale. NordVPN está instalado pero su servicio está detenido.

## Paso 1 — preparar este PC (PowerShell elevada)

En una terminal **como administrador**, desde la raíz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1
```

El script instala/repara OpenSSH Server, crea `sshd_config` desde la plantilla de
Windows si falta, genera las claves de host, arranca `sshd` al inicio, asegura
la regla de firewall y autoriza las claves públicas indicadas. Para autorizar la
clave de la laptop o del móvil, pásalas como rutas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1 `
  -PublicKeyPath "$env:USERPROFILE\.ssh\id_ed25519.pub", "C:\keys\laptop.pub"
```

Si el servicio sigue en **1067** con `sshd_config` y claves ya creadas, en la
misma consola elevada:

```powershell
& C:\Windows\System32\OpenSSH\sshd.exe -d
```

Ese comando muestra el error real. El script ya restringe DACL y propietario de
las claves de host y de `sshd_config`; en este equipo fue suficiente para
dejarlo en `Running`. Si en otro equipo persiste, reinstala la capacidad y
repite el script:

```powershell
Remove-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

Verificación local:

```powershell
Get-Service sshd
Get-NetTCPConnection -LocalPort 22 -State Listen
```

`sshd` debe estar `Running` y el puerto 22 escuchando en `0.0.0.0`/`::`.

## Paso 2 — desde la otra computadora

1. Genera o reutiliza su clave y autorízala en el PC (paso 1 con
   `-PublicKeyPath ...laptop.pub`). Si prefieres empezar con contraseña, omite
   este punto: `sshd_config` la permite por defecto.
2. Comprueba el acceso:

   ```sh
   ssh paco_@192.168.100.35
   ```

3. Añade el PC como máquina de Herdr desde esa computadora:

   ```sh
   hc machine add paco_@192.168.100.35 --name mamalona --install
   hc machine login mamalona    # solo si pide contraseña, código o aceptar host key
   ```

   `--install` copia el `hc` de esa computadora si en el PC faltara o fuera
   antiguo; en este PC ya hay core 0.1.20.

4. Abre la app de Herdr en la otra computadora: **Settings > Machines** debe
   listar `mamalona` (la app añade hosts de `~/.ssh/config` o los que ya conoce
   `hc`). Los espacios remotos aparecen con prefijo `mamalona/`; los nuevos se
   crean con `space.new --machine mamalona`.

## Cuenta Microsoft y contraseña

`paco_` es una cuenta **MicrosoftAccount**. SSH **no acepta el PIN de Windows**:
la autenticación por contraseña usa la contraseña online de la cuenta. Si no la
recuerdas, o la cuenta es passwordless, hay dos salidas:

- **Clave (recomendado)**: autoriza la clave pública del dispositivo y elige esa
  identidad en la app. El móvil ya tiene `herdr-mobile` autorizada.
- **Restablecer la contraseña**: en `account.microsoft.com` (Seguridad) o en
  **Configuración > Cuentas > Opciones de inicio de sesión > Contraseña**. Tras
  cambiarla, bloquea/desbloquea la sesión del PC y reintenta.

Si la app pide una contraseña y no ofrece elegir clave, está usando
autenticación por contraseña: necesita la contraseña de la cuenta Microsoft, no
el PIN.

## Paso 3 — app móvil

La app móvil necesita lo mismo: host, usuario, puerto 22 y autenticación.

- **Misma Wi-Fi**: host `192.168.100.35`, usuario `paco_`, puerto `22`.
- **Fuera de casa**: no publiques el 22. Usa una VPN de malla:
  - **NordVPN Meshnet** (ya instalado en el PC): activa Meshnet en el PC y en el
    móvil, y usa la IPv4 de malla del PC (`100.x.x.x`) como host.
  - **Tailscale** como alternativa: instala en PC y móvil y usa el nombre
    MagicDNS o la IP `100.x`.
- **Autenticación**: si la app permite importar una clave OpenSSH, genera una
  clave en el móvil y autoriza su `.pub` en el PC (paso 1). Si solo admite
  contraseña, usa la del usuario `paco_`; el host key se acepta la primera vez.
- Si la app pide un "machine"/"host" de Herdr, es el mismo destino:
  `paco_@192.168.100.35` (o la IP de la VPN).

## Verificación de extremo a extremo

En el PC:

```powershell
Get-Service sshd
hc server status
```

En la otra computadora o el móvil:

```sh
ssh paco_@192.168.100.35 "hc --version"
hc machine ls
```

`hc machine ls` debe mostrar `mamalona` en estado alcanzable. En la app, abre un
espacio de esa máquina y comprueba que `herdr-app ls` lo muestra.

## Problemas conocidos

| Síntoma | Causa probable | Corrección |
| --- | --- | --- |
| `Connection refused` | `sshd` detenido o sin configuración | Paso 1; `Get-Service sshd` |
| El servicio termina con **1067** y no hay `sshd.log` | Configuración/claves rechazadas o capacidad dañada | `& C:\Windows\System32\OpenSSH\sshd.exe -d` en consola elevada para ver el error; si persiste, `Remove-WindowsCapability` + `Add-WindowsCapability` de `OpenSSH.Server~~~~0.0.1.0` y repetir el paso 1 |
| `Permission denied (publickey)` | Clave no autorizada o ACL incorrecta | Repite el paso 1; el script escribe `administrators_authorized_keys` y su ACL |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | El PC cambió de IP o se reinstaló | Borra la entrada en `known_hosts` del cliente y acepta la nueva |
| La app móvil no ve la máquina | Móvil en otra red o firewall | Misma Wi-Fi o VPN; regla TCP 22 habilitada |
| La IP cambia | DHCP | Reserva la IP en el router o usa la IP de Meshnet/Tailscale |
| `hc: command not found` en el otro equipo | Herdr no está instalado allí | Instala Herdr o usa `hc machine add ... --install` desde una copia local de `hc` |

## Seguridad

- Prefiere **solo claves** (`PasswordAuthentication no`) cuando todas las
  dispositivos tengan clave; el script no cambia esa opción para no dejarte
  fuera a mitad de la configuración.
- No abras el puerto 22 en el router. Para acceso fuera de la LAN, VPN de malla.
- Revisa `C:\ProgramData\ssh\administrators_authorized_keys` y
  `%USERPROFILE%\.ssh\authorized_keys`; retira claves que ya no uses.
