import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type MenuEntry = { icon: IconName; label: string; onSelect: () => void } | 'divider';

/** 버튼을 누르면 아래로 펼쳐지는 메뉴. Escape·바깥 클릭으로 닫히고 방향키로 움직인다. */
export function Menu({ label, trigger, items }: { label: string; trigger: ReactNode; items: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink hover:bg-chip"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="absolute right-0 z-40 mt-1 max-h-[75dvh] w-56 overflow-y-auto rounded-2xl border border-line bg-white py-2 shadow-xl"
        >
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} role="separator" className="my-1.5 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium hover:bg-chip focus:bg-chip focus:outline-none"
              >
                <Icon name={item.icon} size={20} className="text-ink/70" />
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
