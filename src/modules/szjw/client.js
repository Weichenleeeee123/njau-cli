import { CliError } from '../../core/errors.js';
import { isCasUrl, isMockBackend, loginRequired, withSession } from '../../core/session.js';

// 数智教务平台（强智「数智教学微服务平台」）学生端。所有接口都走 cookie 会话，返回
// { data, status: "200", message, variables }。
export const SZJW_ORIGIN = 'https://szjw.njau.edu.cn';
export const SZJW_API = `${SZJW_ORIGIN}/api/xsd`;
export const SZJW_SSO_URL = `${SZJW_ORIGIN}/api/login/sso/cas/login?platformCode=DEF_CAS&service=${SZJW_ORIGIN}/xsd/`;

export function apiUrl(path) {
  return `${SZJW_API}${path.startsWith('/') ? path : `/${path}`}`;
}

export function unwrap(payload, path) {
  if (payload && typeof payload === 'object' && 'status' in payload && 'data' in payload) {
    if (String(payload.status) === '200') {
      return payload.data;
    }
    if (String(payload.status) === '401' || /未登录|登录过期|重新登录|token/i.test(payload.message ?? '')) {
      throw loginRequired('数智教务平台会话已失效。');
    }
    throw new CliError('PAGE_CHANGED', `szjw ${path} returned status ${payload.status}: ${payload.message ?? ''}`.trim(), {
      details: { path, status: payload.status }
    });
  }
  return payload;
}

// Runs `fn(api)` with a szjw session. The first call checks the session with a cheap
// endpoint and performs CAS SSO only when needed.
export async function withSzjw(fn, options = {}) {
  return withSession(async (session) => {
    const api = createApi(session);
    if (!session.mock) {
      await ensureSzjwSession(session, api);
    }
    return fn(api, session);
  }, options);
}

function createApi(session) {
  const call = async (method, path, body, params) => {
    const url = apiUrl(path);
    const payload = method === 'GET'
      ? await session.requestJson(withParams(url, params), { method: 'GET' })
      : await session.requestJson(withParams(url, params), { method: 'POST', json: body ?? {} });
    return unwrap(payload, path);
  };
  return {
    get: (path, params) => call('GET', path, undefined, params),
    post: (path, body, params) => call('POST', path, body, params),
    session
  };
}

function withParams(url, params) {
  if (!params) {
    return url;
  }
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.href;
}

async function ensureSzjwSession(session, api) {
  if (await probe(api)) {
    return;
  }
  let response;
  try {
    response = await session.request(SZJW_SSO_URL, { method: 'GET', timeout: 30000 });
  } catch (error) {
    if (error.code === 'LOGIN_REQUIRED') {
      throw loginRequired('统一身份认证登录已失效，无法进入数智教务平台。');
    }
    throw error;
  }
  if (isCasUrl(response.url())) {
    throw loginRequired('统一身份认证登录已失效，无法进入数智教务平台。');
  }
  if (!(await probe(api))) {
    throw loginRequired('数智教务平台单点登录没有成功。');
  }
}

async function probe(api) {
  try {
    const user = await api.get('/qsmart/common/sessionUserInfo');
    return Boolean(user && (user.userAccount || user.id));
  } catch (error) {
    if (['LOGIN_REQUIRED', 'PAGE_CHANGED', 'PERMISSION_DENIED'].includes(error.code)) {
      return false;
    }
    throw error;
  }
}

export { isMockBackend };
