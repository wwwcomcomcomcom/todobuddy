import { describe, expect, it } from 'vitest';
import {
  frequencyUnit, monthDayLabel, normalizeRule, ordinalNames, parseInterval, periodLabel, previewDateLabel, ruleSummary,
  ruleToJson, sanitizeInterval, sortedUnique, timeZoneLabel, toggleValue,
} from './routine';

describe('ruleToJson', () => {
  const full = {
    interval: 2,
    weekdays: [1, 3],
    monthMode: 'dates' as const,
    monthDays: [1, -1],
    ordinals: [2],
    overflow: 'lastDay' as const,
  };

  it('매일은 주기와 간격만 보낸다', () => {
    expect(ruleToJson({ ...full, frequency: 'daily' })).toEqual({ frequency: 'daily', interval: 2 });
  });

  it('매주는 요일을 함께 보낸다', () => {
    expect(ruleToJson({ ...full, frequency: 'weekly' })).toEqual({ frequency: 'weekly', interval: 2, weekdays: [1, 3] });
  });

  it('월별 날짜 방식은 날짜와 없는 달 처리를 보낸다', () => {
    const json = ruleToJson({ ...full, frequency: 'monthly' });
    expect(json).toEqual({ frequency: 'monthly', interval: 2, monthMode: 'dates', monthDays: [1, -1], overflow: 'lastDay' });
    expect(Object.keys(json)).toEqual(['frequency', 'interval', 'monthMode', 'monthDays', 'overflow']);
  });

  it('월별 몇째 요일 방식은 요일과 순번을 보낸다', () => {
    const json = ruleToJson({ ...full, frequency: 'monthly', monthMode: 'weekdays' });
    expect(json).toEqual({ frequency: 'monthly', interval: 2, weekdays: [1, 3], monthMode: 'weekdays', ordinals: [2] });
    expect(Object.keys(json)).toEqual(['frequency', 'interval', 'weekdays', 'monthMode', 'ordinals']);
  });

  it('빠진 칸은 Flutter fromJson 과 같은 기본값으로 채운다', () => {
    expect(ruleToJson({ frequency: 'monthly', interval: 1 })).toEqual({
      frequency: 'monthly', interval: 1, monthMode: 'dates', monthDays: [1], overflow: 'skip',
    });
  });
});

describe('normalizeRule', () => {
  it('기본값을 채우되 빈 배열은 그대로 둔다', () => {
    expect(normalizeRule({ frequency: 'daily', interval: 1 })).toEqual({
      frequency: 'daily', interval: 1, weekdays: [1], monthMode: 'dates', monthDays: [1], ordinals: [1], overflow: 'skip',
    });
    expect(normalizeRule({ frequency: 'weekly', interval: 1, weekdays: [] }).weekdays).toEqual([]);
  });
});

describe('ruleSummary', () => {
  it('매일 / N일마다', () => {
    expect(ruleSummary({ frequency: 'daily', interval: 1 })).toBe('매일');
    expect(ruleSummary({ frequency: 'daily', interval: 3 })).toBe('3일마다');
  });

  it('매주 / N주마다 + 요일', () => {
    expect(ruleSummary({ frequency: 'weekly', interval: 1, weekdays: [1, 3, 5] })).toBe('매주 월·수·금');
    expect(ruleSummary({ frequency: 'weekly', interval: 2, weekdays: [6, 7] })).toBe('2주마다 토·일');
  });

  it('매월 날짜 (마지막 날 포함)', () => {
    expect(ruleSummary({ frequency: 'monthly', interval: 1, monthMode: 'dates', monthDays: [1, 15] })).toBe('매월 1일·15일');
    expect(ruleSummary({ frequency: 'monthly', interval: 3, monthMode: 'dates', monthDays: [-1, 10] })).toBe('3개월마다 마지막 날·10일');
  });

  it('매월 몇째 요일', () => {
    expect(ruleSummary({ frequency: 'monthly', interval: 1, monthMode: 'weekdays', ordinals: [1, -1], weekdays: [5] })).toBe(
      '매월 첫째·마지막 금요일',
    );
    expect(ruleSummary({ frequency: 'monthly', interval: 2, monthMode: 'weekdays', ordinals: [2], weekdays: [1, 2] })).toBe(
      '2개월마다 둘째 월·화요일',
    );
  });
});

describe('보조 함수', () => {
  it('ordinalNames', () => {
    expect([1, 2, 3, 4, 5, -1].map((n) => ordinalNames[n])).toEqual(['첫째', '둘째', '셋째', '넷째', '다섯째', '마지막']);
  });

  it('monthDayLabel', () => {
    expect(monthDayLabel(7)).toBe('7일');
    expect(monthDayLabel(-1)).toBe('마지막 날');
  });

  it('sortedUnique / toggleValue 는 오름차순 집합처럼 동작한다', () => {
    expect(sortedUnique([5, 1, 5, -1])).toEqual([-1, 1, 5]);
    expect(toggleValue([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleValue([1, 3, 5], 3)).toEqual([1, 5]);
    expect(toggleValue([1], 1)).toEqual([]);
  });

  it('sanitizeInterval 은 숫자만 3자리까지 남긴다', () => {
    expect(sanitizeInterval('12a3')).toBe('123');
    expect(sanitizeInterval('1234')).toBe('123');
    expect(sanitizeInterval('-٣x')).toBe('');
  });

  it('parseInterval 은 비면 0', () => {
    expect(parseInterval('')).toBe(0);
    expect(parseInterval('007')).toBe(7);
    expect(parseInterval('999')).toBe(999);
  });

  it('previewDateLabel 은 요일을 붙인다', () => {
    expect(previewDateLabel('2026-10-08')).toBe('2026-10-08 (목)');
    expect(previewDateLabel('2026-10-11')).toBe('2026-10-11 (일)');
  });

  it('periodLabel', () => {
    expect(periodLabel('2026-01-01', null)).toBe('2026-01-01부터 · 종료일 없음');
    expect(periodLabel('2026-01-01', '2026-12-31')).toBe('2026-01-01부터 · 2026-12-31까지');
  });

  it('timeZoneLabel', () => {
    expect(timeZoneLabel('Asia/Seoul')).toBe('날짜 기준: 한국 시간 (Asia/Seoul)');
    expect(timeZoneLabel('UTC')).toBe('날짜 기준: UTC');
  });

  it('frequencyUnit', () => {
    expect(frequencyUnit('daily')).toBe('일마다');
    expect(frequencyUnit('weekly')).toBe('주마다');
    expect(frequencyUnit('monthly')).toBe('개월마다');
  });
});
