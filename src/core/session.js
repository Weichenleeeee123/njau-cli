import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertBrowserAvailable, getSelectedBrowser } from './browser.js';
import { getLaunchOptions } from './browser-options.js';
import { CliError } from './errors.js';
import { fixtureKey } from './http.js';
import { restoreCookies, saveCookies } from './state.js';

export const CAS_HOST = 'authserver.njau.edu.cn';
const LOGIN_HINT = 'Run `njau-cli auth login`, finish the NJAU unified login (tick 7-day remember-me), then retry.';

export function isMockBackend() {
  return process.env.NJAU_BROWSER_BACKEND === 'mock';
}

export function getProfilePath(options = {}) {
  return getSelectedBrowser({ persist: false, ...options }).profilePath;
}

export function loginRequired(message = 'NJAU unified login is required.') {
  return new CliError('LOGIN_REQUIRED', message, { hint: LOGIN_HINT });
}

export function isCasUrl(url) {
  return String(url ?? '').includes(CAS_HOST);
}

// Runs `fn(session)` inside one persistent browser context so a command that needs several
// requests only launches the browser once. The session reuses the login state saved by
// `njau-cli auth login`; it never types credentials.
export async function withSession(fn, options = {}) {
  if (isMockBackend()) {
    return fn(createMockSession());
  }

  const profilePath = getProfilePath();
  if (options.requireProfile !== false && !existsSync(profilePath)) {
    throw loginRequired('No NJAU browser profile found.');
  }

  assertBrowserAvailable({ persist: false });
  const { chromium } = await importPlaywright();
  let context;
  try {
    context = await chromium.launchPersistentContext(profilePath, {
      ...getLaunchOptions({ headless: options.headless ?? true, persist: false }),
      ...(options.acceptDownloads ? { acceptDownloads: true } : {})
    });
  } catch (cause) {
    throw launchError(cause);
  }

  await restoreCookies(context);
  try {
    return await fn(createBrowserSession(context));
  } finally {
    await saveCookies(context).catch(() => {});
    await context.close().catch(() => {});
  }
}

function createBrowserSession(context) {
  let currentPage = context.pages()[0] ?? null;

  const session = {
    context,
    async page() {
      if (!currentPage || currentPage.isClosed()) {
        currentPage = await context.newPage();
      }
      return currentPage;
    },

    // Opens a URL and returns the visible page state. Throws LOGIN_REQUIRED when the
    // request lands on the CAS login form.
    async open(url, openOptions = {}) {
      const page = await session.page();
      let response;
      try {
        response = await page.goto(url, {
          waitUntil: openOptions.waitUntil ?? 'domcontentloaded',
          timeout: openOptions.timeout ?? 30000
        });
      } catch (cause) {
        throw navigationError(url, cause);
      }
      if (openOptions.settle) {
        await page.waitForLoadState('networkidle', { timeout: openOptions.settle }).catch(() => {});
      }
      const state = await readPageState(page, response);
      if (openOptions.allowLogin !== true && isCasUrl(state.url)) {
        throw loginRequired();
      }
      return state;
    },

    // Captures JSON responses whose URL matches `pattern` while `action` runs.
    async capture(pattern, action, captureOptions = {}) {
      const page = await session.page();
      const captured = [];
      const listener = async (response) => {
        if (!pattern.test(response.url())) {
          return;
        }
        try {
          captured.push({ url: response.url(), status: response.status(), body: await response.json() });
        } catch {
          // Non-JSON responses are ignored; callers validate what they need.
        }
      };
      page.on('response', listener);
      try {
        await action(page);
        const deadline = Date.now() + (captureOptions.timeout ?? 10000);
        while (Date.now() < deadline && captured.length < (captureOptions.min ?? 1)) {
          await page.waitForTimeout(200);
        }
      } finally {
        page.off('response', listener);
      }
      return captured;
    },

    // Calls an endpoint with the browser's cookies (APIRequestContext shares the profile's
    // cookie jar). `form` sends x-www-form-urlencoded, `json` sends a JSON body.
    async request(url, requestOptions = {}) {
      const method = (requestOptions.method ?? (requestOptions.form || requestOptions.json ? 'POST' : 'GET')).toUpperCase();
      let response;
      try {
        response = await context.request.fetch(url, {
          method,
          headers: requestOptions.headers,
          ...(requestOptions.form ? { form: requestOptions.form } : {}),
          ...(requestOptions.json ? { data: requestOptions.json } : {}),
          ...(requestOptions.params ? { params: requestOptions.params } : {}),
          timeout: requestOptions.timeout ?? 30000,
          maxRedirects: requestOptions.maxRedirects ?? 10
        });
      } catch (cause) {
        throw navigationError(url, cause);
      }
      if (isCasUrl(response.url())) {
        throw loginRequired();
      }
      return response;
    },

    async requestJson(url, requestOptions = {}) {
      const response = await session.request(url, requestOptions);
      const text = await response.text();
      if (response.status() === 401) {
        throw loginRequired();
      }
      if (response.status() === 403) {
        throw new CliError('PERMISSION_DENIED', `Access denied by ${new URL(url).hostname}.`);
      }
      try {
        return JSON.parse(text);
      } catch {
        if (/统一身份认证|authserver/.test(text)) {
          throw loginRequired();
        }
        throw new CliError('PAGE_CHANGED', `Expected JSON from ${new URL(url).pathname} (HTTP ${response.status()}).`, {
          details: { url, status: response.status(), preview: text.slice(0, 200) }
        });
      }
    },

    async evaluate(fn, arg) {
      const page = await session.page();
      return page.evaluate(fn, arg);
    }
  };
  return session;
}

// Mock session for tests: NJAU_MOCK_DIR holds JSON files named by fixtureKey(url).
// NJAU_MOCK_LOGGED_OUT=1 simulates an expired login.
function createMockSession() {
  const dir = process.env.NJAU_MOCK_DIR;
  const loggedOut = /^(?:1|true)$/i.test(process.env.NJAU_MOCK_LOGGED_OUT ?? '');
  const load = async (url) => {
    if (loggedOut) {
      throw loginRequired();
    }
    if (!dir) {
      throw new CliError('BACKEND_UNAVAILABLE', 'NJAU_MOCK_DIR is not set for the mock backend.');
    }
    const file = join(dir, fixtureKey(url));
    try {
      return await readFile(file, 'utf8');
    } catch {
      throw new CliError('PAGE_CHANGED', `No mock fixture for ${url}.`, { details: { fixture: file } });
    }
  };
  const session = {
    mock: true,
    async open(url) {
      if (loggedOut) {
        throw loginRequired();
      }
      return { url, title: 'mock', text: '', status: 200 };
    },
    async capture() {
      return [];
    },
    async request(url) {
      const text = await load(url);
      return { status: () => 200, text: async () => text, json: async () => JSON.parse(text), body: async () => Buffer.from(text), headers: () => ({}) };
    },
    async requestJson(url) {
      return JSON.parse(await load(url));
    },
    async evaluate() {
      return null;
    },
    async page() {
      throw new CliError('BACKEND_UNAVAILABLE', 'Mock backend has no page.');
    }
  };
  return session;
}

export async function readPageState(page, response) {
  return {
    url: page.url(),
    title: await page.title().catch(() => ''),
    text: await page.locator('body').innerText({ timeout: 10000 }).catch(() => ''),
    status: response?.status?.() ?? null
  };
}

export async function importPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new CliError('BACKEND_UNAVAILABLE', 'Playwright is not installed.', { hint: 'Run `npm install` in the njau-cli package.' });
  }
}

function launchError(cause) {
  const message = String(cause?.message ?? cause);
  if (/user data directory is already in use|ProcessSingleton|lock/i.test(message)) {
    return new CliError('BACKEND_UNAVAILABLE', 'The njau-cli browser profile is already open.', {
      hint: 'Close the browser window opened by `njau-cli auth login` and retry.',
      cause
    });
  }
  return new CliError('BACKEND_UNAVAILABLE', `Unable to launch the browser: ${message.split('\n')[0]}`, { cause });
}

function navigationError(url, cause) {
  const message = String(cause?.message ?? cause);
  if (/ERR_|Timeout|timed out|ECONN|ENOTFOUND|socket hang up/i.test(message)) {
    return new CliError('NETWORK_REQUIRED', `Unable to reach ${new URL(url).hostname}.`, {
      hint: 'Run `njau-cli network check`. Route *.njau.edu.cn DIRECT in your proxy, or connect to the campus network/VPN.',
      details: { url, reason: message.split('\n')[0] },
      cause
    });
  }
  return new CliError('PAGE_CHANGED', `Navigation failed: ${message.split('\n')[0]}`, { details: { url }, cause });
}
