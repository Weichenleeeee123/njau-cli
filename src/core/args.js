import { fail } from './errors.js';

// Parses argv against a small option spec:
//   { limit: { type: 'number', default: 20 }, term: { type: 'string' }, yes: { type: 'boolean' } }
// Repeatable string options use type 'list'. Unknown flags are rejected so agents get a clear error.
export function parseArgs(argv, spec = {}) {
  const options = {};
  const positionals = [];
  const aliases = {};

  for (const [name, def] of Object.entries(spec)) {
    if (def.alias) {
      aliases[def.alias] = name;
    }
    if (def.default !== undefined) {
      options[name] = def.default;
    } else if (def.type === 'list') {
      options[name] = [];
    }
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('-') || arg === '-' || /^-\d/.test(arg)) {
      positionals.push(arg);
      continue;
    }

    let [flag, inlineValue] = arg.replace(/^--?/, '').split(/=(.*)/s, 2);
    flag = aliases[flag] ?? toCamel(flag);
    const def = spec[flag];
    if (!def) {
      fail('INVALID_ARGUMENT', `Unknown option: ${arg}`, {
        hint: `Supported options: ${Object.keys(spec).map((name) => `--${toKebab(name)}`).join(', ') || '(none)'}`
      });
    }

    if (def.type === 'boolean') {
      options[flag] = inlineValue === undefined ? true : !/^(?:0|false|no)$/i.test(inlineValue);
      continue;
    }

    let value = inlineValue;
    if (value === undefined) {
      value = argv[i + 1];
      if (value === undefined || (value.startsWith('--') && value.length > 2)) {
        fail('INVALID_ARGUMENT', `Option --${toKebab(flag)} requires a value.`);
      }
      i += 1;
    }

    if (def.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        fail('INVALID_ARGUMENT', `Option --${toKebab(flag)} must be a number.`);
      }
      if (def.min !== undefined && number < def.min) {
        fail('INVALID_ARGUMENT', `Option --${toKebab(flag)} must be >= ${def.min}.`);
      }
      if (def.max !== undefined && number > def.max) {
        fail('INVALID_ARGUMENT', `Option --${toKebab(flag)} must be <= ${def.max}.`);
      }
      options[flag] = number;
    } else if (def.type === 'list') {
      options[flag].push(value);
    } else {
      if (def.choices && !def.choices.includes(value)) {
        fail('INVALID_ARGUMENT', `Option --${toKebab(flag)} must be one of: ${def.choices.join(', ')}.`);
      }
      options[flag] = value;
    }
  }

  return { options, positionals };
}

export function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function toKebab(value) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
