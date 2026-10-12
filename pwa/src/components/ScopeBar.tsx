import { useApp, useStore } from '../state/context';
import { scopeOf, scopeTargets } from '../state/store';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

/** 화면 맨 위의 "나 · 크루 · 친구" 칩 줄. */
export function ScopeBar({ onManagePeople }: { onManagePeople: () => void }) {
  const store = useStore();
  const app = useApp();
  const pending = app.friendBook.incoming.length;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <nav aria-label="보드 고르기" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-2 py-1">
          {scopeTargets(app).map((p) => {
            const scope = scopeOf(app, p);
            const selected = app.scope === scope;
            return (
              <li key={`${p.type}:${p.id}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void store.selectScope(scope)}
                  className={`flex items-center gap-2 rounded-full py-[5px] pr-3 pl-[5px] text-[13px] font-bold whitespace-nowrap transition-colors ${
                    selected ? 'bg-ink text-white' : 'bg-chip text-ink hover:bg-blob'
                  }`}
                >
                  <Avatar name={p.name} url={p.avatarUrl} size={26} crew={p.type === 'crew'} />
                  {p.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={onManagePeople}
        aria-label={pending > 0 ? `친구·크루 관리 (받은 요청 ${pending}개)` : '친구·크루 관리'}
        title="친구·크루 관리"
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-chip hover:bg-blob"
      >
        <Icon name="groups" size={18} />
        {pending > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-sunday px-1 text-center text-[10px] leading-[18px] font-bold text-white">
            {pending}
          </span>
        )}
      </button>
    </div>
  );
}
