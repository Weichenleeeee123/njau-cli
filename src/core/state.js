import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { getNjauHome, getSelectedBrowser } from './browser.js';

// NJAU CAS and most campus systems issue session-only cookies, which Chromium drops when the
// persistent context closes. We keep a copy of the NJAU cookies next to the browser profile
// (same trust boundary, file mode 0600) and restore them on the next launch.
const NJAU_DOMAIN = /(^|\.)njau\.edu\.cn$/i;

export function getCookieStatePath() {
  const browser = getSelectedBrowser({ persist: false });
  return join(getNjauHome(), 'state', `${browser.id}-cookies.json`);
}

export async function saveCookies(context) {
  const cookies = (await context.cookies()).filter((cookie) => NJAU_DOMAIN.test(cookie.domain.replace(/^\./, '')));
  if (!cookies.length) {
    return 0;
  }
  const file = getCookieStatePath();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ savedAt: new Date().toISOString(), cookies }), { encoding: 'utf8', mode: 0o600 });
  return cookies.length;
}

export async function restoreCookies(context) {
  let saved;
  try {
    saved = JSON.parse(await readFile(getCookieStatePath(), 'utf8'));
  } catch {
    return 0;
  }
  const now = Date.now() / 1000;
  const existing = new Set((await context.cookies()).map((cookie) => `${cookie.domain}|${cookie.path}|${cookie.name}`));
  const cookies = (saved.cookies ?? [])
    .filter((cookie) => cookie.expires === -1 || cookie.expires > now)
    .filter((cookie) => !existing.has(`${cookie.domain}|${cookie.path}|${cookie.name}`));
  if (cookies.length) {
    await context.addCookies(cookies).catch(() => {});
  }
  return cookies.length;
}

export async function clearCookies() {
  await rm(getCookieStatePath(), { force: true });
}

export async function readCookieStateInfo() {
  try {
    const saved = JSON.parse(await readFile(getCookieStatePath(), 'utf8'));
    return { savedAt: saved.savedAt, count: saved.cookies?.length ?? 0, hasCasTicket: saved.cookies?.some((cookie) => cookie.name === 'CASTGC') ?? false };
  } catch {
    return null;
  }
}
