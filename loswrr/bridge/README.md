# LOSWRR Desktop Bridge

The Desktop Bridge is a small local companion that the LOSWRR web app
can talk to over HTTP to perform real computer control. The web app
works without it; the bridge is **opt-in** for advanced capabilities.

The bridge is intended to run on the same machine as the user's
browser (e.g. on Chromebook inside the Linux environment, on a desktop,
or on a server in the user's network).

## Why

A browser cannot, by design:

- Run shell commands on the host OS
- Read or write arbitrary files
- Take screenshots
- Drive the native browser
- Send desktop notifications

The Bridge fills that gap, with explicit, audited permissions.

## Architecture

```
  ┌──────────────────────┐         ┌──────────────────────────┐
  │ LOSWRR Web App (PWA) │  HTTP   │ LOSWRR Desktop Bridge    │
  │  (Chrome on any OS)  │ ──────► │ (Node or Go on the host) │
  └──────────────────────┘  JSON   └────────────┬─────────────┘
                                                │
                                  Local FS / shell / screen / browser
```

The web app sends a JSON `{ action, payload }` to `POST /action` on the
bridge. The bridge classifies the action (SAFE / REQUIRES_APPROVAL /
BLOCKED) and runs it (or refuses it, or prompts the user, depending on
classification and config).

## Action surface

| Action | Class | Description |
|---|---|---|
| `read_file` | SAFE | Read a file inside an approved folder |
| `list_dir` | SAFE | List a directory |
| `get_info` | SAFE | System / host info |
| `screenshot` | SAFE | Capture the primary display |
| `read_clipboard` | SAFE | Read text from the clipboard |
| `write_clipboard` | SAFE | Write text to the clipboard |
| `notify` | SAFE | Send a desktop notification |
| `write_file` | REQUIRES_APPROVAL | Create or modify a file |
| `move_file` | REQUIRES_APPROVAL | Move a file |
| `copy_file` | REQUIRES_APPROVAL | Copy a file |
| `create_folder` | REQUIRES_APPROVAL | Create a folder |
| `run_command` | REQUIRES_APPROVAL | Run a shell command |
| `browser_open` | REQUIRES_APPROVAL | Open a URL in the OS browser |
| `browser_click` | REQUIRES_APPROVAL | Click an element (with bridge-driven browser) |
| `browser_fill` | REQUIRES_APPROVAL | Fill an input |
| `browser_submit` | REQUIRES_APPROVAL | Submit a form |
| `delete_file` | **BLOCKED** | Never auto-allowed |

## Permissions model

The web app stores the bridge's permission grants in `localStorage`.
The bridge itself is responsible for **enforcing** permissions
server-side — never trust the client. The web app surfaces the grants
in the Computer view for transparency.

## Reference implementation (Node.js)

A minimal reference bridge in Node.js is provided in
`bridge/reference-bridge.mjs`. It implements the action surface above
on Linux / macOS / Windows. It is **not** a finished product — it is a
starting point you can extend.

Run it:

```bash
cd loswrr/bridge
node reference-bridge.mjs
# Bridge listening on http://127.0.0.1:7878
```

Then in the LOSWRR web app Settings → Computer, set the endpoint to
`http://127.0.0.1:7878` and click Connect.

## Security

- Bind only to `127.0.0.1` (or a LAN IP you control) — never `0.0.0.0`
  on a public network.
- The bridge should authenticate the web app with a shared token. The
  reference implementation reads `LOSWRR_BRIDGE_TOKEN` from the
  environment and checks the `Authorization: Bearer <token>` header.
- The bridge should refuse to operate outside `approvedFolders`.
- All actions are logged in an append-only audit log.
- `delete_file` is **never** exposed in the reference bridge.

## Linux / ChromeOS

The bridge can be run inside the ChromeOS Linux (Crostini) container,
which gives it access to the user's Linux home directory. The web app
running in Chrome can then reach it at
`http://127.0.0.1:7878` (Crostini forwards the loopback port).

## Windows / macOS

Run the bridge as a normal user process. Bind to `127.0.0.1`. The web
app reaches it on the same machine.

## Production

For production use, replace the reference implementation with a proper
service that:

- Authenticates with a per-device token.
- Logs every action.
- Limits CPU / memory of `run_command` to prevent runaway processes.
- Uses OS-level sandboxing (e.g. systemd unit with `ProtectSystem=strict`,
  `PrivateTmp=true`, `NoNewPrivileges=true` on Linux).

The contract between the web app and the bridge is small and stable —
the implementation can be hardened without changing the UI.
