import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../components/Icon';
import { Button, ErrorText, ScreenHeader, Spinner, visibilityIcon } from '../components/ui';
import { errorMessage } from '../lib/api';
import type { Category } from '../lib/models';
import { useStore } from '../state/context';

const nameOf = (list: Category[], id: unknown) => list.find((c) => c.id === id)?.name ?? '카테고리';

/** 카테고리 관리: 순서를 바꾸고, 편집 화면으로 들어간다. */
export default function CategoryManageScreen() {
  const store = useStore();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.api
      .categories()
      .then(setCategories)
      .catch((e) => {
        setCategories([]);
        setError(errorMessage(e, '카테고리를 불러오지 못했어요.'));
      });
  }, [store]);

  // 마우스는 조금 움직여야, 터치는 잠깐 눌러야 집어 든다 (그냥 스크롤·탭과 구분).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!categories || !over || active.id === over.id) return;
    const next = arrayMove(categories, categories.findIndex((c) => c.id === active.id), categories.findIndex((c) => c.id === over.id));
    setCategories(next);
    if (!(await store.reorderCategories(next.map((c) => c.id)))) setError(store.getSnapshot().errorMessage);
  };

  return (
    <>
      <ScreenHeader title="카테고리 관리" />
      <main className="safe-px safe-pb mx-auto max-w-2xl pt-3">
        <p className="mb-6 text-sm text-subtle">카테고리 항목을 눌러 편집하거나, 손잡이를 끌어 순서를 바꿀 수 있어요.</p>
        <div className="mb-3 flex items-center">
          <h2 className="text-base font-extrabold">일반</h2>
          <Button variant="tonal" icon="add" className="ml-auto" onClick={() => navigate('/categories/new')}>
            추가하기
          </Button>
        </div>
        <ErrorText className="mb-3">{error}</ErrorText>

        {!categories ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : categories.length === 0 ? (
          <p className="py-16 text-center text-subtle">아직 카테고리가 없어요</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable: '스페이스나 엔터로 집어 들고, 위아래 방향키로 옮긴 뒤 다시 스페이스나 엔터로 내려놓아요. Escape 는 취소예요.',
              },
              announcements: {
                onDragStart: ({ active }) => `${nameOf(categories, active.id)}를 집어 들었어요.`,
                onDragOver: ({ active, over }) =>
                  over ? `${nameOf(categories, active.id)}가 ${nameOf(categories, over.id)} 자리에 있어요.` : undefined,
                onDragEnd: ({ active, over }) =>
                  over ? `${nameOf(categories, active.id)}를 ${nameOf(categories, over.id)} 자리에 내려놓았어요.` : '제자리로 돌아갔어요.',
                onDragCancel: ({ active }) => `${nameOf(categories, active.id)} 옮기기를 취소했어요.`,
              },
            }}
          >
            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2.5" aria-label="카테고리 목록">
                {categories.map((c) => (
                  <SortableRow key={c.id} category={c} onEdit={() => navigate(`/categories/${c.id}`)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </>
  );
}

function SortableRow({ category, onEdit }: { category: Category; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const shareCount = category.shares?.length ?? 0;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center rounded-[14px] bg-chip ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
    >
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 py-[18px] pl-[18px] text-left">
        <Icon name={visibilityIcon[category.visibility]} size={18} className="shrink-0 text-subtle" />
        <span className="truncate text-base font-extrabold" style={{ color: category.color }}>
          {category.name}
        </span>
        {category.visibility === 'shared' && shareCount > 0 && <span className="shrink-0 text-xs text-subtle">{shareCount}곳 공유</span>}
        <span className="ml-auto shrink-0 text-sm font-semibold text-subtle">편집</span>
      </button>
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${category.name} 순서 바꾸기`}
        className="mx-1.5 inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-subtle hover:bg-blob active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="drag" size={20} />
      </button>
    </li>
  );
}
