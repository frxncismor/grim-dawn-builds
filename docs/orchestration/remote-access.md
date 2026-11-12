# Remote access to this PC's Herdr (SSH)

**English** · [Español](remote-access.es.md)

**Goal (T-148)**: connect to this machine's Herdr (`mamalona`) from another
computer and from the mobile app, using the same SSH channel that
`hc machine add` uses. No new port is opened and port 22 is not exposed to the
Internet.

## Verified state (2026-11-11)

- `hc server status`: core `mamalona` alive, 1 terminal, version 0.1.20.
- **`sshd` running** (`Running`, `Automatic`) and listening on `0.0.0.0:22` and
  `[::]:22`. `Test-NetConnection 192.168.100.35 -Port 22` responds `True`.
- Key authentication verified:
  `ssh paco_@192.168.100.35 "echo hc-remote-ok"` returns `hc-remote-ok`.
  `hc machine add paco_@127.0.0.1` answers «este core», which confirms that the
  `hc` handshake over SSH works; pairing the laptop and the phone is still
  pending.
- `herdr-mobile` key (ED25519, `SHA256:lxCHn2q1vkPjUiwBsjbnrzGdr8rtSE/wHFnQuZPYXCA`)
  authorized in `administrators_authorized_keys` and in the user's file.
- The `paco_` account is in **Administrators** and has a password.
  `%USERPROFILE%\.ssh\authorized_keys` already contains its `id_ed25519.pub` key.
- LAN IPv4: **192.168.100.35** (Ethernet, Public profile).
- Firewall: `OpenSSH Server` rule enabled, TCP 22, profiles
  `Domain, Private, Public`.
- No Tailscale. NordVPN is installed but its service is stopped.

## Step 1 — prepare this PC (elevated PowerShell)

In a terminal **as administrator**, from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1
```

The script installs/repairs OpenSSH Server, creates `sshd_config` from the Windows
template if it is missing, generates the host keys, starts `sshd` at boot, ensures
the firewall rule and authorizes the given public keys. To authorize the laptop's
or the phone's key, pass them as paths:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ssh-remote.ps1 `
  -PublicKeyPath "$env:USERPROFILE\.ssh\id_ed25519.pub", "C:\keys\laptop.pub"
```

If the service still ends in **1067** with `sshd_config` and keys already created,
in the same elevated console:

```powershell
& C:\Windows\System32\OpenSSH\sshd.exe -d
```

That command shows the real error. The script already restricts the DACL and the
owner of the host keys and of `sshd_config`; on this machine it was enough to
leave it in `Running`. If it persists on another machine, reinstall the capability
and repeat the script:

```powershell
Remove-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

Local verification:

```powershell
Get-Service sshd
Get-NetTCPConnection -LocalPort 22 -State Listen
```

`sshd` must be `Running` and port 22 listening on `0.0.0.0`/`::`.

## Step 2 — from the other computer

1. Generate or reuse its key and authorize it on the PC (step 1 with
   `-PublicKeyPath ...laptop.pub`). If you prefer to start with a password, skip
   this point: `sshd_config` allows it by default.
2. Check access:

   ```sh
   ssh paco_@192.168.100.35
   ```

3. Add the PC as a Herdr machine from that computer:

   ```sh
   hc machine add paco_@192.168.100.35 --name mamalona --install
   hc machine login mamalona    # solo si pide contraseña, código o aceptar host key
   ```

   `--install` copies that computer's `hc` if the PC lacked it or had an old one;
   this PC already has core 0.1.20.

4. Open the Herdr app on the other computer: **Settings > Machines** must list
   `mamalona` (the app adds hosts from `~/.ssh/config` or the ones `hc` already
   knows). Remote spaces appear with the `mamalona/` prefix; new ones are created
   with `space.new --machine mamalona`.

## Microsoft account and password

`paco_` is a **MicrosoftAccount** account. SSH **does not accept the Windows PIN**:
password authentication uses the account's online password. If you do not
remember it, or the account is passwordless, there are two ways out:

- **Key (recommended)**: authorize the device's public key and choose that
  identity in the app. The phone already has `herdr-mobile` authorized.
- **Reset the password**: at `account.microsoft.com` (Security) or in
  **Settings > Accounts > Sign-in options > Password**. After changing it,
  lock/unlock the PC session and retry.

If the app asks for a password and does not offer to choose a key, it is using
password authentication: it needs the Microsoft account password, not the PIN.

## Step 3 — mobile app

The mobile app needs the same thing: host, user, port 22 and authentication.

- **Same Wi-Fi**: host `192.168.100.35`, user `paco_`, port `22`.
- **Outside the home**: do not publish port 22. Use a mesh VPN:
  - **NordVPN Meshnet** (already installed on the PC): enable Meshnet on the PC
    and on the phone, and use the PC's mesh IPv4 (`100.x.x.x`) as the host.
  - **Tailscale** as an alternative: install it on the PC and the phone and use the
    MagicDNS name or the `100.x` IP.
- **Authentication**: if the app allows importing an OpenSSH key, generate a key
  on the phone and authorize its `.pub` on the PC (step 1). If it only accepts a
  password, use the `paco_` account's; the host key is accepted the first time.
- If the app asks for a Herdr "machine"/"host", it is the same target:
  `paco_@192.168.100.35` (or the VPN IP).

## End-to-end verification

On the PC:

```powershell
Get-Service sshd
hc server status
```

On the other computer or the phone:

```sh
ssh paco_@192.168.100.35 "hc --version"
hc machine ls
```

`hc machine ls` must show `mamalona` as reachable. In the app, open a space from
that machine and check that `herdr-app ls` shows it.

## Known issues

| Symptom | Probable cause | Fix |
| --- | --- | --- |
| `Connection refused` | `sshd` stopped or without configuration | Step 1; `Get-Service sshd` |
| The service ends with **1067** and there is no `sshd.log` | Configuration/keys rejected or damaged capability | `& C:\Windows\System32\OpenSSH\sshd.exe -d` in an elevated console to see the error; if it persists, `Remove-WindowsCapability` + `Add-WindowsCapability` of `OpenSSH.Server~~~~0.0.1.0` and repeat step 1 |
| `Permission denied (publickey)` | Key not authorized or incorrect ACL | Repeat step 1; the script writes `administrators_authorized_keys` and its ACL |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | The PC changed IP or was reinstalled | Delete the entry in the client's `known_hosts` and accept the new one |
| The mobile app cannot see the machine | Phone on another network or firewall | Same Wi-Fi or VPN; TCP 22 rule enabled |
| The IP changes | DHCP | Reserve the IP in the router or use the Meshnet/Tailscale IP |
| `hc: command not found` on the other machine | Herdr is not installed there | Install Herdr or use `hc machine add ... --install` from a local copy of `hc` |

## Security

- Prefer **keys only** (`PasswordAuthentication no`) once every device has a key;
  the script does not change that option so it does not leave the user out in the
  middle of the configuration.
- Do not open port 22 on the router. For access outside the LAN, a mesh VPN.
- Review `C:\ProgramData\ssh\administrators_authorized_keys` and
  `%USERPROFILE%\.ssh\authorized_keys`; remove keys you no longer use.
