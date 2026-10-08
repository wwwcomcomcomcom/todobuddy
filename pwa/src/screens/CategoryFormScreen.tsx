import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { confirmDialog } from '../components/dialogs';
import { Icon } from '../components/Icon';
import { pickColor, pickVisibility } from '../components/pickers';
import { Button, ErrorText, SettingRow, Spinner, visibilityIcon } from '../components/ui';
import { ScreenHeader } from '../components/ui';
import { errorMessage } from '../lib/api';
import { palette } from '../lib/colors';
import { isSubmitEnter } from '../lib/keys';
import { visibilityLabel, type Category, type CategoryVisibility, type Profile, type ShareTarget } from '../lib/models';
import { useApp, useStore } from '../state/context';

const sameTarget = (a: ShareTarget, b: ShareTarget) => a.targetType === b.targetType && a.targetId === b.targetId;

/** 카테고리 등록 / 편집 화면. `/categories/new` 또는 `/categories/:id`. */
export default function CategoryFormScreen() {
  const { id } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const editId = id == null ? null : Number(id);

  const [loaded, setLoaded] = useState<Category | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<CategoryVisibility>('private');
  const [color, setColor] = useState(palette[0]);
  const [shares, setShares] = useState<ShareTarget[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/categories'));

  useEffect(() => {
    void store.refreshPeople();
    if (editId == null) return;
    store.api
      .categories()
      .then((list) => {
        const found = list.find((c) => c.id === editId);
        if (!found) return setLoadError('카테고리를 찾지 못했어요.');
        setLoaded(found);
        setName(found.name);
        setVisibility(found.visibility);
        setColor(found.color);
        setShares(found.shares ?? []);
      })
      .catch((e) => setLoadError(errorMessage(e, '카테고리를 불러오지 못했어요.')));
  }, [store, editId]);

  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const ok = await store.saveCategory({
      id: editId ?? undefined,
      name: name.trim(),
      color,
      visibility,
      shares: visibility === 'shared' ? shares : [],
    });
    if (ok) return back();
    setError(store.getSnapshot().errorMessage);
    setBusy(false);
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: '카테고리를 삭제할까요?',
      message: '이 카테고리에 담긴 모든 날짜의 TODO와 반복 일정도 함께 사라져요.',
      confirm: '삭제',
      danger: true,
    });
    if (!ok || editId == null) return;
    setBusy(true);
    if (await store.deleteCategory(editId)) return back();
    setError(store.getSnapshot().errorMessage);
    setBusy(false);
  };

  const header = (
    <ScreenHeader
      title={editId == null ? '카테고리 등록' : '카테고리 편집'}
      onBack={back}
      action={
        <Button variant="text" disabled={!canSave} onClick={save}>
          완료
        </Button>
      }
    />
  );

  if (editId != null && !loaded) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-3 py-20">{loadError ? <ErrorText>{loadError}</ErrorText> : <Spinner />}</div>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="safe-px safe-pb mx-auto flex max-w-2xl flex-col pt-4">
        <input
          autoFocus
          aria-label="카테고리 이름"
          placeholder="카테고리 입력"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault();
              void save();
            }
          }}
          className="border-b-2 border-ink bg-transparent py-2 text-xl font-semibold outline-none placeholder:text-blob"
        />

        <div className="mt-7 flex flex-col gap-3">
          <SettingRow
            label="공개설정"
            onClick={async () => {
              const v = await pickVisibility(visibility);
              if (v) setVisibility(v);
            }}
            value={
              <>
                <Icon name={visibilityIcon[visibility]} size={16} className="text-subtle" />
                {visibilityLabel[visibility]}
              </>
            }
          />
          <SettingRow
            label="색상"
            onClick={async () => {
              const c = await pickColor(color);
              if (c) setColor(c);
            }}
            value={<span className="block size-[22px] rounded-full" style={{ background: color }} aria-label={color} />}
          />
        </div>

        {visibility === 'shared' && (
          <>
            <h2 className="mt-6 mb-2 text-[15px] font-extrabold">공유할 대상</h2>
            <ShareTargetPicker selected={shares} onChange={setShares} />
          </>
        )}
        {visibility === 'public' && <p className="mt-4 text-[13px] text-subtle">공개로 두면 모든 친구와 내가 속한 크루에 자동으로 보여요.</p>}

        <ErrorText className="mt-4">{error}</ErrorText>

        {editId != null && (
          <div className="mt-10">
            <Button variant="dangerText" icon="delete" disabled={busy} onClick={remove}>
              카테고리 삭제
            </Button>
          </div>
        )}
      </main>
    </>
  );
}

/** 내 크루와 친구를 체크박스로 골라 공유 대상을 정한다. */
function ShareTargetPicker({ selected, onChange }: { selected: ShareTarget[]; onChange: (next: ShareTarget[]) => void }) {
  const { crews, friendBook } = useApp();
  const friends = friendBook.friends;

  if (crews.length === 0 && friends.length === 0) {
    return <p className="py-3 text-[13px] text-subtle">아직 크루나 친구가 없어요. 먼저 친구를 추가해보세요.</p>;
  }

  const row = (profile: Profile, target: ShareTarget) => {
    const checked = selected.some((s) => sameTarget(s, target));
    const isCrew = target.targetType === 'crew';
    return (
      <label key={`${target.targetType}:${target.targetId}`} className="flex cursor-pointer items-center gap-3 py-2">
        <input
          type="checkbox"
          className="size-[18px] accent-ink"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? [...selected, target] : selected.filter((s) => !sameTarget(s, target)))}
        />
        <Avatar name={profile.name} url={profile.avatarUrl} size={26} crew={isCrew} />
        <span className="text-sm font-semibold">{profile.name}</span>
        <span className="text-[11px] text-subtle">{isCrew ? '크루' : '친구'}</span>
      </label>
    );
  };

  return (
    <div className="flex flex-col">
      {crews.map((c) => row(c, { targetType: 'crew', targetId: c.id }))}
      {friends.map((f) => row(f, { targetType: 'friend', targetId: f.id }))}
    </div>
  );
}
