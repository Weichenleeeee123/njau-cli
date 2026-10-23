import { lookup } from 'node:dns/promises';

import { USER_AGENT } from '../core/http.js';

export const NJAU_HOSTS = [
  { id: 'cas', url: 'https://authserver.njau.edu.cn/authserver/login', label: '统一身份认证' },
  { id: 'portal', url: 'https://myportal.njau.edu.cn/new/index.html', label: '网上办事大厅' },
  { id: 'szjw', url: 'https://szjw.njau.edu.cn/xsd/', label: '数智教务平台' },
  { id: 'www', url: 'https://www.njau.edu.cn/', label: '学校主页' },
  { id: 'aao', url: 'https://aao.njau.edu.cn/', label: '教务处' },
  { id: 'lib', url: 'https://lib.njau.edu.cn/', label: '图书馆' }
];

// Fake-IP ranges used by Clash/mihomo/sing-box TUN mode.
export function isFakeIp(address) {
  return /^198\.1[89]\./.test(address ?? '') || /^fc00:|^fdfe:/i.test(address ?? '');
}

export async function checkNetwork(options = {}) {
  const hosts = options.only ? NJAU_HOSTS.filter((host) => options.only.includes(host.id)) : NJAU_HOSTS;
  const results = await Promise.all(hosts.map((host) => probe(host, options.timeout ?? 10000)));
  const proxyEnv = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY']
    .filter((name) => process.env[name]);
  const fakeIp = results.some((result) => isFakeIp(result.address));
  const unreachable = results.filter((result) => !result.reachable).map((result) => result.id);

  const advice = [];
  if (fakeIp) {
    advice.push('检测到代理软件的 fake-ip / TUN 模式。请在代理规则里加 DOMAIN-SUFFIX,njau.edu.cn,DIRECT，让学校域名直连。');
  }
  if (unreachable.includes('szjw')) {
    advice.push('数智教务平台不可达：它通常只接受境内 / 校园网 IP。请关闭全局代理或设置直连，必要时连接校园网或学校 VPN。');
  }
  if (unreachable.length === results.length) {
    advice.push('所有南农站点都不可达，请检查网络连接。');
  }

  return {
    ok: unreachable.length === 0,
    fakeIpDetected: fakeIp,
    proxyEnv,
    hosts: results,
    unreachable,
    advice
  };
}

async function probe(host, timeout) {
  const hostname = new URL(host.url).hostname;
  const started = Date.now();
  const address = await lookup(hostname).then((result) => result.address).catch(() => null);
  try {
    const response = await fetch(host.url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout)
    });
    await response.arrayBuffer().catch(() => {});
    return {
      id: host.id,
      label: host.label,
      host: hostname,
      address,
      reachable: response.status < 500,
      status: response.status,
      ms: Date.now() - started
    };
  } catch (cause) {
    return {
      id: host.id,
      label: host.label,
      host: hostname,
      address,
      reachable: false,
      error: cause?.cause?.code ?? cause?.name ?? String(cause),
      ms: Date.now() - started
    };
  }
}
