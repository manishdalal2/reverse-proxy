#!/usr/bin/env node

import net from 'net';
import * as os from 'os';

const DEFAULT_FRONTEND_PORT = 5015;
const DEFAULT_LOCAL_PREFIX = '192.';
const DEFAULT_RESPONSE_DELAY_MS = 0;

const PORT_FIELDS = ['frontendPort', 'backendPort'] as const;
const NUMERIC_FIELDS = ['frontendPort', 'backendPort', 'responseDelayMs'] as const;
type PortField = (typeof PORT_FIELDS)[number];
type NumericField = (typeof NUMERIC_FIELDS)[number];

function isPortField(field: keyof ProxyConfig): field is PortField {
    return (PORT_FIELDS as readonly string[]).includes(field);
}

function isNumericField(field: keyof ProxyConfig): field is NumericField {
    return (NUMERIC_FIELDS as readonly string[]).includes(field);
}
const FLAG_TO_FIELD: Record<string, keyof ProxyConfig> = {
    '--frontend-port': 'frontendPort',
    '-F': 'frontendPort',
    '--backend-port': 'backendPort',
    '-P': 'backendPort',
    '--backend-host': 'backendHost',
    '-H': 'backendHost',
    '--listen-host': 'listenHost',
    '-L': 'listenHost',
    '--local-ip-prefix': 'localNetworkPrefix',
    '-X': 'localNetworkPrefix',
    '--response-delay': 'responseDelayMs',
    '-D': 'responseDelayMs',
};

export interface ProxyConfig {
    frontendPort: number;
    backendHost: string;
    backendPort: number;
    listenHost?: string;
    localNetworkPrefix?: string;
    responseDelayMs?: number;
}

function getLocalIPAddress(prefix: string = DEFAULT_LOCAL_PREFIX): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith(prefix)) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function getTimestamp(): string {
    return new Date().toISOString();
}

function parsePort(value: string | undefined, fallback: number, label: string): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid ${label} value: ${value}`);
    }

    return parsed;
}

function assertValidPort(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0 || value > 65535) {
        throw new Error(`Invalid ${label} value: ${value}`);
    }
}

function assignOptionValue(target: Partial<ProxyConfig>, field: keyof ProxyConfig, rawValue: string): void {
    if (isPortField(field)) {
        const parsed = Number(rawValue);
        assertValidPort(parsed, field);
        target[field] = parsed as ProxyConfig[typeof field];
        return;
    }

    if (field === 'responseDelayMs') {
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
            throw new Error(`Invalid responseDelayMs value: ${rawValue}`);
        }
        target[field] = parsed as ProxyConfig[typeof field];
        return;
    }

    target[field] = rawValue as ProxyConfig[typeof field];
}

function printCliHelp(): void {
    console.log(`layer4-reverse-proxy usage:

layer4-reverse-proxy [options]

Options (CLI flags override environment variables):
  -H, --backend-host <host>       Target host/IP to forward traffic to (required)
  -P, --backend-port <port>       Target port on the backend host (default: FRONTEND_PORT)
  -F, --frontend-port <port>      Local listening port (default: ${DEFAULT_FRONTEND_PORT})
  -L, --listen-host <host>        Host/IP to bind the listener (default: auto-detect local IPv4)
  -X, --local-ip-prefix <prefix>  Prefix used for auto-detecting the local IPv4 (default: ${DEFAULT_LOCAL_PREFIX})
  -D, --response-delay <ms>       Delay response to client by milliseconds (default: ${DEFAULT_RESPONSE_DELAY_MS})
  -h, --help                      Show this message

Environment variables:
  BACKEND_HOST, BACKEND_PORT, FRONTEND_PORT, LISTEN_HOST, LOCAL_IP_PREFIX, RESPONSE_DELAY_MS
`);
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): Partial<ProxyConfig> {
    const options: Partial<ProxyConfig> = {};

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];

        if (token === '--help' || token === '-h') {
            printCliHelp();
            process.exit(0);
        }

        const [flag, inlineValue] = token.split('=');
        const field = FLAG_TO_FIELD[flag];

        if (!field) {
            throw new Error(`Unknown CLI option: ${flag}`);
        }

        const value = inlineValue ?? argv[++i];
        if (value === undefined) {
            throw new Error(`Missing value for option: ${flag}`);
        }

        assignOptionValue(options, field, value);
    }

    return options;
}

export function loadConfigFromEnv(overrides: Partial<ProxyConfig> = {}): ProxyConfig {
    if (overrides.frontendPort !== undefined) {
        assertValidPort(overrides.frontendPort, 'frontendPort');
    }
    if (overrides.backendPort !== undefined) {
        assertValidPort(overrides.backendPort, 'backendPort');
    }
    if (overrides.responseDelayMs !== undefined && (overrides.responseDelayMs < 0 || !Number.isInteger(overrides.responseDelayMs))) {
        throw new Error('Invalid responseDelayMs value');
    }

    const frontendPort = overrides.frontendPort ?? parsePort(process.env.FRONTEND_PORT, DEFAULT_FRONTEND_PORT, 'FRONTEND_PORT');
    const backendHost = overrides.backendHost ?? process.env.BACKEND_HOST;

    if (!backendHost) {
        throw new Error('BACKEND_HOST is required via CLI option or environment variable.');
    }

    const backendPort = overrides.backendPort ?? parsePort(process.env.BACKEND_PORT, frontendPort, 'BACKEND_PORT');
    const responseDelayMs = overrides.responseDelayMs ?? parsePort(process.env.RESPONSE_DELAY_MS, DEFAULT_RESPONSE_DELAY_MS, 'RESPONSE_DELAY_MS');
    return {
        frontendPort,
        backendHost,
        backendPort,
        listenHost: overrides.listenHost ?? process.env.LISTEN_HOST,
        localNetworkPrefix: overrides.localNetworkPrefix ?? process.env.LOCAL_IP_PREFIX ?? DEFAULT_LOCAL_PREFIX,
        responseDelayMs,
    };
}

export function startProxy(config: ProxyConfig): net.Server {
    const {
        frontendPort,
        backendHost,
        backendPort,
        listenHost,
        localNetworkPrefix = DEFAULT_LOCAL_PREFIX,
        responseDelayMs = DEFAULT_RESPONSE_DELAY_MS,
    } = config;

    const host = listenHost ?? getLocalIPAddress(localNetworkPrefix);
    let requestCounter = 0;

    const server = net.createServer((clientSocket: net.Socket) => {
        console.log(`New connection from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

        const backendSocket = net.createConnection(backendPort, backendHost, () => {
            console.log(`Forwarding connection to ${backendHost}:${backendPort}`);
        });

        clientSocket.on('end', () => {
            backendSocket.end();
            console.log(`[${getTimestamp()}] Client disconnected`);
        });

        clientSocket.on('data', (data) => {
            console.log(`[${getTimestamp()}] Data from client: ${data}`);
            backendSocket.write(data);
        });

        backendSocket.on('data', (data) => {
            console.log(`[${getTimestamp()}] Data from backend: ${data}`);

            if (responseDelayMs > 0) {
                setTimeout(() => {
                    clientSocket.write(data);
                    console.log(`[${getTimestamp()}] Data sent to client after ${responseDelayMs}ms delay: ${data}`);
                }, responseDelayMs);
            } else {
               
                clientSocket.write(data);
                console.log(`[${getTimestamp()}] Data sent to client without delay: ${data}`);
            }

            requestCounter++;
            console.log(`[${getTimestamp()}] requestCounter: ${requestCounter}`);
        });

        backendSocket.on('error', (err: Error) => {
            console.error(`[${getTimestamp()}] Backend connection error: ${err.message}`);
            clientSocket.destroy();
        });

        clientSocket.on('error', (err: Error) => {
            console.error(`[${getTimestamp()}] Client connection error: ${err.message}`);
            backendSocket.destroy();
        });
    });

    server.listen(frontendPort, host, () => {
        console.log(
            `[${getTimestamp()}] L4 reverse proxy running on ${host}:${frontendPort}, forwarding to ${backendHost}:${backendPort}`,
        );
    });

    return server;
}

if (require.main === module) {
    const cliOptions = parseCliArgs();
    const config = loadConfigFromEnv(cliOptions);
    startProxy(config);
}
