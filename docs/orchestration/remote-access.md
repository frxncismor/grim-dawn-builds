# Acceso remoto al Herdr de este PC (SSH)

**Objetivo (T-148)**: conectar al Herdr de este equipo (`mamalona`) desde otra
computadora y desde la app móvil, usando el mismo canal SSH que usa
`hc machine add`. No se abre un puerto nuevo ni se expone el 22 a Internet.

## Estado comprobado (2026-11-11)

- `hc server status`: core `mamalona` vivo, 1 terminal, versión 0.1.20.
- `sshd` existe (`C:\Windows\System32\OpenSSH\sshd.exe`) pero está **detenido**,
  en `Manual`, y **falta** `C:\ProgramData\ssh\sshd_config` y no hay claves de
  host: el servidor no puede aceptar conexiones todavía.
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
