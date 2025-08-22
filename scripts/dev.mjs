#!/usr/bin/env node

import { spawn } from 'child_process';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

config({ path: join(rootDir, '.env.local') });

const port = process.env.PORT || 3000;

console.log(`Starting Next.js development server on port ${port}...`);

const nextDev = spawn('next', ['dev', '--turbopack', '-p', port], {
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		PORT: port,
	},
});

nextDev.on('error', error => {
	console.error('Failed to start Next.js dev server:', error);
	process.exit(1);
});

nextDev.on('exit', code => {
	process.exit(code || 0);
});