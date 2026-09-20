import {existsSync} from 'node:fs';

if (existsSync('.env.deploy.local')) process.loadEnvFile('.env.deploy.local');
