// 반복 일정 규칙을 다루는 순수 함수들 (Flutter 의 models/routine.dart 를 옮긴 것).
import { isoWeekday, weekdayNames } from './date';
import type { RoutineRule } from './models';

export const ordinalNames: Record<number, string> = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째', [-1]: '마지막' };

/** 모든 칸이 채워진 규칙. 폼은 이 모양으로 들고 있다가 보낼 때 `ruleToJson` 으로 필요한 칸만 남긴다. */
export type FullRule = Required<RoutineRule>;

/** 서버가 비워 보낸 칸을 Flutter `RoutineRule.fromJson` 과 같은 기본값으로 채운다. */
export function normalizeRule(rule: RoutineRule): FullRule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: rule.weekdays ?? [1],
    monthMode: rule.monthMode ?? 'dates',
    monthDays: rule.monthDays ?? [1],
    ordinals: rule.ordinals ?? [1],
    overflow: rule.overflow ?? 'skip',
  };
}

/** 서버에 보낼 규칙. 고른 주기·방식에 쓰이는 칸만 담는다 (Flutter `toJson` 과 같은 모양·순서). */
export function ruleToJson(rule: RoutineRule): RoutineRule {
  const r = normalizeRule(rule);
  const json: RoutineRule = { frequency: r.frequency, interval: r.interval };
  if (r.frequency === 'weekly' || (r.frequency === 'monthly' && r.monthMode === 'weekdays')) json.weekdays = r.weekdays;
  if (r.frequency === 'monthly') {
    json.monthMode = r.monthMode;
    if (r.monthMode === 'dates') {
      json.monthDays = r.monthDays;
      json.overflow = r.overflow;
    } else {
      json.ordinals = r.ordinals;
    }
  }
  return json;
}

/** 월별 날짜 칩의 이름. -1 은 마지막 날. */
export const monthDayLabel = (d: number) => (d === -1 ? '마지막 날' : `${d}일`);

/** 목록·미리보기에 보여줄 한 줄 요약. 예: `매주 월·수`, `2개월마다 첫째·마지막 금요일`. */
export function ruleSummary(rule: RoutineRule): string {
  const r = normalizeRule(rule);
  const days = r.weekdays.map((d) => weekdayNames[d - 1]).join('·');
  if (r.frequency === 'daily') return r.interval === 1 ? '매일' : `${r.interval}일마다`;
  if (r.frequency === 'weekly') return `${r.interval === 1 ? '매주' : `${r.interval}주마다`} ${days}`;
  const prefix = r.interval === 1 ? '매월' : `${r.interval}개월마다`;
  if (r.monthMode === 'dates') return `${prefix} ${r.monthDays.map(monthDayLabel).join('·')}`;
  return `${prefix} ${r.ordinals.map((n) => ordinalNames[n]).join('·')} ${days}요일`;
}

/** 중복을 없애고 오름차순으로 (Flutter 의 Set → toList()..sort() 와 같다). */
export const sortedUnique = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

/** 칩을 눌렀을 때: 있으면 빼고, 없으면 넣는다. */
export const toggleValue = (values: number[], value: number) =>
  values.includes(value) ? values.filter((v) => v !== value) : sortedUnique([...values, value]);

/** 반복 간격 입력: 숫자만, 최대 3자리. */
export const sanitizeInterval = (text: string) => text.replace(/\D/g, '').slice(0, 3);

/** 입력 문자열을 간격 숫자로. 비었거나 숫자가 아니면 0 (서버가 거절하고 미리보기에 이유가 뜬다). */
export const parseInterval = (text: string) => (/^\d+$/.test(text) ? Number.parseInt(text, 10) : 0);

/** 미리보기 칩: `YYYY-MM-DD (요일)`. */
export const previewDateLabel = (date: string) => `${date} (${weekdayNames[isoWeekday(date) - 1]})`;

/** `2026-01-01부터 · 종료일 없음` / `2026-01-01부터 · 2026-12-31까지`. */
export const periodLabel = (startDate: string, endDate: string | null) =>
  `${startDate}부터 · ${endDate == null ? '종료일 없음' : `${endDate}까지`}`;

export const timeZoneLabel = (timeZone: string) =>
  `날짜 기준: ${timeZone === 'Asia/Seoul' ? '한국 시간 (Asia/Seoul)' : timeZone}`;

export const frequencyUnit = (frequency: RoutineRule['frequency']) =>
  frequency === 'weekly' ? '주마다' : frequency === 'monthly' ? '개월마다' : '일마다';
