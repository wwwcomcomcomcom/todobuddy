import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSchedule, occurrences, validDate, todayInZone } from '../src/recurrence.js';

const dates = (startDate, endDate, rule, from = startDate) => [...occurrences(normalizeSchedule({ startDate, endDate, rule }), from)];
const monthly = (extra = {}) => ({ frequency: 'monthly', interval: 1, monthMode: 'dates', monthDays: [31], overflow: 'skip', ...extra });

describe('반복 날짜 계산', () => {
  it('N일 간격은 시작일에 고정되고 윤일과 종료일을 포함한다', () => {
    assert.deepEqual(dates('2028-02-25', '2028-03-02', { frequency: 'daily', interval: 2 }, '2028-02-26'), ['2028-02-27', '2028-02-29', '2028-03-02']);
  });
  it('N주 간격은 시작일이 속한 월요일 시작 주에 고정된다', () => {
    assert.deepEqual(dates('2026-10-07', '2026-10-23', { frequency: 'weekly', interval: 2, weekdays: [5, 1, 3] }), ['2026-10-07', '2026-10-09', '2026-10-19', '2026-10-21', '2026-10-23']);
  });
  it('조회 시작일이 반복 주 중간이어도 이후 요일을 포함한다', () => {
    assert.deepEqual(dates('2026-10-05', '2026-10-23', { frequency: 'weekly', interval: 2, weekdays: [1, 5] }, '2026-10-21'), ['2026-10-23']);
  });
  it('31일 건너뛰기와 월말 대체, 중복 날짜를 처리한다', () => {
    assert.deepEqual(dates('2028-01-31', '2028-04-30', monthly()), ['2028-01-31', '2028-03-31']);
    assert.deepEqual(dates('2028-01-31', '2028-04-30', monthly({ monthDays: [29, 30, 31, -1], overflow: 'lastDay' })), ['2028-01-31', '2028-02-29', '2028-03-29', '2028-03-30', '2028-03-31', '2028-04-29', '2028-04-30']);
  });
  it('둘째 월요일 및 첫째·셋째 금요일을 계산한다', () => {
    assert.deepEqual(dates('2026-10-01', '2026-12-31', monthly({ monthMode: 'weekdays', ordinals: [2], weekdays: [1] })), ['2026-10-12', '2026-11-09', '2026-12-14']);
    assert.deepEqual(dates('2026-10-01', '2026-10-31', monthly({ monthMode: 'weekdays', ordinals: [1, 3], weekdays: [5] })), ['2026-10-02', '2026-10-16']);
  });
  it('다섯째 요일은 없는 달을 건너뛰고 마지막 요일과 겹치면 한 번만 생성한다', () => {
    assert.deepEqual(dates('2026-10-01', '2026-12-31', monthly({ monthMode: 'weekdays', ordinals: [5], weekdays: [1] })), ['2026-11-30']);
    assert.deepEqual(dates('2026-10-01', '2026-12-31', monthly({ monthMode: 'weekdays', ordinals: [-1, 5], weekdays: [1] })), ['2026-10-26', '2026-11-30', '2026-12-28']);
  });
  it('N개월 간격과 연도 전환을 처리한다', () => {
    assert.deepEqual(dates('2026-11-10', '2027-05-10', monthly({ interval: 3, monthDays: [10] })), ['2026-11-10', '2027-02-10', '2027-05-10']);
  });
  it('종료일 없는 일정도 먼 미래의 조회 범위로 바로 이동한다', () => {
    const spec = normalizeSchedule({ startDate: '2026-01-01', rule: monthly({ monthDays: [-1] }) });
    assert.deepEqual([...occurrences(spec, '9999-12-01', '9999-12-31')], ['9999-12-31']);
  });
  it('존재하지 않는 날짜, 빈 선택, 잘못된 간격과 시간대를 거부한다', () => {
    for (const value of ['2026-02-29', '2026-04-31', '1899-12-31', '2026-1-01', null]) assert.equal(validDate(value), false);
    const base = { startDate: '2026-01-01', rule: { frequency: 'daily', interval: 1 } };
    for (const overrides of [
      { endDate: '2025-12-31' }, { timeZone: 'invalid' },
      { rule: { frequency: 'yearly', interval: 1 } },
      ...[0, -1, 1.5, 1000, '1'].map((interval) => ({ rule: { frequency: 'daily', interval } })),
      { rule: { frequency: 'weekly', interval: 1, weekdays: [] } },
      { rule: monthly({ monthDays: [0] }) },
    ]) assert.throws(() => normalizeSchedule({ ...base, ...overrides }));
  });
  it('오늘은 서버 시간대가 아닌 루틴 시간대를 따른다', () => {
    const now = new Date('2026-10-01T15:30:00Z');
    assert.equal(todayInZone('Asia/Seoul', now), '2026-10-02');
    assert.equal(todayInZone('America/Los_Angeles', now), '2026-10-01');
  });
});
