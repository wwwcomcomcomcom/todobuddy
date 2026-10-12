import { useState, type ReactNode } from 'react';
import { monthGrid, todayYmd, weekdayNames, type YearMonth } from '../lib/date';
import type { Calendar, DaySegment } from '../lib/models';
import { Modal, openDialog } from './dialogs';
import { Icon } from './Icon';
import { IconButton } from './ui';

const weekdayColor = (i: number) => (i === 5 ? 'text-saturday' : i === 6 ? 'text-sunday' : 'text-ink');

/**
 * 월간 캘린더. 각 날짜 칸은 그 날 TODO 가 있는 카테고리 색으로 칠해진다.
 * 전부 완료했으면 체크, 아니면 남은 개수를 보여준다.
 * collapsed 면 선택한 날이 있는 주만 보여준다 (좁은 화면).
 */
export function MonthCalendar({
  month, selectedDate, segmentsByDate, onSelectDate, onChangeMonth, collapsed = false, headerExtra,
}: {
  month: YearMonth;
  selectedDate: string;
  segmentsByDate: Calendar;
  onSelectDate: (date: string) => void;
  onChangeMonth: (month: YearMonth) => void;
  collapsed?: boolean;
  headerExtra?: ReactNode;
}) {
  const cells = monthGrid(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const today = todayYmd();
  const selectedWeek = weeks.findIndex((w) => w.includes(selectedDate));
  const shown = collapsed ? [weeks[selectedWeek >= 0 ? selectedWeek : 0]] : weeks;

  const prev = () => onChangeMonth(month.month === 1 ? { year: month.year - 1, month: 12 } : { ...month, month: month.month - 1 });
  const next = () => onChangeMonth(month.month === 12 ? { year: month.year + 1, month: 1 } : { ...month, month: month.month + 1 });

  return (
    <section aria-label="캘린더">
      <div className="flex items-center">
        <button
          type="button"
          onClick={async () => {
            const picked = await pickMonth(month);
            if (picked) onChangeMonth(picked);
          }}
          className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-[22px] leading-tight font-extrabold hover:bg-chip"
          aria-label={`${month.year}년 ${month.month}월, 다른 달 고르기`}
        >
          {month.year}년 {month.month}월
          <Icon name="expandMore" size={22} />
        </button>
        <div className="ml-auto flex items-center">
          {headerExtra}
          <IconButton icon="chevronLeft" label="이전 달" size={32} disabled={month.year === 1900 && month.month === 1} onClick={prev} />
          <IconButton icon="chevronRight" label="다음 달" size={32} disabled={month.year === 9999 && month.month === 12} onClick={next} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7" aria-hidden="true">
        {weekdayNames.map((d, i) => (
          <span key={d} className={`text-center text-xs font-semibold ${weekdayColor(i)}`}>
            {d}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-1.5" role="grid" aria-label={`${month.year}년 ${month.month}월`}>
        {shown.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {week.map((date, i) =>
              date ? (
                <DayCell
                  key={date}
                  date={date}
                  weekday={i}
                  segments={segmentsByDate[date] ?? []}
                  selected={date === selectedDate}
                  isToday={date === today}
                  onSelect={() => onSelectDate(date)}
                />
              ) : (
                <span key={`empty${i}`} role="gridcell" className="h-[52px]" />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DayCell({
  date, weekday, segments, selected, isToday, onSelect,
}: { date: string; weekday: number; segments: DaySegment[]; selected: boolean; isToday: boolean; onSelect: () => void }) {
  const day = Number(date.slice(8));
  const remaining = segments.reduce((sum, s) => sum + s.total - s.done, 0);
  const status = segments.length === 0 ? '할 일 없음' : remaining === 0 ? '모두 완료' : `남은 할 일 ${remaining}개`;
  const [y, m] = date.split('-').map(Number);

  return (
    <div role="gridcell" className="flex justify-center">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-current={isToday ? 'date' : undefined}
        aria-label={`${day}일, ${y}년 ${m}월, ${status}`}
        className="flex h-[52px] w-full max-w-12 flex-col items-center justify-center gap-1 rounded-[14px] hover:bg-chip/70"
      >
        <DayBlob segments={segments} remaining={remaining} />
        <span
          className={`flex size-[22px] items-center justify-center rounded-full text-xs ${
            selected ? 'bg-ink font-extrabold text-white' : isToday ? 'bg-chip font-extrabold' : 'font-medium'
          } ${selected ? '' : weekdayColor(weekday)}`}
        >
          {day}
        </span>
      </button>
    </div>
  );
}

/** 날짜 칸의 색 블록. 카테고리가 여러 개면 색을 가로 띠로 나눠 쌓는다. */
function DayBlob({ segments, remaining }: { segments: DaySegment[]; remaining: number }) {
  if (segments.length === 0) return <span aria-hidden="true" className="squircle block size-6 bg-blob" data-testid="day-blob" />;
  return (
    <span aria-hidden="true" className="squircle relative flex size-6 flex-col overflow-hidden" data-testid="day-blob">
      {segments.map((s) => (
        <span key={s.categoryId} className="block flex-1" style={{ background: s.color }} data-color={s.color} />
      ))}
      <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">
        {remaining === 0 ? <Icon name="check" size={16} /> : remaining}
      </span>
    </span>
  );
}

function pickMonth(current: YearMonth) {
  return openDialog<YearMonth>((close) => <MonthPicker current={current} close={close} />);
}

function MonthPicker({ current, close }: { current: YearMonth; close: (v?: YearMonth) => void }) {
  const [year, setYear] = useState(current.year);
  return (
    <Modal
      title={
        <div className="flex items-center justify-between">
          <IconButton icon="chevronLeft" label="이전 해" disabled={year <= 1900} onClick={() => setYear(year - 1)} />
          <span>{year}년</span>
          <IconButton icon="chevronRight" label="다음 해" disabled={year >= 9999} onClick={() => setYear(year + 1)} />
        </div>
      }
      onDismiss={() => close()}
    >
      <div className="grid grid-cols-4 gap-2 pb-2">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const active = year === current.year && m === current.month;
          return (
            <button
              key={m}
              type="button"
              onClick={() => close({ year, month: m })}
              className={`rounded-[10px] py-3 text-sm font-bold ${active ? 'bg-ink text-white' : 'bg-chip hover:bg-blob'}`}
            >
              {m}월
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
