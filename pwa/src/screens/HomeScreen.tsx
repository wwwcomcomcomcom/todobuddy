import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Menu, type MenuEntry } from '../components/Menu';
import { MonthCalendar } from '../components/MonthCalendar';
import { ProfileCard } from '../components/ProfileCard';
import { ScopeBar } from '../components/ScopeBar';
import { TodoColumn } from '../components/TodoColumn';
import { Icon } from '../components/Icon';
import { IconButton, Spinner } from '../components/ui';
import { promptInstall, useInstallState } from '../pwa/install';
import { checkForUpdate } from '../pwa/updates';
import { useMediaQuery, usePersistentFlag, WIDE_QUERY } from '../lib/hooks';
import { useApp, useStore } from '../state/context';
import { isOwnScope } from '../state/store';

/** 메인 화면: 넓으면 왼쪽에 프로필·캘린더, 오른쪽에 TODO. 좁으면 한 줄로 쌓고 캘린더를 접을 수 있다. */
export function HomeScreen() {
  const store = useStore();
  const app = useApp();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_QUERY);
  const [calendarCollapsed, setCalendarCollapsed] = usePersistentFlag('todobuddy.calendarCollapsed', false);
  const install = useInstallState();
  const own = isOwnScope(app);
  const board = app.board;

  // 다른 화면에서 돌아올 때마다 사람·보드를 다시 읽는다 (Flutter 의 push().then(refreshAll) 과 같다).
  useEffect(() => {
    void store.refreshAll();
  }, [store]);

  const menu: MenuEntry[] = [
    { icon: 'repeat', label: '반복 일정 추가', onSelect: () => navigate('/routines/new') },
    { icon: 'today', label: '반복 일정 관리', onSelect: () => navigate('/routines') },
    'divider',
    { icon: 'addBox', label: '카테고리 등록', onSelect: () => navigate('/categories/new') },
    { icon: 'tune', label: '카테고리 관리', onSelect: () => navigate('/categories') },
    'divider',
    { icon: 'groups', label: '친구 · 크루', onSelect: () => navigate('/people') },
    { icon: 'today', label: '오늘로 이동', onSelect: () => void store.goToday() },
    'divider',
    { icon: 'download', label: '투두메이트에서 가져오기', onSelect: () => navigate('/import/todomate') },
    { icon: 'refresh', label: '업데이트 확인', onSelect: () => void checkForUpdate({ manual: true }) },
    ...(install.canPrompt && !install.installed
      ? [{ icon: 'install', label: '앱으로 설치', onSelect: () => void promptInstall() } as const]
      : []),
    'divider',
    { icon: 'settings', label: '앱 설정', onSelect: () => navigate('/settings') },
    { icon: 'logout', label: '로그아웃', onSelect: () => void store.signOut() },
  ];

  const calendar = board && (
    <MonthCalendar
      month={app.visibleMonth}
      selectedDate={app.selectedDate}
      segmentsByDate={app.calendar}
      onSelectDate={(d) => void store.selectDate(d)}
      onChangeMonth={(m) => void store.showMonth(m)}
      collapsed={!wide && calendarCollapsed}
      headerExtra={
        !wide && (
          <IconButton
            icon={calendarCollapsed ? 'expandMore' : 'expandLess'}
            label={calendarCollapsed ? '캘린더 펼치기' : '캘린더 접기'}
            size={32}
            onClick={() => setCalendarCollapsed(!calendarCollapsed)}
          />
        )
      }
    />
  );

  return (
    <div className="min-h-dvh">
      <header className="safe-pt safe-px sticky top-0 z-30 bg-white/95 pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <ScopeBar onManagePeople={() => navigate('/people')} />
          <Menu label="메뉴" trigger={<Icon name="menu" size={22} />} items={menu} />
        </div>
        {app.errorMessage && (
          <p role="alert" className="mx-auto mt-1 max-w-6xl text-[13px] text-sunday">
            {app.errorMessage}
          </p>
        )}
      </header>

      <main className="safe-px safe-pb mx-auto max-w-6xl pt-4">
        {!board ? (
          <div className="flex justify-center py-24">
            {app.loadingBoard ? <Spinner /> : <p className="text-subtle">불러올 내용이 없어요</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-8 wide:grid wide:grid-cols-[minmax(320px,380px)_1fr] wide:items-start wide:gap-9">
            <div className="flex flex-col gap-6 wide:sticky wide:top-20">
              <ProfileCard profile={board.profile} editable={own} />
              {calendar}
            </div>
            <TodoColumn board={board} isOwn={own} onManageCategories={() => navigate('/categories')} />
          </div>
        )}
      </main>
    </div>
  );
}
