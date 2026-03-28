# layer4-reverse-proxy

Configurable Layer 4 TCP reverse proxy for tunneling HTTPS/TCP traffic between clients and an upstream target. Ships as both a CLI (`layer4-reverse-proxy`) and a programmatic API so you can embed it into other tooling.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [License](#license)

## Installation

1. npm install

   ```bash
   
   ```

2. Build the package

   ```bash
   npm run build
   ```

## Usage

### CLI

Configuration can be supplied either as CLI flags or environment variables (CLI flags win when both are provided). The CLI always requires a backend host.

Example using only CLI flags:

```bash
layer4-reverse-proxy \
  --backend-host 192.168.131.170 \
  --backend-port 5015 \
  --frontend-port 8443 \
  --listen-host 0.0.0.0
```

Example with response delay:

```bash
BACKEND_HOST=192.168.131.170 \
BACKEND_PORT=5015 \
FRONTEND_PORT=8443 \
RESPONSE_DELAY_MS=3000 \
layer4-reverse-proxy
```

Example development runs with `ts-node`:

```bash
npx ts-node src/app.ts \
  --backend-host 192.168.131.170 \
  --backend-port 5015 \
  --frontend-port 8443 \
  --listen-host 0.0.0.0
```

With response delay:

```bash
npx ts-node src/app.ts \
  --backend-host 192.168.1.123 \
  --backend-port 5015 \
  --response-delay 2000
```

Available CLI flags:

| Flag | Description |
| ---- | ----------- |
| `-H, --backend-host <host>` | Target host/IP to forward traffic to (required) |
| `-P, --backend-port <port>` | Target port on the backend host (default: `FRONTEND_PORT`) |
| `-F, --frontend-port <port>` | Local listening port (default: `5015`) |
| `-L, --listen-host <host>` | Host/IP to bind to (default: auto-detected local IPv4) |
| `-X, --local-ip-prefix <prefix>` | Prefix used when auto-detecting the local IPv4 (default: `192.`) |
| `-D, --response-delay <ms>` | Delay response to client by milliseconds (default: `0`) |
| `-h, --help` | Show inline help and exit |

Available environment variables:

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `BACKEND_HOST` | yes | – | Target host or IP to forward traffic to |
| `BACKEND_PORT` | no | `FRONTEND_PORT` | Target port on the backend host |
| `FRONTEND_PORT` | no | `5015` | Local listening port |
| `LISTEN_HOST` | no | auto-detected local IPv4 | Hostname/IP to bind the listener |
| `LOCAL_IP_PREFIX` | no | `192.` | Prefix used when auto-detecting local IPv4 |
| `RESPONSE_DELAY_MS` | no | `0` | Delay response to client by milliseconds |

### Programmatic API

```ts
import { startProxy } from 'layer4-reverse-proxy';

const server = startProxy({
  frontendPort: 8443,
  backendHost: '192.168.131.170',
  backendPort: 5015,
  responseDelayMs: 2000, // Optional: delay responses by 2 seconds
});

server.on('listening', () => console.log('Proxy ready!'));
```

## Project Structure

```
layer4-reverse-proxy
├── src
│   ├── app.ts
│   └── types
│       └── index.ts
├── dist
├── package.json
├── tsconfig.json
└── README.md
```

## Publishing

To publish the package to npm:

```bash
npm login
npm run build
npm publish --access public
```

## License

This project is licensed under the MIT License.