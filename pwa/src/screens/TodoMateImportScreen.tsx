import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { CategoryPill, TodoCheckbox } from '../components/TodoColumn';
import { Button, ErrorText, inputClass, LinearProgress, ScreenHeader, useGoBack, visibilityIcon } from '../components/ui';
import { ApiError } from '../lib/api';
import { addDays, todayYmd } from '../lib/date';
import { isSubmitEnter } from '../lib/keys';
import { visibilityLabel, type CategoryVisibility } from '../lib/models';
import { androidColorToHex, TodoMateClient, TodoMateError, type TodoMateCategory } from '../services/todomate';
import { useStore } from '../state/context';

type Step = 'login' | 'range' | 'preview';

const TITLES: Record<Step, string> = {
  login: '투두메이트 로그인',
  range: '가져올 기간',
  preview: '가져오기 미리보기',
};

/**
 * 투두메이트 계정에서 일정을 가져와 TodoBuddy 로 옮기는 3단계 화면.
 * 로그인 → 가져올 기간 → 미리보기(확인) 순서로 진행한다.
 * 투두메이트 비밀번호·토큰·일정은 브라우저에서 구글(Firebase)로 바로 가고, 우리 서버는 공개 설정값만 건넨다.
 */
export default function TodoMateImportScreen() {
  const store = useStore();
  const navigate = useNavigate();
  const client = useMemo(() => new TodoMateClient({ getConfig: (refresh) => store.api.todomateConfig(refresh) }), [store]);

  const [bounds] = useState(() => {
    const today = todayYmd();
    return { today, earliest: addDays(today, -30), latest: addDays(today, 365) };
  });
  const [rangeStart, setRangeStart] = useState(() => addDays(bounds.today, -7));
  const [rangeEnd, setRangeEnd] = useState(() => addDays(bounds.today, 30));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<TodoMateCategory[]>([]);
  const [visibility, setVisibility] = useState<Record<string, CategoryVisibility>>({});

  const [importedCount, setImportedCount] = useState(0);
  const [importTotal, setImportTotal] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const leave = useGoBack();
  const goBack = () => {
    if (busy) return;
    setError(null);
    switch (step) {
      case 'login':
        leave();
        break;
      case 'range':
        setStep('login');
        break;
      case 'preview':
        setStep('range');
        break;
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof TodoMateError || e instanceof ApiError) setError(e.message);
      else setError(`처리하지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const login = () =>
    run(async () => {
      await client.signIn(email.trim(), password);
      if (mounted.current) setStep('range');
    });

  const loadPreview = () =>
    run(async () => {
      const result = await client.fetchSchedules(rangeStart, rangeEnd);
      if (!mounted.current) return;
      setPreview(result);
      setVisibility(Object.fromEntries(result.map((c) => [c.name, c.isPrivate ? 'private' : 'public'])));
      setStep('preview');
    });

  const pickDate = (isStart: boolean, value: string) => {
    if (!value) return; // 지우기 버튼 등으로 빈 값이 오면 무시한다.
    const picked = value < bounds.earliest ? bounds.earliest : value > bounds.latest ? bounds.latest : value;
    if (isStart) {
      setRangeStart(picked);
      if (rangeEnd < picked) setRangeEnd(picked);
    } else {
      setRangeEnd(picked);
      if (rangeStart > picked) setRangeStart(picked);
    }
  };

  const confirmImport = () =>
    run(async () => {
      const api = store.api;
      const existing = await api.categories();
      const byName = new Map(existing.map((c) => [c.name, c.id]));

      // 제목이 빈 할 일은 건너뛰므로 진행률·완료 알림에서도 뺀다.
      const total = preview.reduce((sum, c) => sum + c.todos.filter((t) => t.title).length, 0);
      let done = 0;
      setImportTotal(total);
      setImportedCount(0);

      for (const category of preview) {
        let categoryId = byName.get(category.name);
        if (categoryId == null) {
          const created = await api.createCategory({
            name: category.name,
            color: androidColorToHex(category.androidColor),
            visibility: visibility[category.name] ?? 'private',
          });
          categoryId = created.id;
          byName.set(category.name, categoryId);
        }
        for (const todo of category.todos) {
          if (!todo.title) continue;
          const created = await api.createTodo({ categoryId, date: todo.date, title: todo.title });
          if (todo.completed) await api.updateTodo(created.id, { done: true });
          done++;
          if (mounted.current) setImportedCount(done);
        }
      }

      if (!mounted.current) return;
      await store.refreshAll();
      if (!mounted.current) return;
      navigate('/', { replace: true });
      toast(`${total}건의 할 일을 가져왔어요.`);
    });

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader title={TITLES[step]} onBack={goBack} backDisabled={busy} />
      {step === 'login' && (
        <LoginForm
          email={email}
          password={password}
          onEmail={setEmail}
          onPassword={setPassword}
          busy={busy}
          error={error}
          onSubmit={() => void login()}
        />
      )}
      {step === 'range' && (
        <main className="safe-px safe-pb mx-auto w-full max-w-2xl pt-4 pb-8">
          <p className="text-[13px] text-subtle">
            가져올 수 있는 기간: {bounds.earliest} ~ {bounds.latest}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <DateRow label="시작일" value={rangeStart} min={bounds.earliest} max={bounds.latest} disabled={busy} onChange={(v) => pickDate(true, v)} />
            <DateRow label="종료일" value={rangeEnd} min={bounds.earliest} max={bounds.latest} disabled={busy} onChange={(v) => pickDate(false, v)} />
          </div>
          <Button size="lg" block className="mt-6" disabled={busy} onClick={() => void loadPreview()}>
            일정 불러오기
          </Button>
          <BusyAndError busy={busy} error={error} />
        </main>
      )}
      {step === 'preview' && (
        <PreviewList
          categories={preview}
          visibility={visibility}
          onChangeVisibility={(name, v) => setVisibility((prev) => ({ ...prev, [name]: v }))}
          busy={busy}
          error={error}
          importedCount={importedCount}
          importTotal={importTotal}
          onConfirm={() => void confirmImport()}
        />
      )}
    </div>
  );
}

function BusyAndError({ busy, error }: { busy: boolean; error: string | null }) {
  return (
    <>
      {busy && (
        <div className="mt-5">
          <LinearProgress />
        </div>
      )}
      <ErrorText className="mt-4">{error}</ErrorText>
    </>
  );
}

function LoginForm({
  email, password, onEmail, onPassword, busy, error, onSubmit,
}: {
  email: string;
  password: string;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const passwordRef = useRef<HTMLInputElement>(null);

  return (
    <main className="safe-px safe-pb mx-auto w-full max-w-2xl pt-4 pb-8">
      {/* form 으로 묶어 브라우저 비밀번호 관리자가 이메일·비밀번호 칸을 알아보게 한다. 제출은 직접 처리한다. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit();
        }}
      >
        <p className="text-[13px] whitespace-pre-line text-subtle">
          {'투두메이트 계정으로 로그인하면, 본인 소유 일정만 가져올 수 있어요.\n'}
          {'구글·애플 로그인 계정은 투두메이트 앱 설정에서 비밀번호를 먼저 연결해야 해요.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <label className="text-xs font-bold text-subtle">
            투두메이트 이메일
            <input
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoFocus
              className={`${inputClass} mt-1`}
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (isSubmitEnter(e)) passwordRef.current?.focus();
              }}
            />
          </label>
          <label className="text-xs font-bold text-subtle">
            비밀번호
            <input
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete="current-password"
              className={`${inputClass} mt-1`}
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (isSubmitEnter(e) && !busy) onSubmit();
              }}
            />
          </label>
        </div>
        <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
          다음
        </Button>
      </form>
      <BusyAndError busy={busy} error={error} />
    </main>
  );
}

/** 회색 바탕의 날짜 한 줄. 누르면 브라우저 기본 날짜 선택기가 뜬다. */
function DateRow({
  label, value, min, max, disabled, onChange,
}: { label: string; value: string; min: string; max: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className={`flex items-center gap-2 rounded-xl bg-chip px-[18px] py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="text-[15px] font-bold">{label}</span>
      <input
        type="date"
        aria-label={label}
        className="ml-auto min-w-0 bg-transparent py-1 text-right font-semibold outline-none"
        value={value}
        min={min}
        max={max}
        required
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </label>
  );
}

function PreviewList({
  categories, visibility, onChangeVisibility, busy, error, importedCount, importTotal, onConfirm,
}: {
  categories: TodoMateCategory[];
  visibility: Record<string, CategoryVisibility>;
  onChangeVisibility: (name: string, v: CategoryVisibility) => void;
  busy: boolean;
  error: string | null;
  importedCount: number;
  importTotal: number;
  onConfirm: () => void;
}) {
  const total = categories.reduce((sum, c) => sum + c.todos.length, 0);

  if (categories.length === 0) {
    return (
      <main className="safe-px flex flex-1 flex-col items-center justify-center gap-3 pb-16">
        <Icon name="inbox" size={44} className="text-blob" />
        <p className="font-semibold text-subtle">그 기간에는 가져올 일정이 없어요</p>
      </main>
    );
  }

  return (
    <>
      <main className="safe-px mx-auto w-full max-w-2xl flex-1 pt-3 pb-4">
        <p className="text-[13px] whitespace-pre-line text-subtle">
          {`카테고리 ${categories.length}개 · 할 일 ${total}건을 가져와요.\n`}
          {'투두메이트의 공유 대상(친구·크루)은 가져올 수 없어, 공개설정만 공개/비공개로 옮기고 아래에서 다시 확인해 주세요.'}
        </p>
        <ul className="mt-4 flex flex-col gap-5">
          {categories.map((category, index) => (
            <PreviewCategorySection
              // 투두메이트 Goal 이름이 겹칠 수 있어 순서로 구분한다.
              key={index}
              category={category}
              visibility={visibility[category.name] ?? 'private'}
              disabled={busy}
              onChangeVisibility={(v) => onChangeVisibility(category.name, v)}
            />
          ))}
        </ul>
      </main>
      <footer className="safe-px safe-pb sticky bottom-0 z-10 border-t border-line bg-white">
        <div className="mx-auto flex max-w-2xl flex-col pt-3 pb-5">
          {busy && importTotal > 0 ? (
            <>
              <LinearProgress value={importedCount / importTotal} />
              <p className="mt-2 mb-3 text-center text-xs text-subtle">
                {importedCount} / {importTotal} 가져오는 중...
              </p>
            </>
          ) : busy ? (
            <div className="mb-3">
              <LinearProgress />
            </div>
          ) : null}
          <ErrorText className="mb-3">{error}</ErrorText>
          <Button size="lg" block disabled={busy} onClick={onConfirm}>
            TodoBuddy로 가져오기
          </Button>
        </div>
      </footer>
    </>
  );
}

function PreviewCategorySection({
  category, visibility, disabled, onChangeVisibility,
}: {
  category: TodoMateCategory;
  visibility: CategoryVisibility;
  disabled: boolean;
  onChangeVisibility: (v: CategoryVisibility) => void;
}) {
  const color = androidColorToHex(category.androidColor);
  return (
    <li>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1">
          {/* 미리보기 표시용으로만 쓰는, 아직 서버에 없는 임시 카테고리 값. */}
          <CategoryPill category={{ name: category.name, color, visibility }} />
        </div>
        <VisibilityToggle name={category.name} value={visibility} disabled={disabled} onChange={onChangeVisibility} />
      </div>
      <ul className="mt-2">
        {category.todos.map((todo, i) => (
          <li key={i} className="flex items-center gap-2.5 py-1">
            <TodoCheckbox color={color} checked={todo.completed} label={todo.title} />
            <span className="w-[72px] shrink-0 text-xs text-subtle">{todo.date}</span>
            <span className={`min-w-0 flex-1 text-sm font-medium break-words ${todo.completed ? 'text-subtle line-through' : 'text-ink'}`}>
              {todo.title}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** 공개/비공개만 고를 수 있는 작은 토글. (투두메이트의 세분화된 공유 대상은 옮길 수 없다.) */
function VisibilityToggle({
  name, value, disabled, onChange,
}: { name: string; value: CategoryVisibility; disabled: boolean; onChange: (v: CategoryVisibility) => void }) {
  const option = (v: CategoryVisibility): ReactNode => {
    const selected = value === v;
    return (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={() => onChange(v)}
        className={`inline-flex items-center gap-1 rounded-2xl px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
          selected ? 'bg-ink text-white' : 'text-subtle hover:text-ink'
        }`}
      >
        <Icon name={visibilityIcon[v]} size={13} />
        {visibilityLabel[v]}
      </button>
    );
  };

  return (
    <div role="radiogroup" aria-label={`${name} 공개설정`} className="inline-flex shrink-0 rounded-[18px] bg-chip p-0.5">
      {option('private')}
      {option('public')}
    </div>
  );
}
