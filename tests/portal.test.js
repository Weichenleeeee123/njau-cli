import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeApp, searchApps } from '../src/commands/portal.js';

const apps = [
  { appId: '1', appName: '学生请假申请', description: '学生请假申请', categoryList: [{ categoryName: '学生管理' }], hasPermission: true },
  { appId: '2', appName: '网上报修', description: '宿舍水电维修', categoryList: [{ categoryName: '后勤服务' }], hasPermission: true },
  { appId: '3', appName: '财务信息平台', description: '', categoryList: [{ categoryName: '业务系统' }], hasPermission: false }
].map(normalizeApp);

test('normalizeApp builds AMP appShow links and drops duplicate descriptions', () => {
  assert.equal(apps[0].url, 'https://myportal.njau.edu.cn/appShow?appId=1');
  assert.equal(apps[0].description, null);
  assert.deepEqual(apps[1].categories, ['后勤服务']);
});

test('searchApps matches name, description and category; hides apps without permission', () => {
  assert.deepEqual(searchApps(apps, { keyword: '维修' }).map((app) => app.id), ['2']);
  assert.deepEqual(searchApps(apps, { category: '学生' }).map((app) => app.id), ['1']);
  assert.deepEqual(searchApps(apps, {}).map((app) => app.id), ['1', '2']);
  assert.deepEqual(searchApps(apps, { all: true }).map((app) => app.id), ['1', '2', '3']);
});
