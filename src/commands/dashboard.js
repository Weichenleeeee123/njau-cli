import { addDays, nowTime, today } from '../core/time.js';
import { listNotices } from '../modules/notice.js';
import { withSzjw } from '../modules/szjw/client.js';
import {
  filterCourses,
  locateDate,
  normalizeCalendar,
  normalizeChange,
  normalizeCourse,
  normalizeExam
} from '../modules/szjw/parsers.js';
import * as szjw from '../modules/szjw/service.js';

const brief = (course) => ({
  time: `${course.startTime}-${course.endTime}`,
  sections: course.sectionsText,
  name: course.name,
  location: [course.campus, course.location].filter(Boolean).join(' ') || null,
  teachers: course.teachers
});

export default [
  {
    name: 'today',
    summary: '今日概览：今天/明天的课、下一节课、近期考试、调课和最新通知（适合 Agent 一次调用）',
    requiresLogin: true,
    options: {
      noticeDays: { type: 'number', default: 3, min: 0, description: '附带最近 N 天的公开通知，0 表示不取' }
    },
    run: async ({ options }) => {
      const date = today();
      const noticesPromise = options.noticeDays
        ? listNotices({ since: addDays(date, -options.noticeDays), limit: 10 }).catch((error) => ({ error: error.code ?? error.message, items: [] }))
        : Promise.resolve(null);

      const academic = await withSzjw(async (api) => {
        const termId = await szjw.resolveTermId(api);
        const [calendarRaw, rows, examsRaw, changesRaw] = await Promise.all([
          szjw.getCalendarRaw(api, termId),
          szjw.getTimetableRaw(api, termId),
          szjw.getExamsRaw(api, termId).catch(() => []),
          szjw.getChangesRaw(api, termId).catch(() => [])
        ]);
        const calendar = normalizeCalendar(calendarRaw);
        const courses = rows.map(normalizeCourse);
        const here = locateDate(calendar, date);
        const tomorrowDate = addDays(date, 1);
        const there = locateDate(calendar, tomorrowDate);
        const todayCourses = here.week ? filterCourses(courses, { week: here.week, weekday: here.weekday }) : [];
        const tomorrowCourses = there.week ? filterCourses(courses, { week: there.week, weekday: there.weekday }) : [];
        const now = nowTime();
        const remaining = todayCourses.filter((course) => (course.endTime ?? '99:99') > now);
        const exams = examsRaw.map(normalizeExam)
          .filter((exam) => exam.date && exam.date >= date && exam.date <= addDays(date, 14))
          .map(({ raw, ...exam }) => exam);
        const weekChanges = changesRaw.map(normalizeChange)
          .filter((change) => [change.from.weeks, change.to.weeks].some((weeks) => String(weeks ?? '').split(/[,，-]/).includes(String(here.week))));
        return {
          termId,
          week: here.week,
          weekday: here.weekday,
          holiday: here.holiday,
          today: todayCourses.map(brief),
          next: remaining[0] ? { ...brief(remaining[0]), ongoing: remaining[0].startTime <= now } : null,
          tomorrow: tomorrowCourses.map(brief),
          examsNext14Days: exams,
          changesThisWeek: weekChanges
        };
      });

      const notices = await noticesPromise;
      return {
        date,
        time: nowTime(),
        ...academic,
        ...(notices ? { notices: notices.items.map(({ title, date: noticeDate, url, sourceLabel }) => ({ title, date: noticeDate, source: sourceLabel, url })) } : {})
      };
    }
  }
];
