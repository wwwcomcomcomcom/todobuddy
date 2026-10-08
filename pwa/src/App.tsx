import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router';
import { DialogHost } from './components/dialogs';
import { ToastHost } from './components/toast';
import { Spinner } from './components/ui';
import { StoreProvider, useApp, useStore } from './state/context';
import type { AppStore } from './state/store';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OfflineScreen } from './screens/OfflineScreen';

// 메인 화면 밖의 화면들은 필요할 때 읽는다 (첫 화면을 가볍게).
const CategoryManageScreen = lazy(() => import('./screens/CategoryManageScreen'));
const CategoryFormScreen = lazy(() => import('./screens/CategoryFormScreen'));
const RoutineManageScreen = lazy(() => import('./screens/RoutineManageScreen'));
const RoutineFormScreen = lazy(() => import('./screens/RoutineFormScreen'));
const PeopleScreen = lazy(() => import('./screens/PeopleScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const TodoMateImportScreen = lazy(() => import('./screens/TodoMateImportScreen'));

export function App({ store, initialPath, extra }: { store: AppStore; initialPath?: string; extra?: ReactNode }) {
  const routes = <Root />;
  return (
    <StoreProvider store={store}>
      {initialPath ? <MemoryRouter initialEntries={[initialPath]}>{routes}</MemoryRouter> : <BrowserRouter>{routes}</BrowserRouter>}
      <DialogHost />
      <ToastHost />
      {extra}
    </StoreProvider>
  );
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner />
    </div>
  );
}

function Root() {
  const store = useStore();
  const { status } = useApp();

  useEffect(() => {
    if (store.getSnapshot().status === 'unknown') void store.restoreSession();
  }, [store]);

  if (status === 'unknown') return <FullScreenSpinner />;
  if (status === 'offline') return <OfflineScreen />;

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        {status === 'signedOut' ? (
          <Route path="*" element={<LoginScreen />} />
        ) : (
          <>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/categories" element={<CategoryManageScreen />} />
            <Route path="/categories/new" element={<CategoryFormScreen />} />
            <Route path="/categories/:id" element={<CategoryFormScreen />} />
            <Route path="/routines" element={<RoutineManageScreen />} />
            <Route path="/routines/new" element={<RoutineFormScreen />} />
            <Route path="/routines/:id" element={<RoutineFormScreen />} />
            <Route path="/people" element={<PeopleScreen />} />
            <Route path="/import/todomate" element={<TodoMateImportScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}
