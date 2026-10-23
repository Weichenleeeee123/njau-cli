import { CliError } from './errors.js';

const TIME_ZONE = 'Asia/Shanghai';

// YYYY-MM-DD in China time, regardless of the machine's time zone. NJAU_NOW overrides "now"
// for tests and reproducible agent evals.
export function today(now = currentDate()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function nowTime(now = currentDate()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

export function currentDate() {
  return process.env.NJAU_NOW ? new Date(process.env.NJAU_NOW) : new Date();
}

export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// 1 = Monday ... 7 = Sunday
export function weekdayOf(date) {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

// Accepts YYYY-MM-DD, today, tomorrow, yesterday, +N / -N, 今天/明天/后天/昨天.
export function resolveDate(input, now = currentDate()) {
  const base = today(now);
  if (input === undefined || input === null || input === '') {
    return base;
  }
  const value = String(input).trim().toLowerCase();
  const relative = { today: 0, '今天': 0, tomorrow: 1, '明天': 1, '后天': 2, yesterday: -1, '昨天': -1 };
  if (value in relative) {
    return addDays(base, relative[value]);
  }
  if (/^[+-]\d+$/.test(value)) {
    return addDays(base, Number(value));
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (/^\d{1,2}-\d{1,2}$/.test(value)) {
    return resolveDate(`${base.slice(0, 4)}-${value}`, now);
  }
  throw new CliError('INVALID_ARGUMENT', `Unrecognized date: ${input}`, { hint: 'Use YYYY-MM-DD, MM-DD, today, tomorrow or +N.' });
}

export function parseWeekday(input) {
  if (input === undefined || input === null || input === '') {
    return undefined;
  }
  const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
  const value = String(input).trim().toLowerCase().replace(/^(星期|周|礼拜)/, '');
  const number = Number(value) || map[value] || map[value.slice(0, 3)];
  if (!number || number < 1 || number > 7) {
    throw new CliError('INVALID_ARGUMENT', `Unrecognized weekday: ${input}`, { hint: 'Use 1-7, 周一..周日 or mon..sun.' });
  }
  return number;
}
