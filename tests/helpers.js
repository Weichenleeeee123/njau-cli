import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

export function runCli(args, env = {}, input) {
  const home = env.NJAU_CLI_HOME ?? mkdtempSync(join(tmpdir(), 'njau-cli-test-'));
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      NJAU_CLI_HOME: home,
      NJAU_BROWSER: 'chromium',
      NJAU_BROWSER_BACKEND: 'mock',
      ...env
    }
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // Some tests check non-JSON output.
  }
  return { ...result, json, home };
}

export function fixture(name) {
  return join(FIXTURES, name);
}
