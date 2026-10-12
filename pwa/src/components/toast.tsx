import { useEffect, useSyncExternalStore } from 'react';

// 화면 아래에 잠깐 뜨는 알림 (Flutter 의 SnackBar).
let current: { id: number; message: string } | null = null;
let seq = 0;
const listeners = new Set<() => void>();

export function toast(message: string) {
  current = { id: ++seq, message };
  listeners.forEach((l) => l());
}

export function ToastHost() {
  const item = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
  );

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => {
      if (current?.id === item.id) {
        current = null;
        listeners.forEach((l) => l());
      }
    }, 3200);
    return () => clearTimeout(timer);
  }, [item]);

  return (
    <div aria-live="polite" className="safe-pb pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4">
      {item && (
        <div key={item.id} role="status" className="pointer-events-auto mb-4 max-w-md rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {item.message}
        </div>
      )}
    </div>
  );
}

/** 클립보드에 복사하고 알린다. */
export async function copyText(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast('복사하지 못했어요. 직접 선택해 복사해 주세요.');
  }
}
