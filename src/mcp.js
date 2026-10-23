import { createInterface } from 'node:readline';

import { toKebab } from './core/args.js';
import { toErrorPayload } from './core/errors.js';
import { COMMANDS } from './commands/index.js';

// Minimal MCP (Model Context Protocol) server over stdio. Exposes read-only njau-cli commands
// as tools. Commands that open windows, write files or change local state stay CLI-only.
const PROTOCOL_VERSION = '2025-06-18';
const EXCLUDED = new Set([
  'install', 'auth login', 'auth logout', 'browser use', 'browser install', 'skill install',
  'course export', 'notice download', 'mcp'
]);

export function toolName(command) {
  return `njau_${command.name.replace(/[^a-z0-9]+/gi, '_')}`;
}

export function exposedCommands() {
  return COMMANDS.filter((command) => !EXCLUDED.has(command.name) && !command.mutating);
}

export function toolDefinition(command) {
  const properties = {};
  const required = [];
  for (const spec of command.args ?? []) {
    const name = spec.replace(/[?.]+$/, '');
    properties[name] = { type: 'string', description: `Positional argument <${name}>` };
    if (!spec.endsWith('?') && !spec.endsWith('...')) {
      required.push(name);
    }
  }
  for (const [name, def] of Object.entries(command.options ?? {})) {
    const schema = def.type === 'number'
      ? { type: 'number' }
      : def.type === 'boolean'
        ? { type: 'boolean' }
        : def.type === 'list'
          ? { type: 'array', items: { type: 'string' } }
          : { type: 'string', ...(def.choices ? { enum: def.choices } : {}) };
    if (def.description) {
      schema.description = def.description;
    }
    if (def.default !== undefined) {
      schema.default = def.default;
    }
    properties[name] = schema;
  }
  return {
    name: toolName(command),
    title: `njau-cli ${command.name}`,
    description: `${command.summary}${command.requiresLogin ? '（需要先运行 `njau-cli auth login` 完成统一身份认证登录）' : ''}`,
    inputSchema: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true }
  };
}

export async function callTool(name, input = {}) {
  const command = exposedCommands().find((candidate) => toolName(candidate) === name);
  if (!command) {
    return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'UNKNOWN_COMMAND', message: `Unknown tool: ${name}` }) }] };
  }
  const args = {};
  const options = {};
  for (const spec of command.args ?? []) {
    const key = spec.replace(/[?.]+$/, '');
    args[key] = input[key] === undefined ? undefined : String(input[key]);
  }
  for (const [key, def] of Object.entries(command.options ?? {})) {
    const value = input[key] ?? input[toKebab(key)];
    options[key] = value === undefined ? (def.default ?? (def.type === 'list' ? [] : undefined)) : value;
  }
  try {
    const packageInfo = { name: 'njau-cli' };
    const data = await command.run({ options, args, positionals: Object.values(args).filter(Boolean), packageInfo });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: wrap(data) };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(toErrorPayload(error), null, 2) }] };
  }
}

function wrap(data) {
  return data && typeof data === 'object' && !Array.isArray(data) ? data : { result: data };
}

export async function handleMessage(message, packageInfo) {
  const { id, method, params } = message;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'njau-cli', title: '南京农业大学校园服务', version: packageInfo.version },
        instructions: 'Read-only tools for Nanjing Agricultural University (NJAU) campus services: timetable, grades, exams, free classrooms, notices and portal apps. If a tool returns LOGIN_REQUIRED, ask the user to run `njau-cli auth login` and log in themselves. Never ask for the user\'s password.'
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: exposedCommands().map(toolDefinition) });
    case 'tools/call':
      return reply(await callTool(params?.name, params?.arguments ?? {}));
    default:
      if (id === undefined || id === null) {
        return null; // notification, e.g. notifications/initialized
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

export async function serveMcp(packageInfo) {
  // Anything a module prints must not corrupt the JSON-RPC stream on stdout.
  console.log = (...items) => process.stderr.write(`${items.join(' ')}\n`);
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      continue;
    }
    const response = await handleMessage(message, packageInfo).catch((error) => ({
      jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: error.message }
    }));
    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}
