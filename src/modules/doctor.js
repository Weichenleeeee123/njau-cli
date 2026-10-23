import process from 'node:process';
import { existsSync } from 'node:fs';

import { getBrowserStatus, getNjauHome } from '../core/browser.js';
import { getProfilePath } from '../core/session.js';
import { checkNetwork } from './network.js';

const MIN_NODE_MAJOR = 20;

export async function getDoctorReport({ packageInfo, offline = false }) {
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  const playwrightInstalled = await import('playwright').then(() => true, () => false);
  const browserStatus = getBrowserStatus();
  const profilePath = getProfilePath();
  const network = offline ? null : await checkNetwork({ timeout: 8000 });

  return {
    cli: { name: packageInfo.name, version: packageInfo.version },
    node: { version: process.versions.node, ok: nodeMajor >= MIN_NODE_MAJOR, minimumMajor: MIN_NODE_MAJOR },
    platform: { os: process.platform, arch: process.arch },
    home: { path: getNjauHome() },
    profile: { path: profilePath, exists: existsSync(profilePath) },
    playwright: { installed: playwrightInstalled },
    browser: { ...browserStatus, profileMode: 'persistent' },
    ...(network ? { network } : {})
  };
}
