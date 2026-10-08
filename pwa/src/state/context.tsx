import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { AppSnapshot, AppStore } from './store';

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider 가 없어요');
  return store;
}

/** 스토어 스냅샷을 구독한다. 화면은 이 훅과 useStore() 의 메서드로만 상태를 다룬다. */
export function useApp(): AppSnapshot {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
