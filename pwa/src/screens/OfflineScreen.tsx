import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { useStore } from '../state/context';

/** 세션을 확인하려다 서버에 닿지 못했을 때. 이 앱은 서버가 원본이라 오프라인 편집은 하지 않는다. */
export function OfflineScreen() {
  const store = useStore();

  useEffect(() => {
    const retry = () => void store.restoreSession();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [store]);

  return (
    <main className="safe-px flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <Icon name="cloudOff" size={44} className="text-blob" />
      <h1 className="text-lg font-extrabold">오프라인이에요</h1>
      <p className="text-sm text-subtle">
        인터넷에 연결되면 자동으로 다시 불러와요.
        <br />
        Todo Buddy 는 서버에 저장된 할 일을 보여 줘서 연결이 필요해요.
      </p>
      <Button variant="tonal" icon="refresh" onClick={() => void store.restoreSession()} className="mt-2">
        다시 시도
      </Button>
    </main>
  );
}
