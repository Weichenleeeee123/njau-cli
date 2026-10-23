import { readFile } from 'node:fs/promises';

import { parseArgs, toKebab } from './core/args.js';
import { CliError, exitCodeFor, toErrorPayload } from './core/errors.js';
import { errorEnvelope, successEnvelope, writeHuman, writeJson } from './core/output.js';
import { COMMANDS } from './commands/index.js';

const GLOBAL_OPTIONS = {
  json: { type: 'boolean', description: '兼容参数；默认就输出 JSON' },
  format: { type: 'string', choices: ['json', 'table'], description: '输出格式，table 便于人读' },
  help: { type: 'boolean', alias: 'h' }
};

export async function run(argv) {
  const packageInfo = await readPackageInfo();
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${packageInfo.version}\n`);
    return;
  }

  const format = readFormat(argv);
  argv = stripGlobalOptions(argv);
  const { command, rest } = resolveCommand(argv);
  const emit = format === 'table' ? writeHuman : writeJson;

  if (!command) {
    if (!argv.length || argv[0] === 'help' || argv.includes('--help') || argv.includes('-h')) {
      emit(successEnvelope(describeCommands(argv[0] === 'help' ? argv[1] : argv.find((arg) => !arg.startsWith('-'))), { command: 'help' }));
      return;
    }
    const error = new CliError('UNKNOWN_COMMAND', `Unknown command: ${argv.filter((arg) => !arg.startsWith('-')).slice(0, 2).join(' ')}`, {
      hint: 'Run `njau-cli help` to list commands.'
    });
    emit(errorEnvelope(toErrorPayload(error), { command: argv.slice(0, 2).join(' ') }));
    process.exitCode = exitCodeFor(error.code);
    return;
  }

  try {
    const { options, positionals } = parseArgs(rest, { ...GLOBAL_OPTIONS, ...(command.options ?? {}) });
    if (options.help) {
      emit(successEnvelope(describeCommand(command), { command: command.name }));
      return;
    }
    const args = bindPositionals(command, positionals);
    const data = await command.run({ options, args, positionals, packageInfo });
    emit(successEnvelope(data, {
      command: command.name,
      ...(data && typeof data === 'object' && data.sourceUrl ? { sourceUrl: data.sourceUrl } : {})
    }));
  } catch (error) {
    emit(errorEnvelope(toErrorPayload(error), { command: command.name }));
    process.exitCode = exitCodeFor(error.code);
  }
}

function resolveCommand(argv) {
  const words = [];
  for (const arg of argv) {
    if (arg.startsWith('-')) {
      break;
    }
    words.push(arg);
    if (words.length === 2) {
      break;
    }
  }
  for (let length = words.length; length > 0; length -= 1) {
    const name = words.slice(0, length).join(' ');
    const command = COMMANDS.find((candidate) => candidate.name === name);
    if (command) {
      return { command, rest: removeWords(argv, length) };
    }
  }
  return { command: null, rest: argv };
}

function removeWords(argv, count) {
  const copy = [...argv];
  let removed = 0;
  for (let i = 0; i < copy.length && removed < count; i += 1) {
    if (!copy[i].startsWith('-')) {
      copy.splice(i, 1);
      i -= 1;
      removed += 1;
    }
  }
  return copy;
}

function stripGlobalOptions(argv) {
  const result = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--format') {
      i += 1;
      continue;
    }
    if (argv[i].startsWith('--format=') || argv[i] === '--json') {
      continue;
    }
    result.push(argv[i]);
  }
  return result;
}

function readFormat(argv) {
  const index = argv.indexOf('--format');
  const value = index >= 0 ? argv[index + 1] : argv.find((arg) => arg.startsWith('--format='))?.split('=')[1];
  return value === 'table' ? 'table' : 'json';
}

function bindPositionals(command, positionals) {
  const specs = command.args ?? [];
  const args = {};
  specs.forEach((spec, index) => {
    const variadic = spec.endsWith('...');
    const optional = spec.endsWith('?') || variadic;
    const name = spec.replace(/[?.]+$/, '');
    const value = variadic ? positionals.slice(index).join(' ') : positionals[index];
    if (!optional && (value === undefined || value === '')) {
      throw new CliError('INVALID_ARGUMENT', `Missing argument <${name}> for \`${command.name}\`.`, {
        hint: `Usage: njau-cli ${usage(command)}`
      });
    }
    args[name] = value === '' ? undefined : value;
  });
  if (!specs.some((spec) => spec.endsWith('...')) && positionals.length > specs.length) {
    throw new CliError('INVALID_ARGUMENT', `Unexpected argument: ${positionals[specs.length]}`, {
      hint: `Usage: njau-cli ${usage(command)}`
    });
  }
  return args;
}

function usage(command) {
  const args = (command.args ?? []).map((spec) => (spec.endsWith('?') || spec.endsWith('...') ? `[${spec.replace(/[?]$/, '')}]` : `<${spec}>`));
  return [command.name, ...args, command.options && Object.keys(command.options).length ? '[options]' : ''].filter(Boolean).join(' ');
}

function describeCommand(command) {
  return {
    name: command.name,
    usage: `njau-cli ${usage(command)}`,
    summary: command.summary,
    requiresLogin: Boolean(command.requiresLogin),
    ...(command.mutating ? { mutating: true } : {}),
    options: Object.entries(command.options ?? {}).map(([name, def]) => ({
      flag: `--${toKebab(name)}`,
      type: def.type,
      ...(def.default !== undefined ? { default: def.default } : {}),
      ...(def.choices ? { choices: def.choices } : {}),
      ...(def.description ? { description: def.description } : {})
    })),
    ...(command.examples ? { examples: command.examples } : {})
  };
}

function describeCommands(domain) {
  const list = COMMANDS.filter((command) => !domain || command.name.split(' ')[0] === domain);
  return {
    usage: 'njau-cli <domain> <action> [args] [--options] [--format table]',
    output: 'JSON envelope by default: { ok, data | error, meta }',
    commands: list.map((command) => ({
      name: command.name,
      usage: `njau-cli ${usage(command)}`,
      summary: command.summary,
      requiresLogin: Boolean(command.requiresLogin)
    }))
  };
}

async function readPackageInfo() {
  const raw = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

export { describeCommand };
