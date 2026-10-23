// Fully synthetic szjw responses (same field names as the real QiangZhi API, fake values).
// Written to a temp dir at test time so no captured campus data lives in the repo.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fixtureKey } from '../../src/core/http.js';

export const API = 'https://szjw.njau.edu.cn/api/xsd';
export const TERM = '2026-2027-1';
const START = '2026-08-31';

const ok = (data) => ({ data, status: '200', message: 'OK', variables: null });

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calendar() {
  const days = [];
  for (let week = 1; week <= 19; week += 1) {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const date = addDays(START, (week - 1) * 7 + weekday - 1);
      days.push({ mxrq: date, weekdatecode: String(weekday), xqmc: ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][weekday], zc: week, jjrflag: date === '2026-10-01' ? '1' : '0', bz: date === '2026-10-01' ? '国庆节' : null });
    }
  }
  return { id: 'cal-1', xnxqid: TERM, kszc: 1, jzzc: 19, ksrq: START, jxJxxlmxVoList: days, jxJxxlRcxxDtoList: [] };
}

export function sections() {
  const times = [['08:00', '08:45'], ['08:50', '09:35'], ['09:50', '10:35'], ['10:40', '11:25'], ['11:30', '12:15'], ['14:00', '14:45'], ['14:50', '15:35'], ['15:50', '16:35'], ['16:40', '17:25'], ['19:00', '19:45'], ['19:50', '20:35'], ['20:40', '21:25']];
  return times.map(([start, end], index) => ({ jc1: String(index + 1).padStart(2, '0'), djmc: `第${index + 1}节`, sjdbsmc: index < 5 ? '上午' : index < 9 ? '下午' : '晚上', kssj: start, jssj: end, xsflag: 1 }));
}

function course({ name, code, weekday, sections: secs, weeks, start, end, room, teacher, credit }) {
  return {
    jxrwId: `task-${code}`, kcmc: name, kcbh: code, kssj: start, jssj: end,
    kkzcMx: `,${weeks.join(',')},`, xq: String(weekday), jsmc: room, xqmc: '卫岗校区', jxlm: room.replace(/\d.*/, ''),
    kcsx: '必修', kclb: '公共必修课', kcxz: '理论课', khfs: '考试', skjs: teacher, zxs: 32, skrs: 60,
    skbj: '测试班261', kkzc: `${weeks[0]}-${weeks.at(-1)}`, jc: `${weekday}${secs.map((s) => String(s).padStart(2, '0')).join('')}`,
    jcmx: `,${secs.map((s) => weekday * 100 + s).join(',')},`, xf: credit, bz: null
  };
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function timetable() {
  return [
    course({ name: '测试高等数学', code: 'TEST1001', weekday: 1, sections: [1, 2], weeks: range(1, 16), start: '08:00', end: '09:35', room: '甲楼101', teacher: '张老师', credit: 4 }),
    course({ name: '测试经济学', code: 'TEST1002', weekday: 3, sections: [3, 4], weeks: range(4, 16), start: '09:50', end: '11:25', room: '甲楼102', teacher: '李老师,王老师', credit: 3 }),
    course({ name: '测试体育', code: 'TEST1003', weekday: 5, sections: [3, 4], weeks: range(4, 16), start: '09:50', end: '11:25', room: '体育场', teacher: '赵老师', credit: 1 }),
    course({ name: '测试晚课', code: 'TEST1004', weekday: 5, sections: [10, 11, 12], weeks: range(7, 16), start: '19:00', end: '21:25', room: '甲楼201', teacher: '钱老师', credit: 2 })
  ];
}

export function rooms() {
  const busy = { zcsk: [{ kkzc: '4-16', kcmc: '测试体育', jgmc: '赵老师', skbj: '测试班261' }] };
  return {
    rowCount: 3,
    items: [
      { jsid: 'r1', jsmc: '甲楼101', jslx: '多媒体教室', yxzws: 80, kszws: 40, detailsMap: { 503: busy, 504: busy } },
      { jsid: 'r2', jsmc: '甲楼102', jslx: '多媒体教室', yxzws: 60, kszws: 30, detailsMap: null },
      { jsid: 'r3', jsmc: '甲楼103', jslx: '实验室', yxzws: 30, kszws: 0, detailsMap: { 501: busy } }
    ]
  };
}

export function progress() {
  const module = (name, required, current) => ({ pyfakctxid: `m-${name}`, kctmc: name, status: 'notAchieved', yqxf: String(required), yhxf: '0.0', zxxf: String(current), hxxf: String(required - current), tableList: [{ xnxq: TERM, kcbm: 'TEST1001', kcmc: '测试高等数学', xf: '4.0', zcj: '在修', xwk: '在修', kcsx: '必修', kcxz: '理论课' }] });
  return { xsnj: '2026', xsyx: '测试学院', xszy: '测试专业', xsbj: '测试班261', dqfa: '测试培养方案', dqfappd: '0.0%', xywcqkTableDtoList: [module('公共必修课', 56, 34), module('专业核心课', 14, 0)] };
}

export function writeSzjwFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'njau-szjw-fixtures-'));
  mkdirSync(dir, { recursive: true });
  const write = (url, data) => writeFileSync(join(dir, fixtureKey(url)), JSON.stringify(ok(data)));
  write(`${API}/qsmart/common/sessionUserInfo`, { id: 'stu-0001', userAccount: '20260001', userNameZh: '测试同学', businessId: 'biz-0001', department_name: '测试学院' });
  write(`${API}/jsxsd/xjgl/xsxx/xsjbxx/detailBhzxjh?xsxxid=stu-0001`, { zxjhid: 'plan-0001', zxjhmc: '测试培养方案', nj: '2026', zymc: '测试专业', bjmc: '测试班261', dwmc: '测试学院', xqmc: '卫岗校区' });
  write(`${API}/jsxsd/jczy/jxxnxq/dqxnxq`, { id: TERM, xnxqmc: TERM, dqxqflag: '1', qsskz: 1, zzskz: 19, xqqssj: START, xqzzsj: '2027-01-10' });
  write(`${API}/jsxsd/jczy/jxxnxq/select`, [{ id: TERM, xnxqmc: TERM, dqxqflag: '1' }, { id: '2025-2026-2', xnxqmc: '2025-2026-2', dqxqflag: '0' }]);
  write(`${API}/jsxsd/jczy/jxjxxl/getByXnxq?xnxqid=${TERM}`, calendar());
  write(`${API}/jsxsd/pkgl/kbsjsz/kbsjJcmxDetail?kbjcmsid=1&xnxqid=${TERM}`, sections());
  write(`${API}/jsxsd/xsd/pkgl/grkbcx/queryGrkbxx`, timetable());
  write(`${API}/jsxsd/xsd/pkgl/grkbcx/wpkjxrw`, [{ kcmc: '测试实践周', kcbh: 'TEST9001', kkzc: '1-8', xf: 1, skbj: '测试班261' }]);
  write(`${API}/jsxsd/rcyx/jstkgl/querKbbd?xnxqid=${TERM}`, [{ kcmc: '测试经济学', kcbh: 'TEST1002', tkfs: '集体调课', tklxmc: '部分调课', ykkzc: '6', yjc: '星期三0304节', yskdd: '甲楼102', xkkzc: '6', xjc: '星期六0304节', xskdd: '甲楼102', xkssj: '09:50', xjssj: '11:25', ggshztmc: '通过', sqrq: 1790642964000, sfzjh: 'SHOULD-BE-STRIPPED' }]);
  write(`${API}/jsxsd/xkgl/wdxk/query`, { rowCount: 1, items: [{ kcmc: '测试经济学', kcbh: 'TEST1002', kth: '1', xf: 3, xs: 48, skjs: '李老师', kkzc: '4-16', sksj: '4-16周星期三0304节', skdd: '甲楼102', kcsx: '必修', xdfs: '首修', xkfs: '个人选课', xkqk: '选中', jgJgDetailDtos: [{ sfzjh: 'SHOULD-BE-STRIPPED' }] }] });
  write(`${API}/jsxsd/rcyx/jsjygl/kxjszl`, rooms());
  write(`${API}/jsxsd/jczy/xxjxl/select`, [{ id: 'b1', jzwmc: '甲楼', xqid: '01', xqmc: '卫岗校区' }]);
  write(`${API}/jsxsd/xjgl/xywcqk/details`, progress());
  write(`${API}/jsxsd/zxjhkc/zxjhKcXsdQuery`, { rowCount: 2, items: [{ xnxqid: '2026-2027-2', kcbm: 'TEST2001', kcmc: '测试程序设计', xf: 3, zxs: 64, kctxljmc: '公共必修课', kcsxname: '必修', kclbname: '公共课', kkdwmc: '测试学院', khfsname: '闭卷笔试', xwkcname: '否' }, { xnxqid: '2027-2028-1', kcbm: 'TEST3001', kcmc: '测试核心课', xf: 2, zxs: 32, kctxljmc: '专业核心课', kcsxname: '必修', xwkcname: '是' }] });
  write(`${API}/jsxsd/cjgl/cjglcjzk/querywdcj`, {
    rowCount: 4,
    items: [
      { kcxx: '[TEST1001]测试高等数学', xf: 5, cjxzmc: '正常考试', zcj: '92', jd: 4.2, zsxnxqmc: '2025-2026-1', kclbmc: '公共基础课', kcsxmc: '必修' },
      { kcxx: '[TEST1002]测试经济学', xf: 3, cjxzmc: '正常考试', zcj: '78', jd: 2.8, zsxnxqmc: '2025-2026-1', kclbmc: '学科基础课', kcsxmc: '必修' },
      { kcxx: '[TEST1003]测试体育', xf: 1, cjxzmc: '正常考试', zcj: '良好', jd: 3.5, zsxnxqmc: '2025-2026-1', kclbmc: '公共必修课', kcsxmc: '必修' },
      { kcxx: '[TEST1005]测试法治', xf: 3, cjxzmc: '正常考试', zcj: '55', jd: 0, cjbzmc: '不及格', zsxnxqmc: '2025-2026-2', kclbmc: '公共必修课', kcsxmc: '必修' }
    ]
  });
  write(`${API}/jsxsd/kwgl/ksrw/queryKsap`, [
    { kcmc: '测试高等数学', kcbh: 'TEST1001', ksrq: '2027-01-05', kssj: '2027-01-05 09:00', jssj: '2027-01-05 11:00', ksdd: '甲楼101', xqmc: '卫岗校区', zwh: '17', kslxmc: '期末考试' },
    { kcmc: '测试经济学', kcbh: 'TEST1002', ksrq: '2026-11-20', kssj: '2026-11-20 14:00', jssj: '2026-11-20 16:00', ksdd: '甲楼102', xqmc: '卫岗校区', zwh: '3', kslxmc: '期中考试' },
    { kcmc: '测试旧考试', kcbh: 'TEST0001', ksrq: '2026-10-01', kssj: '2026-10-01 09:00', ksdd: '甲楼103', zwh: '1', kslxmc: '补考' }
  ]);
  return dir;
}
