// Calendar arithmetic uses UTC day numbers, never elapsed local-time hours.
const DAY = 86_400_000;
export const MIN_DATE = '1900-01-01';
export const MAX_DATE = '9999-12-31';
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateString = (day) => new Date(day * DAY).toISOString().slice(0, 10);
export const shiftDate = (date, days) => dateString(dayNumber(date) + days);

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_DATE || value > MAX_DATE) return false;
  const day = dayNumber(value);
  return Number.isFinite(day) && dateString(day) === value;
}

export function todayInZone(timeZone, now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone });
}

function numbers(value, allowed, label) {
  if (!Array.isArray(value) || !value.length || value.length > allowed.length || value.some((n) => !allowed.includes(n))) {
    throw new Error(`${label}을 선택해 주세요.`);
  }
  return [...new Set(value)].sort((a, b) => a - b);
}

export function normalizeSchedule(input) {
  const { startDate, endDate = null, timeZone = 'Asia/Seoul', rule } = input ?? {};
  if (!validDate(startDate)) throw new Error('시작일을 올바르게 입력해 주세요.');
  if (endDate !== null && (!validDate(endDate) || endDate < startDate)) throw new Error('종료일은 시작일 이후여야 해요.');
  if (typeof timeZone !== 'string') throw new Error('시간대가 올바르지 않아요.');
  try { todayInZone(timeZone); } catch { throw new Error('시간대가 올바르지 않아요.'); }
  if (!rule || !['daily', 'weekly', 'monthly'].includes(rule.frequency)) throw new Error('반복 주기를 선택해 주세요.');
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999) throw new Error('반복 간격은 1~999 사이의 정수로 입력해 주세요.');
  const normalized = { frequency: rule.frequency, interval: rule.interval };
  const weekdays = [1, 2, 3, 4, 5, 6, 7];
  if (rule.frequency === 'weekly') normalized.weekdays = numbers(rule.weekdays, weekdays, '요일');
  if (rule.frequency === 'monthly') {
    if (!['dates', 'weekdays'].includes(rule.monthMode)) throw new Error('월별 반복 방식을 선택해 주세요.');
    normalized.monthMode = rule.monthMode;
    if (rule.monthMode === 'dates') {
      normalized.monthDays = numbers(rule.monthDays, [-1, ...Array.from({ length: 31 }, (_, i) => i + 1)], '날짜');
      if (!['skip', 'lastDay'].includes(rule.overflow)) throw new Error('없는 날짜의 처리 방식을 선택해 주세요.');
      normalized.overflow = rule.overflow;
    } else {
      normalized.ordinals = numbers(rule.ordinals, [-1, 1, 2, 3, 4, 5], '몇째 주인지');
      normalized.weekdays = numbers(rule.weekdays, weekdays, '요일');
    }
  }
  return { startDate, endDate, timeZone, rule: normalized };
}

/** Sorted unique occurrences; jumps directly to the requested period. */
export function* occurrences(spec, from = spec.startDate, to = MAX_DATE) {
  from = [from, spec.startDate, MIN_DATE].sort().at(-1);
  to = [to, spec.endDate ?? MAX_DATE, MAX_DATE].sort()[0];
  if (from > to) return;
  const first = dayNumber(from), last = dayNumber(to), anchor = dayNumber(spec.startDate);
  const rule = spec.rule;
  if (rule.frequency === 'daily') {
    for (let day = anchor + Math.ceil((first - anchor) / rule.interval) * rule.interval; day <= last; day += rule.interval) {
      yield dateString(day);
    }
  } else if (rule.frequency === 'weekly') {
    const weekday = (new Date(anchor * DAY).getUTCDay() + 6) % 7;
    const monday = anchor - weekday;
    const span = rule.interval * 7;
    let week = monday + Math.floor((first - monday) / span) * span;
    for (; week <= last; week += span) {
      for (const wd of rule.weekdays) {
        const day = week + wd - 1;
        if (day >= first && day <= last) yield dateString(day);
      }
    }
  } else {
    const start = new Date(anchor * DAY), lower = new Date(first * DAY), upper = new Date(last * DAY);
    const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const fromMonth = lower.getUTCFullYear() * 12 + lower.getUTCMonth();
    const toMonth = upper.getUTCFullYear() * 12 + upper.getUTCMonth();
    let month = startMonth + Math.ceil((fromMonth - startMonth) / rule.interval) * rule.interval;
    for (; month <= toMonth; month += rule.interval) {
      const year = Math.floor(month / 12), m = month % 12;
      const length = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
      const dates = new Set();
      if (rule.monthMode === 'dates') {
        for (const d of rule.monthDays) {
          if (d === -1) dates.add(length);
          else if (d <= length) dates.add(d);
          else if (rule.overflow === 'lastDay') dates.add(length);
        }
      } else {
        const firstWd = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7 + 1;
        const lastWd = (new Date(Date.UTC(year, m, length)).getUTCDay() + 6) % 7 + 1;
        for (const ordinal of rule.ordinals) {
          for (const wd of rule.weekdays) {
            const date = ordinal === -1
              ? length - ((lastWd - wd + 7) % 7)
              : 1 + ((wd - firstWd + 7) % 7) + 7 * (ordinal - 1);
            if (date <= length) dates.add(date);
          }
        }
      }
      for (const date of [...dates].sort((a, b) => a - b)) {
        const day = Date.UTC(year, m, date) / DAY;
        if (day >= first && day <= last) yield dateString(day);
      }
    }
  }
}
