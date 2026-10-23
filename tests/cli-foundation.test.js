import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs } from '../src/core/args.js';
import { isFakeIp } from '../src/modules/network.js';
import { classifyAuthPage } from '../src/modules/auth.js';
import { runCli } from './helpers.js';

test('parseArgs handles numbers, lists, booleans, inline values and positionals', () => {
  const { options, positionals } = parseArgs(
    ['奖学金', '--limit', '5', '--source=www', '--source', 'aao', '--all', '--dry-run'],
    {
      limit: { type: 'number', default: 20 },
      source: { type: 'list' },
      all: { type: 'boolean' },
      dryRun: { type: 'boolean' }
    }
  );
  assert.deepEqual(positionals, ['奖学金']);
  assert.equal(options.limit, 5);
  assert.deepEqual(options.source, ['www', 'aao']);
  assert.equal(options.all, true);
  assert.equal(options.dryRun, true);
});

test('parseArgs rejects unknown options and bad numbers', () => {
  assert.throws(() => parseArgs(['--nope'], {}), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseArgs(['--limit', 'x'], { limit: { type: 'number' } }), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseArgs(['--fmt', 'x'], { fmt: { type: 'string', choices: ['a'] } }), { code: 'INVALID_ARGUMENT' });
});

test('help lists commands as JSON', () => {
  const result = runCli(['help']);
  assert.equal(result.status, 0);
  assert.equal(result.json.ok, true);
  assert.ok(result.json.data.commands.some((command) => command.name === 'auth login'));
});

test('command --help describes options', () => {
  const result = runCli(['network', 'check', '--help']);
  assert.equal(result.json.data.name, 'network check');
  assert.ok(result.json.data.options.some((option) => option.flag === '--timeout'));
});

test('unknown command returns UNKNOWN_COMMAND with exit code 2', () => {
  const result = runCli(['nope', 'cmd']);
  assert.equal(result.status, 2);
  assert.equal(result.json.error.code, 'UNKNOWN_COMMAND');
});

test('unknown option returns INVALID_ARGUMENT', () => {
  const result = runCli(['auth', 'status', '--bogus']);
  assert.equal(result.status, 2);
  assert.equal(result.json.error.code, 'INVALID_ARGUMENT');
});

test('--format table renders human text', () => {
  const result = runCli(['help', '--format', 'table']);
  assert.match(result.stdout, /auth login/);
  assert.equal(result.json, null);
});

test('auth status reports missing profile with a login hint', () => {
  const result = runCli(['auth', 'status']);
  assert.equal(result.json.data.loggedIn, false);
  assert.match(result.json.data.hint, /auth login/);
});

test('auth login then status in mock backend', () => {
  const login = runCli(['auth', 'login']);
  assert.equal(login.json.data.authenticated, true);
  const status = runCli(['auth', 'status'], { NJAU_CLI_HOME: login.home });
  assert.equal(status.json.data.loggedIn, true);
  const logout = runCli(['auth', 'logout'], { NJAU_CLI_HOME: login.home });
  assert.equal(logout.json.data.profileExisted, true);
});

test('classifyAuthPage recognises CAS and portal pages', () => {
  assert.equal(classifyAuthPage({ url: 'https://authserver.njau.edu.cn/authserver/login?service=x', title: '统一身份认证平台' }).loggedIn, false);
  assert.equal(classifyAuthPage({ url: 'https://myportal.njau.edu.cn/new/index.html', title: '南京农业大学网上办事大厅', text: '我的服务\n退出' }).loggedIn, true);
  assert.equal(classifyAuthPage({ url: 'https://szjw.njau.edu.cn/xsd/', title: '数智教务' }).loggedIn, true);
});

test('isFakeIp recognises Clash fake-ip ranges', () => {
  assert.equal(isFakeIp('198.18.1.8'), true);
  assert.equal(isFakeIp('202.195.240.1'), false);
});
