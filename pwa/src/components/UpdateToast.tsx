import { useSyncExternalStore } from 'react';
import { applyUpdate, dismissUpdate, hasUpdate, subscribeUpdate } from '../pwa/updates';
import { Button } from './ui';

/** 새 버전이 기다리고 있을 때 화면 아래에 뜨는 안내. 새로고침은 사용자가 누를 때만 한다. */
export function UpdateToast() {
  const visible = useSyncExternalStore(subscribeUpdate, hasUpdate);
  if (!visible) return null;
  return (
    <div className="safe-pb pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4">
      <div role="status" className="pointer-events-auto mb-4 flex max-w-md items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2.5 pl-5 text-sm text-white shadow-lg">
        <span className="font-medium">새 버전이 있어요</span>
        <Button variant="text" size="sm" className="text-white/70 hover:bg-white/10" onClick={dismissUpdate}>
          나중에
        </Button>
        <Button variant="tonal" size="sm" onClick={applyUpdate}>
          새로고침
        </Button>
      </div>
    </div>
  );
}
