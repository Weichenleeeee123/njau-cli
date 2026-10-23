// Pure normalizers for szjw (强智数智教学微服务平台) responses. No I/O here so they can be
// unit-tested with fixtures.

export const WEEKDAY_NAMES = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

// Fields that carry other people's personal data (teacher ID numbers, phones, …).
const SENSITIVE_KEYS = /^(sfzjh|sfzjlx.*|csrq|dh|sjh|lxfs|dzyx|zp|jgJgDetailDtos|xsJbxx.*|jtzz|txdz|yzbm|mz.*|zzmm.*|hyzk.*)$/i;

export function stripSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(stripSensitive);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.test(key))
      .map(([key, item]) => [key, stripSensitive(item)]));
  }
  return value;
}

export function listOf(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    for (const key of ['items', 'records', 'list', 'rows']) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }
  return [];
}

// ---------- terms / calendar / sections ----------

export function normalizeTerm(term) {
  return {
    id: term.id ?? term.xnxqmc,
    name: term.xnxqmc ?? term.id,
    current: String(term.dqxqflag) === '1',
    ...(term.xqqssj ? { startDate: term.xqqssj } : {}),
    ...(term.xqzzsj ? { endDate: term.xqzzsj } : {}),
    ...(term.qsskz ? { firstTeachingWeek: term.qsskz } : {}),
    ...(term.zzskz ? { lastTeachingWeek: term.zzskz } : {})
  };
}

export function normalizeSections(list) {
  return listOf(list)
    .filter((item) => String(item.xsflag ?? '1') === '1')
    .map((item) => ({
      index: Number.parseInt(item.jc1 ?? item.code ?? item.xh, 10),
      name: item.djmc ?? null,
      period: item.sjdbsmc ?? null,
      start: item.kssj ?? null,
      end: item.jssj ?? null
    }))
    .sort((a, b) => a.index - b.index);
}

export function normalizeCalendar(calendar) {
  const days = (calendar?.jxJxxlmxVoList ?? []).map((day) => ({
    date: day.mxrq,
    week: Number(day.zc),
    weekday: Number(day.weekdatecode),
    weekdayName: day.xqmc ?? WEEKDAY_NAMES[Number(day.weekdatecode)],
    holiday: String(day.jjrflag) === '1',
    ...(day.bz ? { note: day.bz } : {})
  }));
  const events = (calendar?.jxJxxlRcxxDtoList ?? []).map((event) => stripSensitive(event));
  return {
    termId: calendar?.xnxqid ?? null,
    firstWeek: calendar?.kszc ?? null,
    lastWeek: calendar?.jzzc ?? null,
    startDate: calendar?.ksrq ?? days[0]?.date ?? null,
    endDate: days.at(-1)?.date ?? null,
    days,
    events
  };
}

export function locateDate(calendar, date) {
  const day = calendar.days.find((item) => item.date === date);
  if (day) {
    return { week: day.week, weekday: day.weekday, holiday: day.holiday, inTerm: true, ...(day.note ? { note: day.note } : {}) };
  }
  if (calendar.startDate) {
    const diff = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${calendar.startDate}T00:00:00Z`)) / 86400000);
    const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return { week: Math.floor(diff / 7) + 1, weekday, holiday: false, inTerm: false };
  }
  return { week: null, weekday: ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1, holiday: false, inTerm: false };
}

export function datesOfWeek(calendar, week) {
  return calendar.days.filter((day) => day.week === week);
}

// ---------- courses ----------

export function parseNumberList(value) {
  return String(value ?? '')
    .split(/[,，\s]+/)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item));
}

// "1-3,5,7-9" -> [1,2,3,5,7,8,9]
export function expandRanges(value) {
  const result = [];
  for (const part of String(value ?? '').split(/[,，]/)) {
    const match = /^\s*(\d+)\s*(?:[-~]\s*(\d+))?\s*(单|双)?/.exec(part);
    if (!match) {
      continue;
    }
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    for (let item = start; item <= end; item += 1) {
      if (match[3] === '单' && item % 2 === 0) {
        continue;
      }
      if (match[3] === '双' && item % 2 === 1) {
        continue;
      }
      result.push(item);
    }
  }
  return result;
}

// [1,2,3,5] -> "1-3,5"
export function compressRanges(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) {
      j += 1;
    }
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return parts.join(',');
}

export function normalizeCourse(row) {
  const weekday = Number.parseInt(row.xq, 10) || null;
  const slots = parseNumberList(row.jcmx);
  const sections = slots.length ? slots.map((slot) => slot % 100) : sectionsFromJc(row.jc);
  const weeks = parseNumberList(row.kkzcMx).length ? parseNumberList(row.kkzcMx) : expandRanges(row.kkzc);
  return {
    name: row.kcmc,
    code: row.kcbh ?? null,
    teachers: splitNames(row.skjs),
    weekday,
    weekdayName: weekday ? WEEKDAY_NAMES[weekday] : null,
    weeks,
    weeksText: row.kkzc ?? compressRanges(weeks),
    sections,
    sectionsText: sections.length ? compressRanges(sections) : null,
    startTime: row.kssj ?? null,
    endTime: row.jssj ?? null,
    location: row.jsmc ?? null,
    building: row.jxlm ?? null,
    campus: row.xqmc ?? null,
    roomType: row.jslx ?? null,
    credit: numberOrNull(row.xf),
    hours: numberOrNull(row.zxs),
    property: row.kcsx ?? null,
    category: row.kclb ?? null,
    nature: row.kcxz ?? null,
    assessment: row.khfs ?? null,
    classes: row.skbj ?? null,
    enrolled: numberOrNull(row.skrs),
    teachingTaskId: row.jxrwId ?? row.jxrwid ?? null,
    ...(row.bz ? { note: row.bz } : {})
  };
}

function sectionsFromJc(jc) {
  // "1101112" = weekday 1, sections 10,11,12; "50304" = weekday 5, sections 3,4
  const text = String(jc ?? '');
  if (text.length < 3) {
    return [];
  }
  const body = text.slice(1);
  const result = [];
  for (let i = 0; i + 1 < body.length + 1; i += 2) {
    const value = Number.parseInt(body.slice(i, i + 2), 10);
    if (Number.isFinite(value)) {
      result.push(value);
    }
  }
  return result;
}

export function normalizeUnscheduled(row) {
  return {
    name: row.kcmc,
    code: row.kcbh ?? null,
    teachers: splitNames(row.skjs ?? row.jgmc),
    weeksText: row.kkzc ?? null,
    credit: numberOrNull(row.xf),
    hours: numberOrNull(row.zxs ?? row.xs),
    property: row.kcsx ?? null,
    classes: row.skbj ?? null,
    note: row.bz ?? '未排具体上课时间（由学院安排）'
  };
}

export function filterCourses(courses, { week, weekday } = {}) {
  return courses
    .filter((course) => week === undefined || week === null || course.weeks.includes(Number(week)))
    .filter((course) => weekday === undefined || weekday === null || course.weekday === Number(weekday))
    .sort(compareCourse);
}

export function compareCourse(a, b) {
  return (a.weekday ?? 9) - (b.weekday ?? 9)
    || (a.sections[0] ?? 99) - (b.sections[0] ?? 99)
    || String(a.startTime).localeCompare(String(b.startTime));
}

// Merges rows of the same course/slot that only differ by week ranges.
export function mergeCourseRows(courses) {
  const map = new Map();
  for (const course of courses) {
    const key = [course.teachingTaskId ?? course.name, course.weekday, course.sectionsText, course.location].join('|');
    const existing = map.get(key);
    if (existing) {
      existing.weeks = [...new Set([...existing.weeks, ...course.weeks])].sort((a, b) => a - b);
      existing.weeksText = compressRanges(existing.weeks);
    } else {
      map.set(key, { ...course, weeks: [...course.weeks] });
    }
  }
  return [...map.values()].sort(compareCourse);
}

// ---------- schedule changes (调停课) ----------

export function normalizeChange(row) {
  return {
    course: row.kcmc,
    code: row.kcbh ?? null,
    method: row.tkfs ?? null,
    kind: row.tklxmc ?? null,
    classes: row.skbj ?? null,
    from: {
      weeks: row.ykkzc ?? null,
      slot: row.yjc ?? null,
      location: row.yskdd ?? null,
      teacher: row.yjgmc ?? null
    },
    to: {
      weeks: row.xkkzc ?? null,
      slot: row.xjc ?? null,
      startTime: row.xkssj ?? null,
      endTime: row.xjssj ?? null,
      location: row.xskdd ?? null,
      teacher: row.xjgmc ?? null
    },
    reason: row.tkyy ?? row.sm ?? null,
    status: row.ggshztmc ?? null,
    appliedAt: row.sqrq ? new Date(Number(row.sqrq)).toISOString() : null,
    appliedBy: row.sqrdwmc ?? null
  };
}

// ---------- grades ----------

export function normalizeGrade(row) {
  const score = row.zcj ?? row.cj ?? null;
  return {
    course: parseCourseInfo(row.kcxx ?? row.kcmc).name,
    code: parseCourseInfo(row.kcxx ?? row.kcmc).code ?? row.kcbh ?? null,
    credit: numberOrNull(row.xf),
    score,
    numericScore: numberOrNull(score),
    gradePoint: numberOrNull(row.jd),
    kind: row.cjxzmc ?? null,
    flag: row.cjbzmc ?? null,
    term: row.zsxnxqmc ?? row.cxxnxq ?? row.xnxqmc ?? null,
    category: row.kclbmc ?? null,
    property: row.kcsxmc ?? null,
    generalCategory: row.tsklbmc ?? null,
    statNote: row.cjtjsm ?? null,
    ...(row.bz ? { note: row.bz } : {}),
    passed: isPassed(score, row.jd)
  };
}

function parseCourseInfo(value) {
  const text = String(value ?? '').trim();
  const match = /^\[([^\]]+)\]\s*(.+)$/.exec(text);
  return match ? { code: match[1], name: match[2] } : { code: null, name: text };
}

function isPassed(score, gradePoint) {
  const numeric = numberOrNull(score);
  if (numeric !== null) {
    return numeric >= 60;
  }
  if (/不及格|不合格|未通过|缺考|作弊/.test(String(score ?? ''))) {
    return false;
  }
  if (numberOrNull(gradePoint) === 0) {
    return false;
  }
  return score === null ? null : true;
}

// Credit-weighted GPA. Courses whose statNote says they are excluded (e.g. "不计入") are skipped.
export function summarizeGrades(grades) {
  const counted = grades.filter((grade) => grade.credit && grade.gradePoint !== null && !/不计|不参与/.test(grade.statNote ?? ''));
  const credits = counted.reduce((sum, grade) => sum + grade.credit, 0);
  const points = counted.reduce((sum, grade) => sum + grade.credit * grade.gradePoint, 0);
  const scored = counted.filter((grade) => grade.numericScore !== null);
  const scoredCredits = scored.reduce((sum, grade) => sum + grade.credit, 0);
  const terms = [...new Set(grades.map((grade) => grade.term).filter(Boolean))].sort();
  return {
    courses: grades.length,
    countedCourses: counted.length,
    credits: round(credits, 2),
    earnedCredits: round(grades.filter((grade) => grade.passed).reduce((sum, grade) => sum + (grade.credit ?? 0), 0), 2),
    gpa: credits ? round(points / credits, 3) : null,
    weightedAverageScore: scoredCredits ? round(scored.reduce((sum, grade) => sum + grade.credit * grade.numericScore, 0) / scoredCredits, 2) : null,
    failed: grades.filter((grade) => grade.passed === false).length,
    terms,
    note: 'GPA 由 njau-cli 按“学分×绩点 / 总学分”计算，仅供参考，以教务处认定为准。'
  };
}

// ---------- exams ----------

export function normalizeExam(row) {
  const clean = stripSensitive(row);
  return {
    course: row.kcmc ?? parseCourseInfo(row.kcxx).name,
    code: row.kcbh ?? parseCourseInfo(row.kcxx).code,
    date: row.ksrq ?? row.kssjrq ?? dateFrom(row.kssj) ?? null,
    startTime: timeFrom(row.kskssj ?? row.kssj) ?? null,
    endTime: timeFrom(row.ksjssj ?? row.jssj) ?? null,
    timeText: row.kssjms ?? row.kssjd ?? row.sjms ?? null,
    location: row.ksdd ?? row.jsmc ?? row.kcdd ?? null,
    campus: row.xqmc ?? null,
    seat: row.zwh ?? row.zw ?? null,
    type: row.kslxmc ?? row.kwglkslxname ?? row.kslx ?? null,
    method: row.ksfsmc ?? row.khfs ?? null,
    week: row.zc ?? row.kszc ?? null,
    raw: clean
  };
}

function dateFrom(value) {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

function timeFrom(value) {
  const match = /(\d{1,2}:\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

// ---------- course selection ----------

export function normalizeSelection(row) {
  return {
    name: row.kcmc,
    code: row.kcbh ?? null,
    classNo: row.kth ?? null,
    credit: numberOrNull(row.xf),
    hours: numberOrNull(row.xs),
    teachers: splitNames(row.skjs),
    weeksText: row.kkzc ?? null,
    time: row.sksj ?? null,
    location: row.skdd ?? null,
    property: row.kcsx ?? null,
    generalCategory: row.tsklb ?? null,
    studyMode: row.xdfs ?? null,
    selectionMode: row.xkfs ?? null,
    selectionType: row.xkfl ?? null,
    status: row.xkqk ?? null
  };
}

// ---------- training programme / progress ----------

export function normalizePlanCourse(row) {
  return {
    term: row.xnxqid ?? null,
    code: row.kcbm ?? null,
    name: row.kcmc,
    credit: numberOrNull(row.xf),
    hours: numberOrNull(row.zxs),
    module: row.kctxljmc ?? null,
    property: row.kcsxname ?? null,
    nature: row.kcxzname ?? null,
    category: row.kclbname ?? null,
    department: row.kkdwmc ?? null,
    assessment: row.khfsname ?? null,
    degreeCourse: row.xwkcname === '是',
    group: row.ssxxzmc ?? null
  };
}

const STATUS_TEXT = { achieved: '已达成', notAchieved: '未达成' };

export function normalizeProgress(data) {
  const modules = (data?.xywcqkTableDtoList ?? []).map((item) => ({
    id: item.pyfakctxid ?? item.kctxid ?? item.id,
    name: item.kctmc,
    required: numberOrNull(item.yqxf),
    obtained: numberOrNull(item.yhxf),
    inProgress: numberOrNull(item.zxxf),
    remaining: numberOrNull(item.hxxf),
    status: STATUS_TEXT[item.status] ?? item.status ?? null,
    courseCount: item.tableList?.length ?? 0
  }));
  const totals = modules.reduce((sum, item) => ({
    required: sum.required + (item.required ?? 0),
    obtained: sum.obtained + (item.obtained ?? 0),
    inProgress: sum.inProgress + (item.inProgress ?? 0),
    remaining: sum.remaining + (item.remaining ?? 0)
  }), { required: 0, obtained: 0, inProgress: 0, remaining: 0 });
  return {
    grade: data?.xsnj ?? null,
    college: data?.xsyx ?? null,
    major: data?.xszy ?? null,
    className: data?.xsbj ?? null,
    plan: data?.dqfa ?? null,
    matchRate: data?.dqfappd ?? null,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value, 1)])),
    modules
  };
}

export function progressCourses(data, moduleQuery) {
  const tables = data?.xywcqkTableDtoList ?? [];
  const selected = moduleQuery
    ? tables.filter((item) => item.kctmc?.includes(moduleQuery) || item.pyfakctxid === moduleQuery || item.kctxid === moduleQuery)
    : tables;
  return selected.flatMap((item) => (item.tableList ?? []).map((course) => ({
    module: item.kctmc,
    term: course.xnxq ?? null,
    code: course.kcbm ?? null,
    name: course.kcmc,
    credit: numberOrNull(course.xf),
    score: course.zcj ?? null,
    status: course.xwk ?? null,
    property: course.kcsx ?? null,
    nature: course.kcxz ?? null,
    replaced: Boolean(course.isTd),
    recognized: Boolean(course.isRd)
  })));
}

// ---------- classrooms ----------

const OCCUPANCY_TYPES = { zcsk: '上课', jy: '借用', ks: '考试', sd: '锁定', tk: '调课', qtkb: '其他课表模式' };

export function roomOccupancy(room, { week, weekday, sections }) {
  const busy = [];
  for (const section of sections) {
    const entry = room.detailsMap?.[String(weekday * 100 + section)];
    if (!entry) {
      continue;
    }
    for (const [type, items] of Object.entries(entry)) {
      for (const item of items ?? []) {
        const weeks = parseNumberList(item.kkzcMx).length ? parseNumberList(item.kkzcMx) : expandRanges(item.kkzc ?? item.zc ?? item.jyzc);
        if (!weeks.length || weeks.includes(Number(week))) {
          busy.push({
            section,
            type: OCCUPANCY_TYPES[type] ?? type,
            course: item.kcmc ?? item.jyyt ?? item.hdmc ?? null,
            weeks: item.kkzc ?? null,
            teacher: item.jgmc ?? null,
            classes: item.skbj ?? null
          });
        }
      }
    }
  }
  return busy;
}

export function normalizeRoom(room) {
  return {
    id: room.jsid,
    name: room.jsmc,
    type: room.jslx ?? null,
    seats: numberOrNull(room.yxzws),
    examSeats: numberOrNull(room.kszws)
  };
}

// ---------- helpers ----------

function splitNames(value) {
  return String(value ?? '').split(/[,，、]/).map((name) => name.trim()).filter(Boolean);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
