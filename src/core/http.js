import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CliError } from './errors.js';

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 njau-cli';
const DEFAULT_TIMEOUT_MS = 20000;

// Fetches a public (no-login) NJAU page. Tests point NJAU_HTTP_FIXTURES at a directory whose
// files are named by fixtureKey(url), so parsers can be exercised without network access.
export async function fetchText(url, options = {}) {
  const fixtures = process.env.NJAU_HTTP_FIXTURES;
  if (fixtures) {
    const file = join(fixtures, fixtureKey(url));
    try {
      return await readFile(file, 'utf8');
    } catch {
      throw new CliError('NETWORK_REQUIRED', `No HTTP fixture for ${url}.`, { details: { fixture: file } });
    }
  }

  const response = await fetchWithRetry(url, options);
  if (response.status === 404) {
    throw new CliError('NOT_FOUND', `Page not found: ${url}`);
  }
  if (response.status === 403 || response.status === 429) {
    throw new CliError('RATE_LIMITED', `The server refused the request (${response.status}).`, {
      hint: 'Wait a while before retrying; do not loop requests.'
    });
  }
  if (!response.ok) {
    throw new CliError('NETWORK_REQUIRED', `Request failed with HTTP ${response.status}: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return decode(buffer, response.headers.get('content-type'));
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError('PAGE_CHANGED', `Expected JSON from ${url}.`);
  }
}

export async function fetchBuffer(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  if (!response.ok) {
    throw new CliError('DOWNLOAD_UNAVAILABLE', `Download failed with HTTP ${response.status}: ${url}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type'),
    disposition: response.headers.get('content-disposition')
  };
}

export function fixtureKey(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}${parsed.search}`
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180);
}

async function fetchWithRetry(url, options) {
  const attempts = options.retries ?? 1;
  let lastError;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: options.accept ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
          ...(options.headers ?? {})
        },
        body: options.body,
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS)
      });
    } catch (cause) {
      lastError = cause;
    }
  }
  throw networkError(url, lastError);
}

export function networkError(url, cause) {
  const host = safeHost(url);
  return new CliError('NETWORK_REQUIRED', `Unable to reach ${host}: ${cause?.cause?.code ?? cause?.name ?? cause?.message ?? 'network error'}.`, {
    hint: 'Run `njau-cli network check`. If you use a proxy (Clash etc.), route *.njau.edu.cn DIRECT; some NJAU systems reject overseas IPs.',
    details: { url },
    cause
  });
}

function decode(buffer, contentType) {
  const declared = /charset=([\w-]+)/i.exec(contentType ?? '')?.[1]
    ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(buffer.subarray(0, 2048).toString('latin1'))?.[1]
    ?? 'utf-8';
  try {
    return new TextDecoder(declared.toLowerCase()).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
