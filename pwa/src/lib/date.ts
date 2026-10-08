// 날짜는 항상 'YYYY-MM-DD' 문자열로 다닌다 (서버 규칙과 같다). 계산은 로컬 자정 기준 Date 로 한다.

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export const ymd = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setFullYear(y); // 0~99 년이 1900 년대로 바뀌지 않게
  return date;
}

export const todayYmd = () => ymd(new Date());

export const addDays = (s: string, days: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + days);
  return ymd(d);
};

export interface YearMonth {
  year: number;
  month: number; // 1~12
}

export const monthOf = (s: string): YearMonth => {
  const [year, month] = s.split('-').map(Number);
  return { year, month };
};

export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const sameMonth = (a: YearMonth, b: YearMonth) => a.year === b.year && a.month === b.month;

export const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];

/** 월요일 = 1 … 일요일 = 7 (서버 반복 규칙과 같은 번호). */
export const isoWeekday = (s: string) => ((parseYmd(s).getDay() + 6) % 7) + 1;

/** 월요일 시작 달력 칸. 앞뒤 빈칸은 null. */
export function monthGrid({ year, month }: YearMonth): (string | null)[] {
  const first = ymd(new Date(year, month - 1, 1));
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(isoWeekday(first) - 1).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${pad(year, 4)}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
