#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const passthroughArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== '--runInBand' && arg !== '-i');

if (process.argv.some((arg) => arg === '--runInBand' || arg === '-i')) {
  console.log('[tests] Ignoring unsupported --runInBand flag for Vitest');
}

const require = createRequire(import.meta.url);

function resolveVitestBinary() {
  const candidatePaths = ['vitest/vitest.mjs', 'vitest/bin/vitest.mjs'];
  for (const candidate of candidatePaths) {
    try {
      return require.resolve(candidate);
    } catch (error) {
      // continue trying other candidates
    }
  }
  throw new Error('Unable to locate Vitest executable entrypoint.');
}

const vitestBin = resolveVitestBinary();

const result = spawnSync(process.execPath, [vitestBin, 'run', ...passthroughArgs], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
