import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { promptDialog } from '../components/dialogs';
import { Icon } from '../components/Icon';
import { Button, ErrorText, LinearProgress, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import type { AuthConfig } from '../lib/models';
import { useApp, useStore } from '../state/context';

const REDIRECT_ERRORS: Record<string, string> = {
  google_cancelled: '구글 로그인을 취소했어요.',
  google_state_mismatch: '로그인 요청이 만료되었어요. 다시 시도해 주세요.',
  google_auth_failed: '구글 로그인에 실패했어요. 다시 시도해 주세요.',
};

export function LoginScreen() {
  const store = useStore();
  const { errorMessage: sessionError } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    () => REDIRECT_ERRORS[params.get('error') ?? ''] ?? sessionError ?? null,
  );

  useEffect(() => {
    let alive = true;
    store.api
      .authConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {
        if (!alive) return;
        setConfig({ googleEnabled: false, googleWebEnabled: false, devLoginEnabled: false });
        setError('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      });
    return () => {
      alive = false;
    };
  }, [store]);

  const devLogin = async () => {
    const name = await promptDialog({ title: '개발용 로그인', hint: '사용할 이름', action: '시작' });
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await store.signInAsDev(name);
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e, '로그인에 실패했어요.'));
      setBusy(false);
    }
  };

  const google = () => {
    setBusy(true);
    store.signInWithGoogle();
  };

  const googleEnabled = Boolean(config?.googleWebEnabled);
  const devEnabled = Boolean(config?.devLoginEnabled);

  return (
    <main className="safe-px flex min-h-dvh items-center justify-center py-10">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <img src="/icon-192.png" alt="" width={72} height={72} className="mb-5 rounded-[22%]" />
        <h1 className="text-[34px] font-black tracking-tight">Todo Buddy</h1>
        <p className="mt-2 text-sm text-subtle">친구·크루와 하루치 할 일을 나눠요</p>

        <div className="mt-10 flex w-full flex-col gap-2.5">
          {!config ? (
            <div className="flex justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              {googleEnabled && (
                <Button size="lg" block icon="login" disabled={busy} onClick={google}>
                  Google 계정으로 로그인
                </Button>
              )}
              {devEnabled && (
                <Button size="lg" block variant="outlined" disabled={busy} onClick={devLogin}>
                  이름만으로 시작하기 (개발용)
                </Button>
              )}
              {!googleEnabled && devEnabled && (
                <p className="mt-4 text-xs whitespace-pre-line text-subtle">
                  {'server/.env 에 GOOGLE_WEB_CLIENT_ID 를 넣으면\nGoogle 로그인이 켜져요.'}
                </p>
              )}
              {!googleEnabled && !devEnabled && !error && (
                <p className="text-sm text-subtle">지금은 사용할 수 있는 로그인 수단이 없어요.</p>
              )}
            </>
          )}
        </div>

        {busy && (
          <div className="mt-6 w-full">
            <LinearProgress />
          </div>
        )}
        <ErrorText className="mt-5 text-center">{error}</ErrorText>

        <Link to="/settings" className="mt-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-chip">
          <Icon name="settings" size={18} />앱 설정
        </Link>
      </div>
    </main>
  );
}
