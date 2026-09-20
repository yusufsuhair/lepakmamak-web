import {existsSync} from 'node:fs';

// Local server configuration is separate from public Vite build variables.
if (existsSync('.env.server.local')) process.loadEnvFile('.env.server.local');
process.env.PORT ??= '8120';
process.env.ALLOW_GUESTS ??= 'true';
await import('../server/index.mjs');
