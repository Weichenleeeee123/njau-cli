import assert from 'node:assert/strict';
import test from 'node:test';

import { writeSzjwFixtures } from './fixtures/szjw-synthetic.js';
import { runCli } from './helpers.js';

const env = { NJAU_MOCK_DIR: writeSzjwFixtures(), NJAU_NOW: '2026-10-23T03:00:00Z' };

function rpc(messages) {
  const input = `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`;
  const result = runCli(['mcp'], env, input);
  return result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

test('MCP initialize, list tools and ignore notifications', () => {
  const [init, list] = rpc([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' }
  ]);
  assert.equal(init.result.serverInfo.name, 'njau-cli');
  const names = list.result.tools.map((tool) => tool.name);
  assert.ok(names.includes('njau_course_today'));
  assert.ok(names.includes('njau_classroom_free'));
  assert.ok(!names.includes('njau_auth_login'), 'interactive commands must not be exposed');
  assert.ok(!names.includes('njau_notice_download'), 'file-writing commands must not be exposed');
  const free = list.result.tools.find((tool) => tool.name === 'njau_classroom_free');
  assert.equal(free.inputSchema.properties.sections.type, 'string');
  assert.equal(free.inputSchema.properties.week.type, 'number');
});

test('MCP tools/call returns structured data and errors', () => {
  const [today, missing, unknown] = rpc([
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'njau_course_today', arguments: { date: '2026-10-19' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'njau_nope', arguments: {} } },
    { jsonrpc: '2.0', id: 3, method: 'does/not/exist' }
  ]);
  assert.equal(today.result.structuredContent.week, 8);
  assert.deepEqual(today.result.structuredContent.courses.map((course) => course.code), ['TEST1001']);
  assert.equal(missing.result.isError, true);
  assert.equal(unknown.error.code, -32601);
});

test('MCP reports LOGIN_REQUIRED as a tool error', () => {
  const input = `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'njau_grade_gpa', arguments: {} } })}\n`;
  const result = runCli(['mcp'], { ...env, NJAU_MOCK_LOGGED_OUT: '1' }, input);
  const response = JSON.parse(result.stdout.trim());
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /LOGIN_REQUIRED/);
});
