export function successEnvelope(data, meta) {
  return {
    ok: true,
    data,
    meta: withDefaults(meta)
  };
}

export function errorEnvelope(error, meta) {
  return {
    ok: false,
    error,
    meta: withDefaults(meta)
  };
}

export function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

// Human-readable rendering for `--format table`. Agents should keep using JSON.
export function writeHuman(payload) {
  if (!payload.ok) {
    const { code, message, hint } = payload.error;
    process.stdout.write(`错误 [${code}] ${message}\n${hint ? `提示：${hint}\n` : ''}`);
    return;
  }
  process.stdout.write(`${renderValue(payload.data)}\n`);
}

function renderValue(data) {
  if (Array.isArray(data)) {
    return renderTable(data);
  }
  if (data && typeof data === 'object') {
    const listKey = Object.keys(data).find((key) => Array.isArray(data[key]) && data[key].some((row) => row && typeof row === 'object'));
    const scalars = Object.entries(data)
      .filter(([key, value]) => key !== listKey && (value === null || typeof value !== 'object' || (Array.isArray(value) && value.every((item) => typeof item !== 'object'))))
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('；') : value ?? ''}`);
    const parts = [];
    if (scalars.length) {
      parts.push(scalars.join('\n'));
    }
    if (listKey) {
      parts.push(renderTable(data[listKey]));
    }
    if (!parts.length) {
      parts.push(JSON.stringify(data, null, 2));
    }
    return parts.join('\n\n');
  }
  return String(data ?? '');
}

function renderTable(rows) {
  if (!rows.length) {
    return '(空)';
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))]
    .filter((key) => rows.some((row) => row?.[key] !== null && row?.[key] !== undefined && typeof row[key] !== 'object'))
    .slice(0, 8);
  const cells = rows.map((row) => columns.map((key) => truncate(String(row?.[key] ?? ''), 40)));
  const widths = columns.map((key, index) => Math.max(displayWidth(key), ...cells.map((row) => displayWidth(row[index]))));
  const line = (values) => values.map((value, index) => pad(value, widths[index])).join('  ');
  return [line(columns), line(widths.map((width) => '-'.repeat(width))), ...cells.map(line)].join('\n');
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function displayWidth(value) {
  let width = 0;
  for (const char of value) {
    width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(char) ? 2 : 1;
  }
  return width;
}

function pad(value, width) {
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

function withDefaults(meta) {
  return {
    backend: process.env.NJAU_BROWSER_BACKEND === 'mock' ? 'mock' : 'playwright',
    ...meta
  };
}
