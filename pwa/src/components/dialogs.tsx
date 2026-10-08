import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isSubmitEnter } from '../lib/keys';
import { Button, inputClass } from './ui';

// 다이얼로그가 떠 있는 동안 뒤 화면은 inert 로 막는다 (스크린리더·Tab·클릭 모두).
let openCount = 0;
const setBackgroundInert = (delta: number) => {
  openCount += delta;
  const root = document.getElementById('root');
  if (!root) return;
  if (openCount > 0) root.setAttribute('inert', '');
  else root.removeAttribute('inert');
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 화면 위에 뜨는 다이얼로그. Escape·바깥 클릭으로 닫히고(dismissible 일 때), Tab 은 안에서만 돈다.
 * 입력 상태(텍스트 등)는 다이얼로그 내용 컴포넌트가 직접 들고 있어야 닫히는 동안 꼬이지 않는다.
 */
export function Modal({
  title, children, actions, onDismiss, dismissible = true, closeOnBackdrop = true, wide = false,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss: () => void;
  dismissible?: boolean;
  /** false 면 바깥 클릭으로는 닫히지 않는다 (Escape 는 dismissible 을 따른다). */
  closeOnBackdrop?: boolean;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useRef(`dialog-${Math.random().toString(36).slice(2)}`).current;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const canDismiss = useRef(dismissible);
  canDismiss.current = dismissible;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current!;
    const auto = node.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? node.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    auto.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canDismiss.current) {
        e.stopPropagation();
        dismiss.current();
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setBackgroundInert(1);
    return () => {
      node.removeEventListener('keydown', onKey);
      setBackgroundInert(-1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && dismissible && closeOnBackdrop) onDismiss();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`safe-pb flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white px-6 pt-6 shadow-xl outline-none sm:rounded-3xl sm:pb-5 ${
          wide ? 'sm:max-w-lg' : 'sm:max-w-sm'
        }`}
      >
        <h2 id={titleId} className="mb-4 text-lg font-extrabold">
          {title}
        </h2>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
        {actions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ----- 어디서든 await 로 띄우는 다이얼로그 (Flutter 의 showDialog 처럼) -----

type Entry = { id: number; node: () => ReactNode; close: (value?: unknown) => void };

let entries: Entry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** render 에 넘겨준 close(value) 가 불리면 그 값으로 끝난다. 그냥 닫히면 undefined. */
export function openDialog<T>(render: (close: (value?: T) => void) => ReactNode): Promise<T | undefined> {
  return new Promise((resolve) => {
    const id = nextId++;
    let done = false;
    const close = (value?: unknown) => {
      if (done) return;
      done = true;
      entries = entries.filter((e) => e.id !== id);
      emit();
      resolve(value as T | undefined);
    };
    entries = [...entries, { id, close, node: () => render(close as (value?: T) => void) }];
    emit();
  });
}

export function DialogHost() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => entries,
  );
  return (
    <>
      {list.map((e) => (
        <DialogSlot key={e.id} node={e.node} />
      ))}
    </>
  );
}

/** 다이얼로그 내용이 자기 State 를 갖도록 컴포넌트 경계를 하나 둔다. */
function DialogSlot({ node }: { node: () => ReactNode }) {
  return <>{node()}</>;
}

/** 테스트에서 남은 다이얼로그를 치운다. */
export function resetDialogs() {
  [...entries].forEach((e) => e.close());
}

export function confirmDialog({
  title, message, confirm = '확인', danger = false,
}: { title: string; message?: ReactNode; confirm?: string; danger?: boolean }): Promise<boolean> {
  return openDialog<boolean>((close) => (
    <Modal
      title={title}
      onDismiss={() => close(false)}
      actions={
        <>
          <Button variant="text" onClick={() => close(false)}>
            취소
          </Button>
          <Button variant={danger ? 'danger' : 'filled'} onClick={() => close(true)}>
            {confirm}
          </Button>
        </>
      }
    >
      {message && <div className="text-sm leading-relaxed text-ink/80">{message}</div>}
    </Modal>
  )).then((v) => v === true);
}

/** 한 줄만 입력받는 공용 다이얼로그. 빈 값이나 취소는 null. */
export async function promptDialog(options: { title: string; hint: string; action: string; initial?: string }): Promise<string | null> {
  const value = await openDialog<string>((close) => <TextPrompt {...options} close={close} />);
  return value ? value : null;
}

function TextPrompt({ title, hint, action, initial = '', close }: { title: string; hint: string; action: string; initial?: string; close: (v?: string) => void }) {
  const [text, setText] = useState(initial);
  const submit = () => close(text.trim());
  return (
    <Modal
      title={title}
      onDismiss={() => close()}
      actions={
        <>
          <Button variant="text" onClick={() => close()}>
            취소
          </Button>
          <Button onClick={submit}>{action}</Button>
        </>
      }
    >
      <input
        data-autofocus
        aria-label={hint}
        className={inputClass}
        placeholder={hint}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitEnter(e)) {
            e.preventDefault();
            submit();
          }
        }}
      />
    </Modal>
  );
}
