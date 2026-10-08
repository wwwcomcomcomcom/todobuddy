import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Modal, openDialog } from '../components/dialogs';
import { Icon } from '../components/Icon';
import { Button, Checkbox, ErrorText, IconButton, ScreenHeader, Spinner } from '../components/ui';
import { ApiError, errorMessage, type Api } from '../lib/api';
import type { Category, Routine, RoutineDeletionPreview } from '../lib/models';
import { periodLabel, ruleSummary } from '../lib/routine';
import { useStore } from '../state/context';

/** 반복 일정 목록. 누르면 편집, 휴지통은 기록 정리 옵션이 있는 삭제 다이얼로그. */
export default function RoutineManageScreen() {
  const store = useStore();
  const navigate = useNavigate();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([store.api.routines(), store.api.categories()]);
      if (!alive.current) return;
      setRoutines(list);
      setCategories(cats);
    } catch (e) {
      if (alive.current) setError(errorMessage(e, '목록을 불러오지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = () => void navigate('/routines/new');
  const edit = (routine: Routine) => void navigate(`/routines/${routine.id}`);

  const remove = async (routine: Routine) => {
    const removed = await openDialog<boolean>((close) => <DeleteRoutineDialog routine={routine} api={store.api} close={close} />);
    if (removed !== true) return;
    await store.refreshBoard();
    if (alive.current) await load();
  };

  let body;
  if (loading) {
    body = (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
        <p>{error}</p>
        <Button variant="text" onClick={() => void load()}>
          다시 시도
        </Button>
      </div>
    );
  } else if (routines.length === 0) {
    body = (
      <div className="flex flex-col items-center px-6 py-24 text-center">
        <Icon name="repeat" size={40} className="text-subtle" />
        <p className="mt-4">아직 반복 일정이 없어요.</p>
        <Button className="mt-3" onClick={add}>
          반복 일정 추가
        </Button>
      </div>
    );
  } else {
    body = (
      <main className="safe-px safe-pb mx-auto max-w-[760px] pt-4">
        <ul className="flex flex-col gap-3">
          {routines.map((routine) => {
            const category = categories.find((c) => c.id === routine.categoryId);
            return (
              <li key={routine.id} className="flex items-start rounded-[14px] bg-chip pr-2 transition-colors hover:bg-blob/60">
                <button
                  type="button"
                  onClick={() => edit(routine)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px] py-4 pl-[18px] text-left"
                >
                  <span className="mt-1 shrink-0" style={{ color: category?.color }}>
                    <Icon name="repeat" size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-bold">{routine.title}</span>
                    <span className="mt-1.5 text-sm">{category?.name ?? '카테고리'}</span>
                    <span className="mt-1.5 text-sm">{ruleSummary(routine.rule)}</span>
                    <span className="mt-1 text-xs text-subtle">{periodLabel(routine.startDate, routine.endDate)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 gap-0.5 pt-3">
                  <IconButton icon="edit" label="반복 일정 편집" onClick={() => edit(routine)} />
                  <IconButton icon="delete" label="반복 일정 삭제" onClick={() => void remove(routine)} />
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader title="반복 일정 관리" action={<IconButton icon="add" label="반복 일정 추가" onClick={add} />} />
      {body}
    </div>
  );
}

/** 반복을 멈추고 지난 기록을 얼마나 남길지 고른다. 삭제에 성공하면 true 로 닫힌다. */
function DeleteRoutineDialog({ routine, api, close }: { routine: Routine; api: Api; close: (removed?: boolean) => void }) {
  const [preview, setPreview] = useState<RoutineDeletionPreview | null>(null);
  const [keepDone, setKeepDone] = useState(true);
  const [keepUndone, setKeepUndone] = useState(true);
  const [removeToday, setRemoveToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await api.previewRoutineDeletion(routine.id);
      if (alive.current) setPreview(result);
    } catch (e) {
      if (alive.current) setError(errorMessage(e, '기록을 확인하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, routine.id]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const remove = async () => {
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteRoutine(routine.id, { asOfDate: preview.today, keepPastDone: keepDone, keepPastUndone: keepUndone, removeToday });
      close(true);
    } catch (e) {
      if (!alive.current) return;
      setError(errorMessage(e, '삭제하지 못했어요. 다시 시도해 주세요.'));
      // 자정이 지나 기준일이 바뀌었으면 숫자를 다시 받아야 한다.
      if (e instanceof ApiError && e.code === 'routine_date_changed') setPreview(null);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const pastDeleted = preview ? (keepDone ? 0 : preview.pastDone) + (keepUndone ? 0 : preview.pastUndone) : 0;

  return (
    <Modal
      title="반복 일정을 삭제할까요?"
      wide
      dismissible={!busy}
      closeOnBackdrop={false}
      onDismiss={() => close(false)}
      actions={
        <>
          <Button variant="text" disabled={busy} onClick={() => close(false)}>
            취소
          </Button>
          <Button variant="danger" disabled={busy || !preview} onClick={() => void remove()}>
            {busy ? '삭제 중…' : '반복 일정 삭제'}
          </Button>
        </>
      }
    >
      <p className="font-bold">{routine.title}</p>
      <p className="mt-3 text-sm">반복을 중단하고 앞으로의 일정은 모두 삭제해요.</p>
      {loading && (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      )}
      {preview && (
        <>
          <p className="mt-3 whitespace-pre-line text-[13px] text-subtle">
            {`${preview.today} 기준 · ${routine.timeZone}\n과거는 어제까지의 기록이에요.`}
          </p>
          <div className="mt-1">
            <Checkbox checked={keepDone} disabled={busy} onChange={setKeepDone} label={`과거 완료 일정 유지 (${preview.pastDone}개)`} />
            <Checkbox
              checked={keepUndone}
              disabled={busy}
              onChange={setKeepUndone}
              label={`과거 미완료 일정 유지 (${preview.pastUndone}개)`}
            />
            <Checkbox
              checked={removeToday}
              disabled={busy}
              onChange={setRemoveToday}
              label={`오늘 일정도 삭제 (${preview.todayCount}개)`}
            />
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-sunday">
            {`과거 ${pastDeleted}개 · 오늘 ${removeToday ? preview.todayCount : 0}개 삭제\n내일부터의 일정도 모두 삭제돼요.`}
          </p>
        </>
      )}
      {error && (
        <>
          <ErrorText className="mt-3">{error}</ErrorText>
          {!preview && !loading && (
            <Button variant="text" size="sm" className="mt-1 -ml-2.5" onClick={() => void load()}>
              다시 확인
            </Button>
          )}
        </>
      )}
    </Modal>
  );
}
