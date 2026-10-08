import { useSyncExternalStore } from 'react';

// "앱으로 설치". Chromium 계열은 beforeinstallprompt 로 직접 띄우고, iOS 는 공유 → 홈 화면에 추가를 안내한다.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 이벤트를 놓치지 않도록 앱이 뜨자마자 부른다. */
export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): Platform {
  // iPadOS 는 데스크탑 Safari 처럼 보이지만 터치 포인트가 있다.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

const snapshot = () => (installed ? 'installed' : deferred ? 'promptable' : 'none');

export function useInstallState() {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    snapshot,
  );
  return { canPrompt: state === 'promptable', installed: state === 'installed' || isStandalone(), platform: detectPlatform() };
}
