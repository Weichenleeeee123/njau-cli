import { addDays } from '../../core/time.js';

// Builds an iCalendar (RFC 5545) file from normalized courses and the term calendar.
export function buildIcs(courses, calendar, options = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//njau-cli//NJAU timetable//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name ?? `南农课表 ${calendar.termId ?? ''}`.trim())}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let count = 0;
  for (const course of courses) {
    if (!course.weekday || !course.startTime || !course.endTime) {
      continue;
    }
    for (const week of course.weeks) {
      const date = dateFor(calendar, week, course.weekday);
      if (!date) {
        continue;
      }
      count += 1;
      const day = date.replace(/-/g, '');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${hash(`${course.teachingTaskId ?? course.name}-${date}-${course.startTime}`)}@njau-cli`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Shanghai:${day}T${course.startTime.replace(':', '')}00`,
        `DTEND;TZID=Asia/Shanghai:${day}T${course.endTime.replace(':', '')}00`,
        `SUMMARY:${escapeText(course.name)}`,
        ...(course.location ? [`LOCATION:${escapeText([course.campus, course.location].filter(Boolean).join(' '))}`] : []),
        `DESCRIPTION:${escapeText([
          `第${week}周 ${course.weekdayName ?? ''} 第${course.sectionsText ?? ''}节`,
          course.teachers?.length ? `教师：${course.teachers.join('、')}` : null,
          course.code ? `课程号：${course.code}` : null,
          course.credit !== null && course.credit !== undefined ? `学分：${course.credit}` : null
        ].filter(Boolean).join('\n'))}`,
        ...(options.reminder ? [
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeText(course.name)}`,
          `TRIGGER:-PT${Number(options.reminder)}M`,
          'END:VALARM'
        ] : []),
        'END:VEVENT'
      );
    }
  }
  lines.push('END:VCALENDAR');
  return { text: `${lines.map(fold).join('\r\n')}\r\n`, events: count };
}

export function dateFor(calendar, week, weekday) {
  const day = calendar.days.find((item) => item.week === week && item.weekday === weekday);
  if (day) {
    return day.date;
  }
  if (!calendar.startDate) {
    return null;
  }
  return addDays(calendar.startDate, (week - 1) * 7 + (weekday - 1));
}

function escapeText(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) {
    return line;
  }
  const parts = [];
  let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function hash(value) {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
