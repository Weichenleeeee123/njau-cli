import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { CliError } from '../core/errors.js';
import { addDays, nowTime, parseWeekday, resolveDate, today } from '../core/time.js';
import { buildIcs } from '../modules/szjw/ics.js';
import {
  compressRanges,
  datesOfWeek,
  expandRanges,
  filterCourses,
  locateDate,
  mergeCourseRows,
  normalizeCalendar,
  normalizeChange,
  normalizeCourse,
  normalizeExam,
  normalizeGrade,
  normalizePlanCourse,
  normalizeProgress,
  normalizeRoom,
  normalizeSections,
  normalizeSelection,
  normalizeTerm,
  normalizeUnscheduled,
  progressCourses,
  roomOccupancy,
  stripSensitive,
  summarizeGrades
} from '../modules/szjw/parsers.js';
import * as szjw from '../modules/szjw/service.js';
import { SZJW_ORIGIN, withSzjw } from '../modules/szjw/client.js';

const TERM = { term: { type: 'string', description: '学年学期，如 2026-2027-1；默认当前学期' } };
const SOURCE = `${SZJW_ORIGIN}/xsd/`;

async function loadTermContext(api, term) {
  const termId = await szjw.resolveTermId(api, term);
  const [calendarRaw, sectionsRaw] = await Promise.all([
    szjw.getCalendarRaw(api, termId),
    szjw.getSectionsRaw(api, termId)
  ]);
  return { termId, calendar: normalizeCalendar(calendarRaw), sections: normalizeSections(sectionsRaw) };
}

async function loadCourses(api, termId) {
  return (await szjw.getTimetableRaw(api, termId)).map(normalizeCourse);
}

function dayView(date, calendar, courses) {
  const where = locateDate(calendar, date);
  const list = where.week ? filterCourses(courses, { week: where.week, weekday: where.weekday }) : [];
  return {
    date,
    week: where.week,
    weekday: where.weekday,
    inTerm: where.inTerm,
    holiday: where.holiday,
    ...(where.note ? { note: where.note } : {}),
    courses: list.map(slim)
  };
}

function slim(course) {
  return {
    sections: course.sectionsText,
    startTime: course.startTime,
    endTime: course.endTime,
    name: course.name,
    location: course.location,
    campus: course.campus,
    teachers: course.teachers,
    weeks: course.weeksText,
    code: course.code,
    credit: course.credit
  };
}

export default [
  {
    name: 'me',
    summary: '当前登录学生的基本信息（学号、姓名、院系、专业、班级）',
    requiresLogin: true,
    run: () => withSzjw(async (api) => {
      const user = await szjw.getUser(api);
      const detail = await szjw.getStudentDetail(api, user).catch(() => null);
      return {
        studentId: user.userAccount ?? user.username,
        name: user.userNameZh,
        college: detail?.dwmc ?? user.department_name ?? null,
        major: detail?.zymc ?? null,
        className: detail?.bjmc ?? null,
        grade: detail?.nj ?? null,
        plan: detail?.zxjhmc ?? null,
        campus: detail?.xqmc ?? null
      };
    })
  },
  {
    name: 'term list',
    summary: '列出教务系统中的学年学期',
    requiresLogin: true,
    run: () => withSzjw(async (api) => ({ items: (await szjw.getTerms(api)).map(normalizeTerm) }))
  },
  {
    name: 'term current',
    summary: '当前学期、起止日期和教学周范围，以及今天是第几周',
    requiresLogin: true,
    run: () => withSzjw(async (api) => {
      const term = normalizeTerm(await szjw.getCurrentTerm(api));
      const calendar = normalizeCalendar(await szjw.getCalendarRaw(api, term.id));
      return { ...term, today: { date: today(), ...locateDate(calendar, today()) } };
    })
  },
  {
    name: 'calendar show',
    summary: '教学校历：每周对应的日期与节假日',
    requiresLogin: true,
    options: { ...TERM, days: { type: 'boolean', description: '输出逐日明细' } },
    run: ({ options }) => withSzjw(async (api) => {
      const { calendar } = await loadTermContext(api, options.term);
      const weeks = [];
      for (let week = calendar.firstWeek ?? 1; week <= (calendar.lastWeek ?? 0); week += 1) {
        const days = datesOfWeek(calendar, week);
        weeks.push({
          week,
          from: days[0]?.date ?? null,
          to: days.at(-1)?.date ?? null,
          holidays: days.filter((day) => day.holiday).map((day) => `${day.date}${day.note ? ` ${day.note}` : ''}`).join('；') || null
        });
      }
      return {
        termId: calendar.termId,
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        weeks,
        ...(calendar.events.length ? { events: calendar.events } : {}),
        ...(options.days ? { days: calendar.days } : {})
      };
    })
  },
  {
    name: 'calendar week',
    summary: '某天是第几教学周、星期几（默认今天）',
    requiresLogin: true,
    options: { date: { type: 'string', description: 'YYYY-MM-DD / today / tomorrow / +N' } },
    run: ({ options }) => withSzjw(async (api) => {
      const date = resolveDate(options.date);
      const { calendar } = await loadTermContext(api);
      const where = locateDate(calendar, date);
      return { date, ...where, termId: calendar.termId, weekDates: where.week ? datesOfWeek(calendar, where.week).map((day) => day.date) : [] };
    })
  },
  {
    name: 'course sections',
    summary: '每节课的上下课时间',
    requiresLogin: true,
    options: TERM,
    run: ({ options }) => withSzjw(async (api) => {
      const { termId, sections } = await loadTermContext(api, options.term);
      return { termId, items: sections };
    })
  },
  {
    name: 'course list',
    summary: '本学期个人课表（可按周次、星期筛选）',
    requiresLogin: true,
    options: {
      ...TERM,
      week: { type: 'number', min: 1, max: 30 },
      weekday: { type: 'string', description: '1-7 或 周一..周日' },
      detail: { type: 'boolean', description: '输出完整字段' }
    },
    run: ({ options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api, options.term);
      const [rows, unscheduled] = await Promise.all([
        szjw.getTimetableRaw(api, termId),
        szjw.getUnscheduledRaw(api, termId).catch(() => [])
      ]);
      const weekday = parseWeekday(options.weekday);
      let courses = rows.map(normalizeCourse);
      courses = options.week || weekday ? filterCourses(courses, { week: options.week, weekday }) : mergeCourseRows(courses);
      return {
        termId,
        ...(options.week ? { week: options.week } : {}),
        ...(weekday ? { weekday } : {}),
        total: courses.length,
        items: options.detail ? courses : courses.map((course) => ({ weekday: course.weekdayName, ...slim(course) })),
        unscheduled: unscheduled.map(normalizeUnscheduled),
        sourceUrl: SOURCE
      };
    })
  },
  {
    name: 'course today',
    summary: '某天的课程（默认今天），自动换算教学周',
    requiresLogin: true,
    options: { date: { type: 'string', description: 'YYYY-MM-DD / today / tomorrow / +N' } },
    run: ({ options }) => withSzjw(async (api) => {
      const date = resolveDate(options.date);
      const { termId, calendar } = await loadTermContext(api);
      return { termId, ...dayView(date, calendar, await loadCourses(api, termId)), sourceUrl: SOURCE };
    })
  },
  {
    name: 'course tomorrow',
    summary: '明天的课程',
    requiresLogin: true,
    run: () => withSzjw(async (api) => {
      const { termId, calendar } = await loadTermContext(api);
      return { termId, ...dayView(addDays(today(), 1), calendar, await loadCourses(api, termId)), sourceUrl: SOURCE };
    })
  },
  {
    name: 'course week',
    summary: '一周课表（默认本周），按天分组',
    requiresLogin: true,
    options: {
      week: { type: 'number', min: 1, max: 30 },
      date: { type: 'string', description: '取该日期所在周' },
      ...TERM
    },
    run: ({ options }) => withSzjw(async (api) => {
      const { termId, calendar } = await loadTermContext(api, options.term);
      const week = options.week ?? locateDate(calendar, resolveDate(options.date)).week;
      if (!week || week < 1) {
        throw new CliError('INVALID_ARGUMENT', 'The date is outside the term; pass --week.');
      }
      const courses = await loadCourses(api, termId);
      const days = [];
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        const date = datesOfWeek(calendar, week).find((day) => day.weekday === weekday)?.date ?? null;
        const list = filterCourses(courses, { week, weekday });
        if (list.length || weekday <= 5) {
          days.push({ weekday, date, courses: list.map(slim) });
        }
      }
      return { termId, week, days, totalCourses: days.reduce((sum, day) => sum + day.courses.length, 0), sourceUrl: SOURCE };
    })
  },
  {
    name: 'course next',
    summary: '接下来的一节课（今天剩余或之后最近一天）',
    requiresLogin: true,
    run: () => withSzjw(async (api) => {
      const { termId, calendar } = await loadTermContext(api);
      const courses = await loadCourses(api, termId);
      const now = nowTime();
      for (let offset = 0; offset < 21; offset += 1) {
        const date = addDays(today(), offset);
        const view = dayView(date, calendar, courses);
        const upcoming = view.courses.filter((course) => offset > 0 || (course.endTime ?? '99:99') > now);
        if (upcoming.length) {
          const next = upcoming[0];
          return {
            date,
            week: view.week,
            weekday: view.weekday,
            ongoing: offset === 0 && next.startTime <= now,
            ...next,
            laterToday: offset === 0 ? upcoming.slice(1) : undefined
          };
        }
      }
      return { date: null, message: '未来三周内没有课程。' };
    })
  },
  {
    name: 'course changes',
    summary: '调停课 / 课表变动记录',
    requiresLogin: true,
    options: TERM,
    run: ({ options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api, options.term);
      const items = (await szjw.getChangesRaw(api, termId)).map(normalizeChange);
      return { termId, total: items.length, items, sourceUrl: SOURCE };
    })
  },
  {
    name: 'course export',
    summary: '把本学期课表导出为 .ics 日历文件（可导入手机/Outlook 日历）',
    requiresLogin: true,
    options: {
      ...TERM,
      out: { type: 'string', description: '输出文件路径，默认 ./njau-<学期>.ics' },
      reminder: { type: 'number', min: 0, max: 1440, description: '提前 N 分钟提醒' }
    },
    run: ({ options }) => withSzjw(async (api) => {
      const { termId, calendar } = await loadTermContext(api, options.term);
      const courses = await loadCourses(api, termId);
      const { text, events } = buildIcs(courses, calendar, { reminder: options.reminder });
      const file = resolve(options.out ?? `njau-${termId}.ics`);
      await writeFile(file, text, 'utf8');
      return { termId, file, events, courses: mergeCourseRows(courses).length };
    })
  },
  {
    name: 'grade list',
    summary: '课程成绩（可按学期、仅最好成绩、仅不及格筛选）',
    requiresLogin: true,
    options: {
      term: { type: 'string', description: '学年学期，如 2025-2026-2；默认全部' },
      best: { type: 'boolean', description: '同一课程只显示最好成绩' },
      failed: { type: 'boolean', description: '只显示不及格' },
      keyword: { type: 'string', description: '课程编码/名称' }
    },
    run: ({ options }) => withSzjw(async (api) => {
      const rows = await szjw.getGradesRaw(api, { termId: options.term ?? '', best: options.best, failedOnly: options.failed, keyword: options.keyword ?? '' });
      const items = rows.map(normalizeGrade);
      return { term: options.term ?? 'all', total: items.length, summary: summarizeGrades(items), items, sourceUrl: SOURCE };
    })
  },
  {
    name: 'grade gpa',
    summary: '按学期和总体计算加权 GPA 与加权平均分',
    requiresLogin: true,
    options: { all: { type: 'boolean', description: '包含重修/补考的全部成绩（默认只取最好成绩）' } },
    run: ({ options }) => withSzjw(async (api) => {
      const items = (await szjw.getGradesRaw(api, { best: !options.all })).map(normalizeGrade);
      const byTerm = [...new Set(items.map((item) => item.term).filter(Boolean))].sort().map((term) => ({
        term,
        ...summarizeGrades(items.filter((item) => item.term === term))
      })).map(({ note, terms, ...rest }) => rest);
      const overall = summarizeGrades(items);
      return { overall, terms: byTerm, ...(items.length ? {} : { message: '暂无成绩记录。' }) };
    })
  },
  {
    name: 'exam list',
    summary: '考试安排（时间、地点、座位号）',
    requiresLogin: true,
    options: { ...TERM, upcoming: { type: 'boolean', description: '只看今天及以后的考试' } },
    run: ({ options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api, options.term);
      let items = (await szjw.getExamsRaw(api, termId)).map(normalizeExam);
      if (options.upcoming) {
        items = items.filter((item) => !item.date || item.date >= today());
      }
      items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime).localeCompare(String(b.startTime)));
      return { termId, total: items.length, items, ...(items.length ? {} : { message: '暂无考试安排。' }), sourceUrl: SOURCE };
    })
  },
  {
    name: 'selection list',
    summary: '本学期选课结果',
    requiresLogin: true,
    options: TERM,
    run: ({ options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api, options.term);
      const items = (await szjw.getSelectionsRaw(api, termId)).map(normalizeSelection);
      return {
        termId,
        total: items.length,
        credits: items.reduce((sum, item) => sum + (item.credit ?? 0), 0),
        items,
        sourceUrl: SOURCE
      };
    })
  },
  {
    name: 'plan list',
    summary: '执行培养方案的课程（可按学期、课程模块筛选）',
    requiresLogin: true,
    options: {
      term: { type: 'string', description: '建议修读学期，如 2026-2027-2' },
      module: { type: 'string', description: '课程体系关键字，如 专业核心' },
      keyword: { type: 'string' }
    },
    run: ({ options }) => withSzjw(async (api) => {
      let items = (await szjw.getPlanRaw(api)).map(normalizePlanCourse);
      if (options.term) {
        items = items.filter((item) => item.term === options.term);
      }
      if (options.module) {
        items = items.filter((item) => item.module?.includes(options.module));
      }
      if (options.keyword) {
        items = items.filter((item) => `${item.name}${item.code}`.includes(options.keyword));
      }
      items.sort((a, b) => String(a.term).localeCompare(String(b.term)) || String(a.module).localeCompare(String(b.module)));
      return { total: items.length, credits: items.reduce((sum, item) => sum + (item.credit ?? 0), 0), items };
    })
  },
  {
    name: 'progress summary',
    summary: '学业达成情况：各课程体系要求学分 / 已获 / 在修 / 还需',
    requiresLogin: true,
    run: () => withSzjw(async (api) => normalizeProgress(await szjw.getProgressRaw(api)))
  },
  {
    name: 'progress courses',
    summary: '学业达成中某课程体系下的课程明细',
    requiresLogin: true,
    options: {
      module: { type: 'string', description: '课程体系名称关键字，如 公共必修课' },
      status: { type: 'string', description: '按修读状态过滤，如 在修 / 未修 / 已修' }
    },
    run: ({ options }) => withSzjw(async (api) => {
      let items = progressCourses(await szjw.getProgressRaw(api), options.module);
      if (options.status) {
        items = items.filter((item) => String(item.status ?? '').includes(options.status) || String(item.score ?? '').includes(options.status));
      }
      return { total: items.length, items };
    })
  },
  {
    name: 'classroom buildings',
    summary: '校区与教学楼列表',
    requiresLogin: true,
    options: { campus: { type: 'string', description: '校区名称关键字，如 卫岗' } },
    run: ({ options }) => withSzjw(async (api) => {
      const buildings = await szjw.getBuildingsRaw(api);
      return {
        items: buildings
          .filter((item) => !options.campus || item.xqmc?.includes(options.campus))
          .map((item) => ({ id: item.id, name: item.jzwmc, campus: item.xqmc, campusId: item.xqid }))
      };
    })
  },
  {
    name: 'classroom free',
    summary: '查空教室：指定日期/周次、星期和节次，返回空闲教室',
    requiresLogin: true,
    options: {
      date: { type: 'string', description: '日期（自动换算周次和星期），默认今天' },
      week: { type: 'number', min: 1, max: 30 },
      weekday: { type: 'string' },
      sections: { type: 'string', default: '1-12', description: '节次范围，如 3-4 或 1-2,5' },
      campus: { type: 'string', description: '校区关键字，如 卫岗 / 浦口 / 滨江' },
      building: { type: 'string', description: '教学楼关键字，如 主楼 / 教三' },
      type: { type: 'string', description: '教室类型关键字，如 多媒体' },
      minSeats: { type: 'number', min: 0 },
      limit: { type: 'number', default: 50, min: 1 }
    },
    run: ({ options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api);
      const calendar = normalizeCalendar(await szjw.getCalendarRaw(api, termId));
      const date = options.week ? null : resolveDate(options.date);
      const where = date ? locateDate(calendar, date) : null;
      const week = options.week ?? where?.week;
      const weekday = parseWeekday(options.weekday) ?? where?.weekday;
      if (!week || !weekday) {
        throw new CliError('INVALID_ARGUMENT', 'Provide --date, or both --week and --weekday.');
      }
      const sections = expandRanges(options.sections);
      const buildings = await szjw.getBuildingsRaw(api);
      const building = options.building ? buildings.find((item) => item.jzwmc?.includes(options.building) && (!options.campus || item.xqmc?.includes(options.campus))) : null;
      if (options.building && !building) {
        throw new CliError('NOT_FOUND', `Building not found: ${options.building}`, {
          hint: 'Run `njau-cli classroom buildings` to list buildings.',
          details: { candidates: buildings.map((item) => `${item.xqmc} ${item.jzwmc}`).slice(0, 80) }
        });
      }
      const campusId = building?.xqid ?? (options.campus ? buildings.find((item) => item.xqmc?.includes(options.campus))?.xqid ?? '' : '');
      const rooms = await szjw.getRoomUsageRaw(api, { termId, campusId, buildingId: building?.id ?? '', week, weekday });
      const free = rooms
        .filter((room) => !options.type || room.jslx?.includes(options.type))
        .filter((room) => !options.minSeats || Number(room.yxzws) >= options.minSeats)
        .filter((room) => roomOccupancy(room, { week, weekday, sections }).length === 0)
        .map(normalizeRoom)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      return {
        termId,
        ...(date ? { date } : {}),
        week,
        weekday,
        sections: compressRanges(sections),
        campus: options.campus ?? null,
        building: building ? building.jzwmc : null,
        checkedRooms: rooms.length,
        total: free.length,
        items: free.slice(0, options.limit)
      };
    })
  },
  {
    name: 'classroom usage',
    summary: '查看某间教室在某周的占用情况',
    requiresLogin: true,
    args: ['room'],
    options: {
      week: { type: 'number', min: 1, max: 30 },
      date: { type: 'string' }
    },
    run: ({ args, options }) => withSzjw(async (api) => {
      const termId = await szjw.resolveTermId(api);
      const calendar = normalizeCalendar(await szjw.getCalendarRaw(api, termId));
      const week = options.week ?? locateDate(calendar, resolveDate(options.date)).week;
      const rooms = await szjw.getRoomUsageRaw(api, { termId, week, keyword: args.room });
      const room = rooms.find((item) => item.jsmc === args.room) ?? rooms[0];
      if (!room) {
        throw new CliError('NOT_FOUND', `Classroom not found: ${args.room}`);
      }
      const busy = [];
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        for (const item of roomOccupancy(room, { week, weekday, sections: expandRanges('1-12') })) {
          busy.push({ weekday, ...item });
        }
      }
      return { termId, week, room: normalizeRoom(room), total: busy.length, items: busy };
    })
  },
  {
    name: 'szjw notices',
    summary: '数智教务平台站内通知与待办',
    requiresLogin: true,
    run: () => withSzjw(async (api) => {
      const [notify, todo] = await Promise.all([szjw.getNotificationsRaw(api), szjw.getTodoRaw(api)]);
      return {
        unread: notify?.notread ?? 0,
        notices: stripSensitive(notify?.list ?? []),
        todoCount: todo?.notReadCount ?? 0,
        todo: stripSensitive(todo?.list ?? [])
      };
    })
  }
];
