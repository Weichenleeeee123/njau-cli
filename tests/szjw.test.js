import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseWeekday, resolveDate } from '../src/core/time.js';
import { buildIcs } from '../src/modules/szjw/ics.js';
import {
  compressRanges,
  expandRanges,
  filterCourses,
  locateDate,
  normalizeCalendar,
  normalizeChange,
  normalizeCourse,
  normalizeGrade,
  normalizeProgress,
  roomOccupancy,
  stripSensitive,
  summarizeGrades
} from '../src/modules/szjw/parsers.js';
import { calendar, progress, rooms, timetable, writeSzjwFixtures } from './fixtures/szjw-synthetic.js';
import { runCli } from './helpers.js';

const env = { NJAU_MOCK_DIR: writeSzjwFixtures(), NJAU_NOW: '2026-10-23T03:00:00Z' };

test('ranges expand and compress', () => {
  assert.deepEqual(expandRanges('1-3,5,7-9'), [1, 2, 3, 5, 7, 8, 9]);
  assert.deepEqual(expandRanges('1-6单'), [1, 3, 5]);
  assert.equal(compressRanges([5, 1, 2, 3, 9, 8]), '1-3,5,8-9');
});

test('dates and weekdays resolve in China time', () => {
  assert.equal(resolveDate('tomorrow', new Date('2026-10-23T17:00:00Z')), '2026-10-25');
  assert.equal(resolveDate('+2', new Date('2026-10-23T03:00:00Z')), '2026-10-25');
  assert.equal(resolveDate('10-1', new Date('2026-10-23T03:00:00Z')), '2026-10-01');
  assert.equal(parseWeekday('周五'), 5);
  assert.equal(parseWeekday('sun'), 7);
  assert.throws(() => parseWeekday('周八'), { code: 'INVALID_ARGUMENT' });
});

test('calendar locates teaching week, weekday and holidays', () => {
  const cal = normalizeCalendar(calendar());
  assert.equal(cal.startDate, '2026-08-31');
  assert.deepEqual(locateDate(cal, '2026-10-23'), { week: 8, weekday: 5, holiday: false, inTerm: true });
  assert.equal(locateDate(cal, '2026-10-01').holiday, true);
  assert.equal(locateDate(cal, '2027-03-01').inTerm, false);
});

test('timetable rows normalize weeks, sections and times', () => {
  const courses = timetable().map(normalizeCourse);
  const evening = courses.find((course) => course.code === 'TEST1004');
  assert.equal(evening.weekday, 5);
  assert.deepEqual(evening.sections, [10, 11, 12]);
  assert.equal(evening.sectionsText, '10-12');
  assert.equal(evening.startTime, '19:00');
  assert.equal(evening.weeks.length, 10);
  assert.deepEqual(courses.find((course) => course.code === 'TEST1002').teachers, ['李老师', '王老师']);
  const friday = filterCourses(courses, { week: 8, weekday: 5 }).map((course) => course.code);
  assert.deepEqual(friday, ['TEST1003', 'TEST1004']);
  assert.deepEqual(filterCourses(courses, { week: 3, weekday: 5 }), []);
});

test('grades normalize and GPA is credit weighted', () => {
  const grades = [
    { kcxx: '[A1]甲', xf: 5, zcj: '92', jd: 4.2, zsxnxqmc: 't1' },
    { kcxx: '[A2]乙', xf: 3, zcj: '优秀', jd: 4.5, zsxnxqmc: 't1' },
    { kcxx: '[A3]丙', xf: 2, zcj: '55', jd: 0, zsxnxqmc: 't2' }
  ].map(normalizeGrade);
  assert.equal(grades[0].code, 'A1');
  assert.equal(grades[0].course, '甲');
  assert.equal(grades[1].passed, true);
  assert.equal(grades[2].passed, false);
  const summary = summarizeGrades(grades);
  assert.equal(summary.credits, 10);
  assert.equal(summary.gpa, 3.45);
  assert.equal(summary.earnedCredits, 8);
  assert.equal(summary.weightedAverageScore, Number(((5 * 92 + 2 * 55) / 7).toFixed(2)));
});

test('progress summary maps module credits', () => {
  const result = normalizeProgress(progress());
  assert.equal(result.modules[0].required, 56);
  assert.equal(result.modules[0].remaining, 22);
  assert.equal(result.modules[0].status, '未达成');
  assert.equal(result.totals.required, 70);
});

test('room occupancy honours week ranges', () => {
  const [busy, free] = rooms().items;
  assert.equal(roomOccupancy(busy, { week: 8, weekday: 5, sections: [3, 4] }).length, 2);
  assert.equal(roomOccupancy(busy, { week: 2, weekday: 5, sections: [3, 4] }).length, 0);
  assert.equal(roomOccupancy(free, { week: 8, weekday: 5, sections: [3, 4] }).length, 0);
});

test('stripSensitive removes personal fields', () => {
  const clean = stripSensitive({ kcmc: 'x', jgJgDetailDtos: [{ sfzjh: '1' }], nested: { sfzjh: '2', ok: 1 } });
  assert.deepEqual(clean, { kcmc: 'x', nested: { ok: 1 } });
  const change = normalizeChange({ kcmc: 'x', sfzjh: '1', xjc: '星期六0304节' });
  assert.equal(JSON.stringify(change).includes('sfzjh'), false);
});

test('ics export produces one event per teaching week', () => {
  const course = normalizeCourse(timetable()[3]);
  const { text, events } = buildIcs([course], normalizeCalendar(calendar()), { reminder: 10 });
  assert.equal(events, 10);
  assert.match(text, /DTSTART;TZID=Asia\/Shanghai:20261016T190000/);
  assert.match(text, /TRIGGER:-PT10M/);
  assert.match(text, /\r\nEND:VCALENDAR\r\n$/);
});

test('CLI me and term current (mock backend)', () => {
  const me = runCli(['me'], env);
  assert.equal(me.status, 0, me.stdout);
  assert.equal(me.json.data.studentId, '20260001');
  const term = runCli(['term', 'current'], env);
  assert.equal(term.json.data.today.week, 8);
});

test('CLI course today / week / next (mock backend)', () => {
  const todayResult = runCli(['course', 'today'], env);
  assert.equal(todayResult.status, 0, todayResult.stdout);
  assert.equal(todayResult.json.data.week, 8);
  assert.deepEqual(todayResult.json.data.courses.map((course) => course.code), ['TEST1003', 'TEST1004']);
  const week = runCli(['course', 'week'], env);
  assert.equal(week.json.data.week, 8);
  assert.equal(week.json.data.totalCourses, 4);
  const next = runCli(['course', 'next'], env);
  assert.equal(next.json.data.code, 'TEST1003');
  assert.equal(next.json.data.ongoing, true);
  const evening = runCli(['course', 'next'], { ...env, NJAU_NOW: '2026-10-23T06:00:00Z' });
  assert.equal(evening.json.data.code, 'TEST1004');
  assert.equal(evening.json.data.ongoing, false);
  const monday = runCli(['course', 'today', '--date', '2026-10-19'], env);
  assert.deepEqual(monday.json.data.courses.map((course) => course.code), ['TEST1001']);
});

test('CLI course list merges rows and reports unscheduled tasks', () => {
  const result = runCli(['course', 'list'], env);
  assert.equal(result.json.data.total, 4);
  assert.equal(result.json.data.unscheduled[0].name, '测试实践周');
});

test('CLI grade gpa, exam list and selection strip data (mock backend)', () => {
  const gpa = runCli(['grade', 'gpa'], env);
  assert.equal(gpa.json.data.terms.length, 2);
  assert.equal(gpa.json.data.overall.failed, 1);
  const exams = runCli(['exam', 'list', '--upcoming'], env);
  assert.deepEqual(exams.json.data.items.map((exam) => exam.course), ['测试经济学', '测试高等数学']);
  assert.equal(exams.json.data.items[0].seat, '3');
  const selection = runCli(['selection', 'list'], env);
  assert.equal(selection.stdout.includes('SHOULD-BE-STRIPPED'), false);
  const changes = runCli(['course', 'changes'], env);
  assert.equal(changes.stdout.includes('SHOULD-BE-STRIPPED'), false);
});

test('CLI classroom free and course export (mock backend)', () => {
  const free = runCli(['classroom', 'free', '--week', '8', '--weekday', '5', '--sections', '3-4'], env);
  assert.equal(free.status, 0, free.stdout);
  assert.deepEqual(free.json.data.items.map((room) => room.name), ['甲楼102', '甲楼103']);
  const big = runCli(['classroom', 'free', '--date', '2026-10-23', '--sections', '1', '--min-seats', '50'], env);
  assert.deepEqual(big.json.data.items.map((room) => room.name), ['甲楼101', '甲楼102']);
  const out = join(mkdtempSync(join(tmpdir(), 'njau-ics-')), 'kb.ics');
  const exported = runCli(['course', 'export', '--out', out], env);
  assert.equal(exported.json.data.events, 16 + 13 + 13 + 10);
  assert.match(readFileSync(out, 'utf8'), /BEGIN:VCALENDAR/);
});

test('CLI plan list and progress summary (mock backend)', () => {
  const plan = runCli(['plan', 'list', '--module', '核心'], env);
  assert.equal(plan.json.data.items[0].code, 'TEST3001');
  const summary = runCli(['progress', 'summary'], env);
  assert.equal(summary.json.data.modules.length, 2);
});

test('CLI returns LOGIN_REQUIRED when the session expired', () => {
  const result = runCli(['course', 'today'], { ...env, NJAU_MOCK_LOGGED_OUT: '1' });
  assert.equal(result.status, 11);
  assert.equal(result.json.error.code, 'LOGIN_REQUIRED');
  assert.match(result.json.error.hint, /auth login/);
});
