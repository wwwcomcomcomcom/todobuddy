import { useEffect, useRef, useState } from 'react';
import { isComposing, isSubmitEnter } from '../lib/keys';
import { visibilityLabel, type Board, type Category, type Todo } from '../lib/models';
import { useStore } from '../state/context';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Button, visibilityIcon } from './ui';

/** 오른쪽 열: 선택한 날짜의 카테고리별 TODO 목록. */
export function TodoColumn({ board, isOwn, onManageCategories }: { board: Board; isOwn: boolean; onManageCategories: () => void }) {
  /** 지금 새 TODO 입력창이 열려 있는 카테고리. */
  const [composingId, setComposingId] = useState<number | null>(null);
  const showOwner = board.profile.type === 'crew';

  if (board.categories.length === 0) return <EmptyState isOwn={isOwn} onCreate={onManageCategories} />;

  return (
    <section aria-label={`${board.date} 할 일`} className="flex flex-col">
      <div className="flex flex-col gap-5 pb-5">
        {board.categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            showOwner={showOwner}
            composing={composingId === category.id}
            onStartCompose={() => setComposingId(category.id)}
            onEndCompose={() => setComposingId((id) => (id === category.id ? null : id))}
          />
        ))}
      </div>
      {isOwn && (
        <div className="flex justify-end border-t border-line pt-2">
          <Button variant="text" size="sm" icon="list" onClick={onManageCategories}>
            리스트 메뉴
          </Button>
        </div>
      )}
    </section>
  );
}

function CategorySection({
  category, showOwner, composing, onStartCompose, onEndCompose,
}: { category: Category; showOwner: boolean; composing: boolean; onStartCompose: () => void; onEndCompose: () => void }) {
  const store = useStore();
  const todos = category.todos ?? [];
  const editable = Boolean(category.editable);

  return (
    <div role="group" aria-label={category.name}>
      <div className="flex items-center gap-2.5">
        <CategoryPill category={category} onAdd={editable ? onStartCompose : undefined} />
        {showOwner && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={category.owner.name ?? ''} url={category.owner.avatarUrl} size={24} />
            <span className="truncate text-xs font-semibold text-subtle">{category.owner.name}</span>
          </span>
        )}
      </div>
      <ul className="mt-2">
        {todos.length === 0 && !composing && (
          <li className="py-0.5 pl-3 text-xs text-subtle">{editable ? '+ 를 눌러 오늘 할 일을 더해보세요' : '아직 등록된 할 일이 없어요'}</li>
        )}
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} category={category} />
        ))}
        {composing && (
          <li>
            <TodoComposer color={category.color} onSubmit={(title) => store.addTodo(category.id, title)} onClose={onEndCompose} />
          </li>
        )}
      </ul>
    </div>
  );
}

/** 카테고리 이름·색·공개설정 아이콘을 보여주는 칩. 미리보기 화면에서도 재사용한다. */
export function CategoryPill({ category, onAdd }: { category: Pick<Category, 'name' | 'color' | 'visibility'>; onAdd?: () => void }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-3xl bg-chip py-1.5 pr-1.5 pl-3">
      <span title={visibilityLabel[category.visibility]} className="text-subtle">
        <Icon name={visibilityIcon[category.visibility]} size={15} />
        <span className="sr-only">{visibilityLabel[category.visibility]}</span>
      </span>
      <span className="truncate text-sm font-extrabold" style={{ color: category.color }}>
        {category.name}
      </span>
      {onAdd ? (
        <button
          type="button"
          aria-label={`${category.name}에 할 일 추가`}
          title="할 일 추가"
          onClick={onAdd}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white hover:bg-blob"
        >
          <Icon name="add" size={16} />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </div>
  );
}

/** 체크 상태를 보여주는 스퀘어클 체크박스. 미리보기 화면에서도 재사용한다. */
export function TodoCheckbox({ color, checked, onToggle, label }: { color: string; checked: boolean; onToggle?: () => void; label: string }) {
  const box = (
    <span
      className="squircle flex size-[22px] shrink-0 items-center justify-center text-white"
      style={{ background: checked ? color : 'var(--color-blob)' }}
    >
      {checked && <Icon name="check" size={15} />}
    </span>
  );
  if (!onToggle) return <span aria-hidden="true">{box}</span>;
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="shrink-0 rounded-md">
      {box}
    </button>
  );
}

const isTouch = (pointerType: string) => pointerType === 'touch' || pointerType === 'pen';

function TodoRow({ todo, category }: { todo: Todo; category: Category }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const lastPointer = useRef<string>('mouse');
  const editable = Boolean(category.editable);
  const isRoutine = todo.routineId != null;

  if (editing) {
    return (
      <li>
        <TodoComposer
          color={category.color}
          initialText={todo.title}
          onSubmit={(title) => store.renameTodo(todo, title)}
          onClose={() => setEditing(false)}
          onDelete={() => void store.deleteTodo(todo)}
          deleteLabel={isRoutine ? '이 날짜만 삭제' : '삭제'}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-2.5 py-1">
      <TodoCheckbox
        color={category.color}
        checked={todo.done}
        label={todo.title}
        onToggle={editable ? () => void store.toggleTodo(todo) : undefined}
      />
      {isRoutine && (
        <span title="반복 일정 · 수정과 삭제는 이 날짜에만 적용돼요" className="text-subtle">
          <Icon name="repeat" size={14} />
          <span className="sr-only">반복 일정</span>
        </span>
      )}
      {/* 마우스는 더블 클릭, 터치는 한 번 탭으로 수정한다. 글자 옆 빈 영역도 같은 동작이다. */}
      <div
        data-testid="todo-title"
        className={`flex min-h-[22px] flex-1 items-center text-sm leading-5 font-medium ${
          todo.done ? 'text-subtle line-through decoration-subtle' : 'text-ink'
        } ${editable ? 'cursor-text select-none' : ''}`}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType || 'mouse';
        }}
        onClick={() => {
          if (editable && isTouch(lastPointer.current)) setEditing(true);
        }}
        onDoubleClick={() => {
          if (editable && !isTouch(lastPointer.current)) setEditing(true);
        }}
      >
        {todo.title}
      </div>
      {editable && (
        // 호버해도 행 높이가 바뀌지 않도록 자리를 늘 잡아 둔다. 터치 기기에서는 수정 화면에 삭제가 있다.
        <div className="flex w-14 shrink-0 justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
          <MiniAction icon="edit" label="이름 바꾸기" onClick={() => setEditing(true)} />
          <MiniAction icon="close" label={isRoutine ? '이 날짜만 삭제' : '삭제'} onClick={() => void store.deleteTodo(todo)} />
        </div>
      )}
    </li>
  );
}

function MiniAction({ icon, label, onClick }: { icon: 'edit' | 'close' | 'delete'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-[22px] w-7 items-center justify-center rounded-md text-subtle hover:bg-chip hover:text-ink"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/**
 * 새 TODO 입력 / 기존 TODO 이름 수정에 함께 쓰는 한 줄 입력기.
 * - Enter: 저장. 새 항목이면 비우고 포커스를 유지해 연달아 적는다. 수정이면 닫는다.
 * - 바깥 클릭(탭): 저장하고 바로 닫는다. 클릭한 곳의 동작은 그대로 일어난다.
 * - Escape·✕: 저장하지 않고 닫는다.
 * - 한글 조합 중의 Enter 는 글자 확정이라 무시한다.
 */
export function TodoComposer({
  color, initialText, onSubmit, onClose, onDelete, deleteLabel = '삭제',
}: {
  color: string;
  initialText?: string;
  onSubmit: (title: string) => Promise<unknown>;
  onClose: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const [text, setText] = useState(initialText ?? '');
  const [submitting, setSubmitting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useRef({ text, submitting, onSubmit, onClose });
  state.current = { text, submitting, onSubmit, onClose };
  const isEdit = initialText != null;

  const submit = async ({ closeAfter = false } = {}) => {
    const { text: current, submitting: busy, onSubmit: save, onClose: close } = state.current;
    if (busy) {
      if (closeAfter) close();
      return;
    }
    const title = current.trim();
    if (!title) return close();
    setSubmitting(true);
    // 바깥 클릭은 바로 닫아 클릭한 곳의 동작과 포커스를 유지한다.
    if (closeAfter) close();
    try {
      await save(title);
      if (closeAfter) return;
      if (isEdit) {
        close();
      } else {
        setText('');
        input.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const el = input.current!;
    el.focus();
    if (isEdit) el.select();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) void submitRef.current({ closeAfter: true });
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isEdit]);

  return (
    <div ref={root} className="flex items-center gap-2.5 py-1">
      <span className="squircle block size-[22px] shrink-0" style={{ background: `${color}40` }} />
      <div className="relative flex min-h-[22px] flex-1 items-center">
        {/* 여러 줄 제목도 수정 전의 행 높이를 유지한다. */}
        {isEdit && (
          <span aria-hidden="true" className="invisible text-sm leading-5 font-medium">
            {initialText}
          </span>
        )}
        <input
          ref={input}
          aria-label={isEdit ? '할 일 이름' : '새 할 일'}
          value={text}
          readOnly={submitting}
          enterKeyHint={isEdit ? 'done' : 'enter'}
          placeholder="할 일을 입력하고 Enter"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape' && !isComposing(e)) {
              e.preventDefault();
              onClose();
            }
          }}
          className={`${isEdit ? 'absolute inset-x-0 top-1/2 -translate-y-1/2' : ''} h-[22px] w-full bg-transparent p-0 text-sm leading-5 font-medium outline-none placeholder:font-normal placeholder:text-subtle [@media(hover:none)]:text-base`}
        />
      </div>
      <div className="flex w-14 shrink-0 justify-end">
        {onDelete && (
          <span className="hidden [@media(hover:none)]:inline-flex">
            <MiniAction icon="delete" label={deleteLabel} onClick={onDelete} />
          </span>
        )}
        <MiniAction icon="close" label={isEdit ? '수정 취소' : '작성 취소'} onClick={onClose} />
      </div>
    </div>
  );
}

function EmptyState({ isOwn, onCreate }: { isOwn: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon name="inbox" size={44} className="text-blob" />
      <p className="font-semibold text-subtle">{isOwn ? '아직 카테고리가 없어요' : '공유된 카테고리가 없어요'}</p>
      {isOwn && <Button onClick={onCreate}>카테고리 등록</Button>}
    </div>
  );
}
