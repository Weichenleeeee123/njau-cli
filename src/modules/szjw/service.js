import { CliError } from '../../core/errors.js';
import { listOf } from './parsers.js';

// Thin wrappers around szjw endpoints. Each takes the `api` object from withSzjw().
const KBJCMS_ID = '1';

export async function getUser(api) {
  return api.get('/qsmart/common/sessionUserInfo');
}

export async function getTerms(api) {
  return listOf(await api.post('/jsxsd/jczy/jxxnxq/select', { bean: {} }));
}

export async function getCurrentTerm(api) {
  return api.get('/jsxsd/jczy/jxxnxq/dqxnxq');
}

export async function resolveTermId(api, term) {
  if (term && term !== 'current') {
    if (!/^\d{4}-\d{4}-[12]$/.test(term)) {
      throw new CliError('INVALID_ARGUMENT', `Term must look like 2026-2027-1, got ${term}.`);
    }
    return term;
  }
  const current = await getCurrentTerm(api);
  if (!current?.id) {
    throw new CliError('PAGE_CHANGED', 'Unable to determine the current term from szjw.');
  }
  return current.id;
}

export async function getCalendarRaw(api, termId) {
  return api.get('/jsxsd/jczy/jxjxxl/getByXnxq', { xnxqid: termId });
}

export async function getSectionsRaw(api, termId) {
  return api.get('/jsxsd/pkgl/kbsjsz/kbsjJcmxDetail', { kbjcmsid: KBJCMS_ID, xnxqid: termId });
}

export async function getTimetableRaw(api, termId, week = '') {
  return listOf(await api.post('/jsxsd/xsd/pkgl/grkbcx/queryGrkbxx', { zc: week ? String(week) : '', kbjcmsId: KBJCMS_ID, xnxqId: termId }));
}

export async function getUnscheduledRaw(api, termId) {
  return listOf(await api.post('/jsxsd/xsd/pkgl/grkbcx/wpkjxrw', { xnxqId: termId, kbjcmsId: KBJCMS_ID }));
}

export async function getTodayRaw(api) {
  return listOf(await api.post('/jsxsd/xsd/pkgl/grkbcx/queryJrkc', {}));
}

export async function getChangesRaw(api, termId) {
  return listOf(await api.get('/jsxsd/rcyx/jstkgl/querKbbd', { xnxqid: termId }));
}

export async function getGradesRaw(api, { termId = '', best = false, failedOnly = false, keyword = '', byCourseTerm = false } = {}) {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await api.post('/jsxsd/cjgl/cjglcjzk/querywdcj', {
      bean: {
        cxwd: byCourseTerm ? 'kkxq' : 'cjxq',
        xnxqid: termId,
        kcxx: keyword,
        xdms: '',
        xsfs: best ? 'zhcj' : 'qbcj',
        xsbccjflag: '1',
        zxsbjgcjflag: failedOnly ? '1' : '0'
      },
      pageNumber: page,
      pageSize: 100
    });
    const rows = listOf(data);
    items.push(...rows);
    if (rows.length < 100 || items.length >= Number(data?.rowCount ?? 0)) {
      break;
    }
  }
  return items;
}

export async function getExamsRaw(api, termId) {
  return listOf(await api.post('/jsxsd/kwgl/ksrw/queryKsap', { xnxqid: termId, kwglkslxcode: '', kcxx: '' }));
}

export async function getSelectionsRaw(api, termId) {
  return listOf(await api.post('/jsxsd/xkgl/wdxk/query', { bean: { xnxqId: termId, kbjcmsId: KBJCMS_ID }, sorts: {} }));
}

export async function getPlanRaw(api) {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await api.post('/jsxsd/zxjhkc/zxjhKcXsdQuery', { bean: { parameters: [] }, sorts: {}, pageSize: 100, pageNumber: page });
    const rows = listOf(data);
    items.push(...rows);
    if (rows.length < 100 || items.length >= Number(data?.rowCount ?? 0)) {
      break;
    }
  }
  return items;
}

export async function getStudentDetail(api, user) {
  return api.post('/jsxsd/xjgl/xsxx/xsjbxx/detailBhzxjh', {}, { xsxxid: user.id });
}

export async function getProgressRaw(api) {
  const user = await getUser(api);
  const detail = await getStudentDetail(api, user);
  if (!detail?.zxjhid) {
    throw new CliError('PAGE_CHANGED', 'Unable to find the training plan id (zxjhid) for this student.');
  }
  return api.post('/jsxsd/xjgl/xywcqk/details', { xsid: user.id, pyfaid: detail.zxjhid, fxid: '' });
}

export async function getCampusesRaw(api) {
  return listOf(await api.post('/jsxsd/jczy/xq/select', {}));
}

export async function getBuildingsRaw(api, campusId = '') {
  return listOf(await api.post('/jsxsd/jczy/xxjxl/select', { xqids: campusId }));
}

export async function getRoomUsageRaw(api, { termId, campusId = '', buildingId = '', week = '', weekday = '', sections = '', keyword = '' }) {
  return listOf(await api.post('/jsxsd/rcyx/jsjygl/kxjszl', {
    bean: {
      zcfw: week ? `${week}-${week}` : '',
      xnxqid: termId,
      xqId: campusId,
      jxlId: buildingId,
      jslxCode: '',
      jsxx: keyword,
      xqfw: weekday ? `${weekday}-${weekday}` : '',
      jcfw: sections,
      jsztcode: [],
      yxzws: '',
      kszws: '',
      kbjcmsId: KBJCMS_ID
    },
    pageSize: 1000,
    pageNumber: 1
  }));
}

export async function getNotificationsRaw(api) {
  return api.post('/qsmart/system/articleNew/myNotifyTop20', {});
}

export async function getTodoRaw(api) {
  return api.post('/qzone/process/aggregation/todo/myListTop20', {});
}

export async function getStatusChangesRaw(api, user) {
  return listOf(await api.post('/jsxsd/xsdxjydxx/ysqydjl', { sorts: {}, pageSize: 100, pageNumber: 1, slices: {}, bean: user.businessId }));
}
