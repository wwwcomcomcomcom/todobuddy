import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ChipToggle, ErrorText, LinearProgress, ScreenHeader, SectionTitle, useGoBack, Segmented, Spinner, Switch, inputClass } from '../components/ui';
import { errorMessage } from '../lib/api';
import { isoWeekday, weekdayNames } from '../lib/date';
import { isSubmitEnter } from '../lib/keys';
import type { Category, Routine, RoutineInput, RoutinePreview, RoutineRule } from '../lib/models';
import {
  frequencyUnit, monthDayLabel, normalizeRule, ordinalNames, parseInterval, periodLabel, previewDateLabel, ruleSummary,
  ruleToJson, sanitizeInterval, sortedUnique, timeZoneLabel, toggleValue, type FullRule,
} from '../lib/routine';
import { useStore } from '../state/context';

const FALLBACK = '서버에 연결하지 못했어요. 다시 시도해 주세요.';
const MIN_DATE = '1900-01-01';
const MAX_DATE = '9999-12-31';
/** iOS 는 16px 보다 작은 입력칸에 초점이 가면 화면을 확대한다. 터치 기기에서는 16px 로 키운다. */
const touchInput = inputClass;


/** `/routines/new` 는 바로 폼을, `/routines/:id` 는 반복 일정을 읽은 뒤 폼을 보여준다. */
export default function RoutineFormScreen() {
  const { id } = useParams();
  if (id == null) return <RoutineForm routine={null} />;
  return <RoutineLoader key={id} id={id} />;
}

function RoutineLoader({ id }: { id: string }) {
  const store = useStore();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = (await store.api.routines()).find((r) => String(r.id) === id) ?? null;
      setRoutine(found);
      if (!found) setError('반복 일정을 찾지 못했어요. 목록에서 다시 열어 주세요.');
    } catch (e) {
      setError(errorMessage(e, FALLBACK));
    } finally {
      setLoading(false);
    }
  }, [store, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (routine && !loading) return <RoutineForm routine={routine} />;
  return (
    <div className="min-h-dvh">
      <ScreenHeader title="반복 일정 편집" />
      {loading ? <CenteredSpinner /> : <LoadError message={error ?? FALLBACK} onRetry={() => void load()} />}
    </div>
  );
}

function RoutineForm({ routine }: { routine: Routine | null }) {
  const store = useStore();
  const navigate = useNavigate();
  const goBack = useGoBack('/routines');
  const editing = routine != null;
  const timeZone = routine?.timeZone ?? 'Asia/Seoul';

  // ----- 폼 값 (Flutter initState 와 같은 초기값) -----
  const [initial] = useState(() => {
    const selected = store.getSnapshot().selectedDate;
    const rule: FullRule | null = routine ? normalizeRule(routine.rule) : null;
    return {
      startDate: routine?.startDate ?? selected,
      weekdays: rule?.weekdays.length ? sortedUnique(rule.weekdays) : [isoWeekday(selected)],
      monthDays: rule?.monthDays.length ? sortedUnique(rule.monthDays) : [Number(selected.slice(8, 10))],
      ordinals: rule?.ordinals.length ? sortedUnique(rule.ordinals) : [1],
    };
  });
  const [title, setTitle] = useState(routine?.title ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(routine?.categoryId ?? null);
  const [frequency, setFrequency] = useState<FullRule['frequency']>(routine?.rule.frequency ?? 'daily');
  const [intervalText, setIntervalText] = useState(String(routine?.rule.interval ?? 1));
  const [monthMode, setMonthMode] = useState<FullRule['monthMode']>(routine?.rule.monthMode ?? 'dates');
  const [overflow, setOverflow] = useState<FullRule['overflow']>(routine?.rule.overflow ?? 'skip');
  const [weekdays, setWeekdays] = useState(initial.weekdays);
  const [monthDays, setMonthDays] = useState(initial.monthDays);
  const [ordinals, setOrdinals] = useState(initial.ordinals);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState<string | null>(routine?.endDate ?? null);

  // ----- 화면 상태 -----
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoutinePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const rule: RoutineRule = useMemo(
    () => ({ frequency, interval: parseInterval(intervalText), weekdays, monthMode, monthDays, ordinals, overflow }),
    [frequency, intervalText, weekdays, monthMode, monthDays, ordinals, overflow],
  );
  const input: RoutineInput = {
    title: title.trim(),
    categoryId,
    startDate,
    endDate,
    timeZone,
    rule: ruleToJson(rule),
    ...(routine ? { versionId: routine.versionId } : {}),
  };
  // 타이머가 울릴 때 최신 값을 읽도록 렌더마다 갱신한다.
  const inputRef = useRef(input);
  inputRef.current = input;

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ----- 카테고리 -----
  const categoryRequest = useRef(0);
  const loadCategories = useCallback(
    async ({ silent = false } = {}) => {
      const request = ++categoryRequest.current;
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const list = await store.api.categories();
        if (!alive.current || request !== categoryRequest.current) return;
        setCategories(list);
        setLoadError(null);
        setCategoryId((current) => (list.some((c) => c.id === current) ? current : (list[0]?.id ?? null)));
      } catch (e) {
        if (alive.current && request === categoryRequest.current && !silent) setLoadError(errorMessage(e, FALLBACK));
      } finally {
        if (alive.current && request === categoryRequest.current) setLoading(false);
      }
    },
    [store],
  );

  useEffect(() => {
    void loadCategories();
    // 다른 탭·창에서 카테고리를 만들고 돌아오면 다시 읽는다.
    const onFocus = () => void loadCategories({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadCategories]);

  // ----- 미리보기 (300ms 디바운스, 늦게 온 응답은 버린다) -----
  const previewRequest = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshPreview = useCallback(async () => {
    const request = ++previewRequest.current;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await store.api.previewRoutine(inputRef.current);
      if (alive.current && request === previewRequest.current) setPreview(result);
    } catch (e) {
      if (alive.current && request === previewRequest.current) {
        setPreview(null);
        setPreviewError(errorMessage(e, FALLBACK));
      }
    } finally {
      if (alive.current && request === previewRequest.current) setPreviewLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refreshPreview();
    return () => clearTimeout(debounce.current);
  }, [refreshPreview]);

  /** 규칙·기간이 바뀌었다: 지금 미리보기를 지우고 잠시 뒤 다시 묻는다. */
  const changed = (update: () => void) => {
    clearTimeout(debounce.current);
    previewRequest.current++;
    update();
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setError(null);
    debounce.current = setTimeout(() => void refreshPreview(), 300);
  };

  // ----- 저장 -----
  const trimmed = title.trim();
  const canSave =
    !saving && !loading && !previewLoading && preview != null && categoryId != null && trimmed.length > 0 && trimmed.length <= 500;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await store.api.saveRoutine(inputRef.current, routine?.id);
      await store.refreshBoard();
      if (alive.current) goBack();
    } catch (e) {
      if (alive.current) setError(errorMessage(e, FALLBACK));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const showWeekdays = frequency === 'weekly' || (frequency === 'monthly' && monthMode === 'weekdays');

  let body: ReactNode;
  if (loading) body = <CenteredSpinner />;
  else if (loadError) body = <LoadError message={loadError} onRetry={() => void loadCategories()} />;
  else if (categories.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <p>반복 일정을 담을 카테고리를 먼저 만들어 주세요.</p>
        <Button onClick={() => void navigate('/categories/new')}>카테고리 만들기</Button>
      </div>
    );
  } else {
    body = (
      <main className="safe-px safe-pb mx-auto max-w-[680px] pt-4">
        <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0 pb-6">
          <label className="block">
            <span className="text-[13px] font-semibold text-subtle">할 일 이름</span>
            <input
              className="mt-1 w-full border-b-2 border-line bg-transparent py-2 text-xl font-semibold outline-none transition-colors placeholder:font-normal placeholder:text-subtle focus:border-ink"
              placeholder="예: 책 20분 읽기"
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitEnter(e)) {
                  e.preventDefault();
                  void save();
                }
              }}
            />
          </label>

          <Field title="카테고리">
            <select
              aria-label="카테고리"
              className={`${touchInput} disabled:bg-chip disabled:text-subtle`}
              value={categoryId ?? ''}
              disabled={editing}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field title="반복 주기">
            <Segmented
              label="반복 주기"
              value={frequency}
              options={[
                { value: 'daily', label: '일마다' },
                { value: 'weekly', label: '주마다' },
                { value: 'monthly', label: '개월마다' },
              ]}
              onChange={(v) => v !== frequency && changed(() => setFrequency(v))}
            />
            <label className="mt-4 block">
              <span className="text-[13px] font-semibold text-subtle">반복 간격</span>
              <span className="mt-1 flex items-center gap-2">
                <input
                  className={`${touchInput} w-24`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  value={intervalText}
                  onChange={(e) => {
                    const next = sanitizeInterval(e.target.value);
                    if (next !== intervalText) changed(() => setIntervalText(next));
                  }}
                />
                <span className="shrink-0 text-[15px] font-semibold whitespace-nowrap">{frequencyUnit(frequency)}</span>
              </span>
              <span className="mt-1 block text-xs text-subtle">1~999 사이의 간격</span>
            </label>
          </Field>

          {frequency === 'monthly' && (
            <>
              <Field title="월별 반복 방식">
                <Segmented
                  label="월별 반복 방식"
                  value={monthMode}
                  options={[
                    { value: 'dates', label: '날짜 선택' },
                    { value: 'weekdays', label: '몇째 요일' },
                  ]}
                  onChange={(v) => v !== monthMode && changed(() => setMonthMode(v))}
                />
              </Field>
              {monthMode === 'dates' ? (
                <>
                  <Field title="반복할 날짜">
                    <Chips
                      label="반복할 날짜"
                      values={[...Array.from({ length: 31 }, (_, i) => i + 1), -1]}
                      selected={monthDays}
                      name={monthDayLabel}
                      onToggle={(v) => changed(() => setMonthDays((s) => toggleValue(s, v)))}
                    />
                  </Field>
                  <Field title="해당 날짜가 없는 달">
                    <select
                      aria-label="해당 날짜가 없는 달"
                      className={touchInput}
                      value={overflow}
                      onChange={(e) => {
                        const v = e.target.value as FullRule['overflow'];
                        if (v !== overflow) changed(() => setOverflow(v));
                      }}
                    >
                      <option value="skip">그달은 건너뛰기</option>
                      <option value="lastDay">그달 마지막 날로 대체</option>
                    </select>
                  </Field>
                </>
              ) : (
                <Field title="몇째 요일인지 선택">
                  <Chips
                    label="몇째 요일인지 선택"
                    values={[1, 2, 3, 4, 5, -1]}
                    selected={ordinals}
                    name={(n) => ordinalNames[n]}
                    onToggle={(v) => changed(() => setOrdinals((s) => toggleValue(s, v)))}
                  />
                  <Note className="mt-2">다섯째 요일이 없는 달은 건너뛰어요. 같은 날짜는 한 번만 추가돼요.</Note>
                </Field>
              )}
            </>
          )}

          {showWeekdays && (
            <Field title="반복할 요일">
              <Chips
                label="반복할 요일"
                values={[1, 2, 3, 4, 5, 6, 7]}
                selected={weekdays}
                name={(d) => weekdayNames[d - 1]}
                onToggle={(v) => changed(() => setWeekdays((s) => toggleValue(s, v)))}
              />
              {frequency === 'weekly' && (
                <Note className="mt-2">간격은 시작일이 속한 주부터 계산해요. 한 주는 월요일부터 일요일까지예요.</Note>
              )}
            </Field>
          )}

          <Field title="반복 기간">
            <div className="flex flex-col gap-2">
              <DateField
                label="시작일"
                value={startDate}
                onChange={(v) => changed(() => setStartDate(v))}
              />
              <label className="flex items-center gap-3 rounded-xl bg-chip px-[18px] py-3">
                <span className="flex-1 text-[15px] font-bold">종료일 없음</span>
                <Switch
                  label="종료일 없음"
                  checked={endDate == null}
                  onChange={(on) => changed(() => setEndDate(on ? null : startDate))}
                />
              </label>
              {endDate != null && (
                <DateField
                  label="종료일 (이 날짜까지 포함)"
                  value={endDate}
                  onChange={(v) => changed(() => setEndDate(v))}
                />
              )}
            </div>
            <Note className="mt-2">{timeZoneLabel(timeZone)}</Note>
            {editing && (
              <p className="mt-3 text-[13px]">
                변경은 오늘 이후에 적용돼요. 과거 기록과 이미 완료하거나 개별 수정한 일정은 유지해요. 카테고리는 변경할 수 없어요.
              </p>
            )}
          </Field>

          <Field title="예정 날짜 미리보기">
            <div className="rounded-[14px] bg-chip p-[18px]" aria-live="polite">
              <p className="font-bold">{ruleSummary(rule)}</p>
              <p className="mt-1.5 text-sm">{periodLabel(startDate, endDate)}</p>
              <div className="mt-3.5">
                {previewLoading ? (
                  <LinearProgress />
                ) : previewError ? (
                  <>
                    <p className="text-sm text-sunday">{previewError}</p>
                    <Button variant="text" size="sm" className="mt-1 -ml-2.5" onClick={() => void refreshPreview()}>
                      다시 확인
                    </Button>
                  </>
                ) : preview ? (
                  <>
                    {preview.dates.length === 0 ? (
                      <p className="text-sm">이 설정에는 오늘 이후 예정된 일정이 없어요.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {preview.dates.map((date) => (
                          <li key={date} className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold">
                            {previewDateLabel(date)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!editing && startDate < preview.today && (
                      <p className="mt-2.5 text-[13px]">시작일부터 지난 날짜의 일정도 추가돼요.</p>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </Field>

          <ErrorText className="mt-4">{error}</ErrorText>

          <Button size="lg" block icon="repeat" className="mt-6" disabled={!canSave} onClick={() => void save()}>
            {saving ? '저장 중…' : '반복 일정 저장'}
          </Button>
        </fieldset>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        title={editing ? '반복 일정 편집' : '반복 일정 추가'}
        onBack={() => {
          if (!saving) goBack();
        }}
        action={
          <Button variant="text" size="sm" disabled={!canSave} onClick={() => void save()}>
            {saving ? '저장 중' : '저장'}
          </Button>
        }
      />
      {body}
    </div>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] text-subtle ${className}`}>{children}</p>;
}

function Chips({
  label, values, selected, name, onToggle,
}: { label: string; values: number[]; selected: number[]; name: (v: number) => string; onToggle: (v: number) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-2 gap-y-1.5">
      {values.map((v) => (
        <ChipToggle key={v} selected={selected.includes(v)} onClick={() => onToggle(v)}>
          {name(v)}
        </ChipToggle>
      ))}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-chip px-[18px] py-3">
      <span className="text-[15px] font-bold">{label}</span>
      <input
        type="date"
        className="ml-auto min-w-0 rounded-lg bg-white px-2.5 py-1.5 text-base font-semibold outline-none focus:ring-2 focus:ring-ink"
        min={MIN_DATE}
        max={MAX_DATE}
        required
        value={value}
        onChange={(e) => {
          // 입력 중이거나 지운 상태(빈 문자열)는 무시하고 마지막 올바른 날짜를 유지한다.
          const v = e.target.value;
          if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= MIN_DATE && v <= MAX_DATE && v !== value) onChange(v);
        }}
      />
    </label>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Spinner />
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
      <p>{message}</p>
      <Button variant="text" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
