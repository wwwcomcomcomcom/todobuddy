import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { confirmDialog, promptDialog } from '../components/dialogs';
import { Icon } from '../components/Icon';
import { copyText, toast } from '../components/toast';
import { Button, IconButton, inputClass, ScreenHeader, SectionTitle } from '../components/ui';
import { errorMessage } from '../lib/api';
import { isSubmitEnter } from '../lib/keys';
import type { Friend, Profile } from '../lib/models';
import { useApp, useStore } from '../state/context';

type Tab = 'friends' | 'crews';

/** 친구·크루를 관리하는 화면. `?tab=crews` 로 크루 탭을 바로 연다. */
export default function PeopleScreen() {
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'crews' ? 'crews' : 'friends';

  useEffect(() => {
    void store.refreshPeople();
  }, [store]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'friends', label: '친구' },
    { id: 'crews', label: '크루' },
  ];

  return (
    <>
      <ScreenHeader title="친구 · 크루" />
      <div className="safe-px sticky top-[calc(3.5rem+max(0.75rem,env(safe-area-inset-top)))] z-10 border-b border-line bg-white">
        <div role="tablist" aria-label="친구 · 크루" className="mx-auto grid max-w-2xl grid-cols-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setParams(t.id === 'crews' ? { tab: 'crews' } : {}, { replace: true })}
              className={`border-b-2 py-3 text-[15px] font-bold ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-subtle'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <main
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="safe-px safe-pb mx-auto max-w-2xl pt-5"
      >
        {tab === 'friends' ? <FriendsTab /> : <CrewsTab />}
      </main>
    </>
  );
}

// ---------------------------------------------------------------- 친구

function FriendsTab() {
  const store = useStore();
  const { me, friendBook: book } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return setResults([]);
    setSearching(true);
    try {
      const found = await store.api.searchUsers(q);
      setResults(found);
      if (found.length === 0) toast('그런 사용자를 찾지 못했어요.');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const request = (p: Profile) =>
    run(async () => {
      const status = await store.requestFriend({ userId: p.id });
      toast(status === 'accepted' ? `${p.name}님과 친구가 되었어요!` : `${p.name}님에게 요청을 보냈어요`);
      setResults([]);
      setQuery('');
    });

  const remove = async (f: Friend) => {
    const ok = await confirmDialog({
      title: `${f.name}님을 친구에서 삭제할까요?`,
      message: '서로의 카테고리 공유도 함께 해제돼요.',
      confirm: '삭제',
      danger: true,
    });
    if (ok) await run(() => store.removeFriend(f.friendshipId));
  };

  return (
    <>
      <form
        role="search"
        className="flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">이름 또는 아이디로 친구 찾기</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            className={`${inputClass} pl-10`}
            placeholder="이름 또는 아이디로 친구 찾기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // 조합 중 Enter 가 폼 제출로 새지 않게 막는다.
              if (e.key === 'Enter' && !isSubmitEnter(e)) e.preventDefault();
            }}
          />
        </label>
        <Button type="submit" disabled={searching}>
          검색
        </Button>
      </form>
      {me?.handle && (
        <div className="mt-2 flex items-center gap-1 text-xs text-subtle">
          내 아이디: @{me.handle}
          <IconButton icon="copy" label="아이디 복사" size={28} iconSize={14} onClick={() => void copyText(`@${me.handle}`, '아이디를 복사했어요')} />
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-2">
          {results.map((p) => (
            <PersonRow key={p.id} profile={p} subtitle={`@${p.handle}`}>
              <Button variant="text" size="sm" onClick={() => void request(p)}>
                친구 요청
              </Button>
            </PersonRow>
          ))}
        </ul>
      )}

      {book.incoming.length > 0 && (
        <>
          <SectionTitle>받은 요청</SectionTitle>
          <ul>
            {book.incoming.map((f) => (
              <PersonRow key={f.friendshipId} profile={f} subtitle={`@${f.handle}`}>
                <Button variant="text" size="sm" onClick={() => void run(() => store.acceptFriend(f.friendshipId))}>
                  수락
                </Button>
                <Button variant="text" size="sm" className="text-subtle" onClick={() => void run(() => store.removeFriend(f.friendshipId))}>
                  거절
                </Button>
              </PersonRow>
            ))}
          </ul>
        </>
      )}

      {book.outgoing.length > 0 && (
        <>
          <SectionTitle>보낸 요청</SectionTitle>
          <ul>
            {book.outgoing.map((f) => (
              <PersonRow key={f.friendshipId} profile={f} subtitle="수락 대기 중">
                <Button variant="text" size="sm" className="text-subtle" onClick={() => void run(() => store.removeFriend(f.friendshipId))}>
                  취소
                </Button>
              </PersonRow>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>내 친구</SectionTitle>
      {book.friends.length === 0 && <p className="py-4 text-subtle">아직 친구가 없어요</p>}
      <ul>
        {book.friends.map((f) => (
          <PersonRow key={f.friendshipId} profile={f} subtitle={`@${f.handle}`}>
            <Button variant="dangerText" size="sm" onClick={() => void remove(f)}>
              친구 삭제
            </Button>
          </PersonRow>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- 크루

function CrewsTab() {
  const store = useStore();
  const { me, crews } = useApp();

  const create = async () => {
    const name = await promptDialog({ title: '크루 만들기', hint: '크루 이름', action: '만들기' });
    if (!name) return;
    try {
      const crew = await store.createCrew(name);
      toast(`${crew.name} 크루를 만들었어요. 초대코드 ${crew.inviteCode}`);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const join = async () => {
    const code = await promptDialog({ title: '초대코드로 참여', hint: '예: A1B2C3D4', action: '참여' });
    if (!code) return;
    try {
      const crew = await store.joinCrew(code);
      toast(`${crew.name} 크루에 참여했어요`);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const leave = async (crew: Profile) => {
    const owner = crew.ownerId === me?.id;
    const ok = await confirmDialog({
      title: owner ? `${crew.name} 크루를 삭제할까요?` : `${crew.name} 크루에서 나갈까요?`,
      message: owner ? '방장은 혼자 남았을 때만 나갈 수 있고, 나가면 크루가 삭제돼요.' : '이 크루에 공유하던 카테고리도 함께 해제돼요.',
      confirm: owner ? '크루 삭제' : '나가기',
      danger: true,
    });
    if (!ok) return;
    try {
      await store.leaveCrew(crew.id);
      toast(`${crew.name} 크루에서 나왔어요`);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button icon="add" onClick={() => void create()}>
          크루 만들기
        </Button>
        <Button variant="outlined" icon="key" onClick={() => void join()}>
          초대코드로 참여
        </Button>
      </div>
      <SectionTitle>내 크루</SectionTitle>
      {crews.length === 0 && <p className="py-4 text-subtle">아직 참여한 크루가 없어요</p>}
      <ul>
        {crews.map((crew) => (
          <PersonRow key={crew.id} profile={crew} crew subtitle={`멤버 ${crew.memberCount ?? 0}명 · 초대코드 ${crew.inviteCode}`}>
            <IconButton icon="copy" label="초대코드 복사" iconSize={16} className="text-subtle" onClick={() => void copyText(crew.inviteCode ?? '', '초대 코드를 복사했어요')} />
            <Button variant="dangerText" size="sm" onClick={() => void leave(crew)}>
              {crew.ownerId === me?.id ? '크루 삭제' : '나가기'}
            </Button>
          </PersonRow>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- 공용 조각

function PersonRow({ profile, subtitle, crew = false, children }: { profile: Profile; subtitle: string; crew?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={profile.name} url={profile.avatarUrl} size={40} crew={crew} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{profile.name}</p>
        <p className="truncate text-xs text-subtle">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </li>
  );
}
