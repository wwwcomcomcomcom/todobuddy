import { registerSW } from 'virtual:pwa-register';
import { toast } from '../components/toast';

// 서비스워커 업데이트. 새 버전이 기다리고 있으면 알리기만 하고, 새로고침은 사용자가 고른다.
// (자동으로 새로고침하면 적고 있던 할 일이 날아간다.)

let needRefresh = false;
let registration: ServiceWorkerRegistration | undefined;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

const setNeedRefresh = (value: boolean) => {
  needRefresh = value;
  listeners.forEach((l) => l());
};

export const subscribeUpdate = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const hasUpdate = () => needRefresh;
export const dismissUpdate = () => setNeedRefresh(false);

const HOUR = 60 * 60 * 1000;

export function initServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => setNeedRefresh(true),
    onRegisteredSW: (_url, reg) => {
      registration = reg;
      if (!reg) return;
      // 오래 켜 두는 탭·설치 앱도 새 버전을 알아채도록 가끔, 그리고 다시 볼 때마다 확인한다.
      setInterval(() => void reg.update().catch(() => {}), HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    },
  });
}

/** 새 버전으로 바꾸고 새로고침한다. */
export function applyUpdate() {
  if (updateSW) void updateSW(true);
  else window.location.reload();
}

/** 메뉴의 "업데이트 확인". 새 버전이 있으면 안내가 뜨고, 없으면 알려 준다. */
export async function checkForUpdate({ manual = false }: { manual?: boolean } = {}) {
  if (registration) {
    try {
      await registration.update();
      // 새 서비스워커가 설치를 마치기까지 잠깐 기다린다.
      if (registration.installing) {
        await new Promise<void>((resolve) => {
          const sw = registration!.installing!;
          sw.addEventListener('statechange', () => sw.state !== 'installing' && resolve());
          setTimeout(resolve, 10_000);
        });
      }
    } catch {
      if (manual) toast('업데이트를 확인하지 못했어요. 인터넷 연결을 확인해 주세요.');
      return;
    }
  }
  if (registration?.waiting) setNeedRefresh(true);
  if (manual && !needRefresh) toast('최신 버전이에요.');
}
