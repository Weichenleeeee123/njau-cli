import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';

import { assertBrowserAvailable } from '../core/browser.js';
import { getLaunchOptions } from '../core/browser-options.js';
import { CliError } from '../core/errors.js';
import {
  getProfilePath,
  importPlaywright,
  isCasUrl,
  isMockBackend,
  readPageState,
  withSession
} from '../core/session.js';

export const PORTAL_URL = 'https://myportal.njau.edu.cn/new/index.html';
export const CAS_LOGIN_URL = `https://authserver.njau.edu.cn/authserver/login?service=${encodeURIComponent('http://myportal.njau.edu.cn/login?service=https://myportal.njau.edu.cn/new/index.html')}`;
// Visiting these after CAS login lets each system issue its own session cookie.
const WARMUP_URLS = [
  'https://szjw.njau.edu.cn/api/login/sso/cas/login?platformCode=DEF_CAS&service=https://szjw.njau.edu.cn/xsd/'
];
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function classifyAuthPage(state) {
  const url = state.url ?? '';
  const title = state.title ?? '';
  const text = state.text ?? '';
  if (isCasUrl(url) || title.includes('统一身份认证')) {
    return { loggedIn: false, reason: 'cas-login-page' };
  }
  if (url.includes('myportal.njau.edu.cn') && /退出|注销|个人中心|我的服务|Logout/i.test(text)) {
    return { loggedIn: true, reason: 'portal-user-menu' };
  }
  if (url.includes('myportal.njau.edu.cn') && !/登录Login|^登录$/m.test(text)) {
    return { loggedIn: true, reason: 'portal-page' };
  }
  if (url.includes('szjw.njau.edu.cn') && !/登录/.test(title)) {
    return { loggedIn: true, reason: 'szjw-page' };
  }
  return { loggedIn: false, reason: 'unknown' };
}

export async function login(options = {}) {
  const profilePath = getProfilePath({ persist: true });
  await mkdir(profilePath, { recursive: true });

  if (isMockBackend()) {
    return { opened: true, authenticated: true, url: CAS_LOGIN_URL, profilePath, backend: 'mock' };
  }

  const browser = assertBrowserAvailable();
  const { chromium } = await importPlaywright();
  let context;
  try {
    context = await chromium.launchPersistentContext(profilePath, getLaunchOptions({ headless: false }));
  } catch (cause) {
    throw new CliError('BACKEND_UNAVAILABLE', `Unable to open the login browser: ${String(cause.message).split('\n')[0]}`, {
      hint: 'Close other njau-cli browser windows and retry.',
      cause
    });
  }

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(options.url ?? CAS_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    process.stderr.write('请在打开的浏览器窗口里完成南京农业大学统一身份认证登录（建议勾选“7天免登录”）。\n');

    const outcome = await waitForLogin(page, context, options.timeout ?? LOGIN_TIMEOUT_MS);
    const warmed = [];
    if (outcome === 'authenticated') {
      for (const url of options.warmup === false ? [] : WARMUP_URLS) {
        const result = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          .then(() => ({ url, ok: !isCasUrl(page.url()), finalUrl: page.url() }))
          .catch((cause) => ({ url, ok: false, error: String(cause.message).split('\n')[0] }));
        warmed.push(result);
      }
      if (options.keepOpen) {
        process.stderr.write('登录成功。关闭浏览器窗口后命令结束。\n');
        await context.waitForEvent('close').catch(() => {});
      }
    }

    return {
      opened: true,
      authenticated: outcome === 'authenticated',
      outcome,
      browser: browser.id,
      profilePath,
      warmup: warmed,
      message: outcome === 'authenticated'
        ? 'Login completed; the browser profile is ready.'
        : 'Browser was closed before login finished. Rerun `njau-cli auth login`.'
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function waitForLogin(page, context, timeout) {
  const deadline = Date.now() + timeout;
  let closed = false;
  context.once('close', () => {
    closed = true;
  });
  while (Date.now() < deadline) {
    if (closed || page.isClosed()) {
      return 'closed';
    }
    const url = page.url();
    if (url.includes('myportal.njau.edu.cn') || url.includes('szjw.njau.edu.cn')) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      const state = await readPageState(page).catch(() => ({ url }));
      if (classifyAuthPage(state).loggedIn) {
        return 'authenticated';
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new CliError('AUTH_LOGIN_TIMEOUT', 'Login was not completed within the time limit.', {
    hint: 'Rerun `njau-cli auth login` and finish the login in the opened window.'
  });
}

export async function logout() {
  const profilePath = getProfilePath();
  const profileExisted = existsSync(profilePath);
  try {
    await rm(profilePath, { recursive: true, force: true });
  } catch (cause) {
    throw new CliError('AUTH_LOGOUT_FAILED', 'Unable to clear the njau-cli browser profile.', {
      hint: 'Close any njau-cli browser window and retry `njau-cli auth logout`.',
      cause
    });
  }
  return { loggedOut: true, profileExisted, profilePath };
}

export async function status(options = {}) {
  const profilePath = getProfilePath();
  const profileExists = existsSync(profilePath);
  if (isMockBackend()) {
    const loggedIn = !/^(?:1|true)$/i.test(process.env.NJAU_MOCK_LOGGED_OUT ?? '') && profileExists !== false;
    return withHint({ loggedIn, reason: 'mock', profileExists, profilePath });
  }
  if (!profileExists) {
    return withHint({ loggedIn: false, reason: 'profile-missing', profileExists, profilePath });
  }

  return withSession(async (session) => {
    const state = await session.open(options.url ?? PORTAL_URL, { allowLogin: true, settle: 5000 });
    const result = classifyAuthPage(state);
    let szjw = null;
    if (result.loggedIn && options.deep) {
      szjw = await session.open(WARMUP_URLS[0], { allowLogin: true })
        .then((page) => ({ ok: !isCasUrl(page.url), finalUrl: page.url }))
        .catch((error) => ({ ok: false, error: error.code ?? error.message }));
    }
    return withHint({ ...result, profileExists, profilePath, finalUrl: state.url, ...(szjw ? { szjw } : {}) });
  });
}

function withHint(result) {
  return result.loggedIn ? result : {
    ...result,
    hint: 'Run `njau-cli auth login` and complete the NJAU unified login in the opened browser.'
  };
}
