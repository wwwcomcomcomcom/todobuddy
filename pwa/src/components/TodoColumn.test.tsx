import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, signIn } from '../test/render';

// app/test/todo_editing_test.dart 의 시나리오. 픽셀 단위의 행 높이 검사는 e2e(Playwright) 가 맡는다.

const input = () => screen.getByRole('textbox', { name: /새 할 일|할 일 이름/ }) as HTMLInputElement;
const noInput = () => expect(screen.queryByRole('textbox', { name: /새 할 일|할 일 이름/ })).toBeNull();

async function setup() {
  const ctx = renderApp();
  await signIn(ctx);
  const compose = async (title: string, category = '회사에서 할 일') => {
    await ctx.user.click(screen.getByRole('button', { name: `${category}에 할 일 추가` }));
    await ctx.user.clear(input());
    if (title) await ctx.user.type(input(), title);
  };
  const clickOutside = () => ctx.user.click(screen.getByText('프로필에 자기소개를 입력해보세요'));
  const writes = () => ctx.server.todoWrites;
  return { ...ctx, compose, clickOutside, writes };
}

describe('할 일 추가·수정', () => {
  it('새 할 일은 바깥 클릭으로 저장되고 입력창이 닫힌다', async () => {
    const t = await setup();
    await t.compose('  책 읽기  ');
    await t.clickOutside();
    await screen.findByText('책 읽기');
    expect(t.writes()).toHaveLength(1);
    expect(t.writes()[0]).toMatchObject({ method: 'POST', body: { categoryId: 1, date: '2026-09-15', title: '책 읽기' } });
    noInput();
  });

  it('Enter 저장 후에는 빈 입력창과 포커스를 유지해 연속 추가한다', async () => {
    const t = await setup();
    await t.compose('첫 번째 할 일');
    const field = input();
    await t.user.keyboard('{Enter}');
    await screen.findByText('첫 번째 할 일');
    await waitFor(() => expect(input().readOnly).toBe(false));
    expect(input()).toBe(field);
    expect(field.value).toBe('');
    expect(document.activeElement).toBe(field);

    await t.user.type(field, '두 번째 할 일');
    await t.clickOutside();
    await screen.findByText('두 번째 할 일');
    expect(t.writes()).toHaveLength(2);
    expect(t.writes()[1].body).toMatchObject({ title: '두 번째 할 일' });
  });

  it('한글 조합 중의 Enter 는 저장하지 않는다', async () => {
    const t = await setup();
    await t.compose('안녕');
    // Chrome·Firefox: isComposing, Safari: keyCode 229
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input(), { key: 'Enter', keyCode: 229 });
    expect(t.writes()).toHaveLength(0);
    expect(input().value).toBe('안녕');

    fireEvent.keyDown(input(), { key: 'Enter' });
    await screen.findByText('안녕');
    expect(t.writes()).toHaveLength(1);
  });

  for (const target of ['글자 영역', '글자 옆 빈 영역'] as const) {
    it(`기존 할 일 ${target}을 더블 클릭하면 선택된 수정창이 열리고 바깥 클릭으로 저장한다`, async () => {
      const t = await setup();
      const title = screen.getByText('디자인 리뷰 준비');
      // 제목 칸은 행의 남은 너비를 다 차지하므로 빈 영역도 같은 요소다.
      expect(title.getAttribute('data-testid')).toBe('todo-title');
      await t.user.dblClick(title);

      const field = input();
      expect(document.activeElement).toBe(field);
      expect(field.value).toBe('디자인 리뷰 준비');
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, 9]);
      await t.user.clear(field);
      await t.user.type(field, '디자인 리뷰 마무리');
      await t.clickOutside();

      await screen.findByText('디자인 리뷰 마무리');
      expect(t.writes()).toEqual([expect.objectContaining({ method: 'PATCH', path: '/todos/11', body: { title: '디자인 리뷰 마무리' } })]);
      noInput();
    });
  }

  it('기존 할 일 수정은 Enter 로도 저장하고 닫는다', async () => {
    const t = await setup();
    await t.user.dblClick(screen.getByText('러닝 30분'));
    await t.user.clear(input());
    await t.user.type(input(), '러닝 40분{Enter}');
    await screen.findByText('러닝 40분');
    expect(t.writes()[0].body).toEqual({ title: '러닝 40분' });
    noInput();
  });

  it('빈 입력의 바깥 클릭과 닫기 버튼·Escape 는 저장하지 않는다', async () => {
    const t = await setup();
    await t.compose('   ');
    await t.clickOutside();
    noInput();

    await t.compose('저장하지 않을 새 할 일');
    await t.user.click(screen.getByRole('button', { name: '작성 취소' }));
    noInput();

    await t.user.dblClick(screen.getByText('디자인 리뷰 준비'));
    await t.user.clear(input());
    await t.user.type(input(), '저장하지 않을 수정');
    await t.user.click(screen.getByRole('button', { name: '수정 취소' }));
    noInput();

    await t.compose('Escape 로 닫기');
    await t.user.keyboard('{Escape}');
    noInput();

    expect(t.writes()).toHaveLength(0);
    expect(screen.getByText('디자인 리뷰 준비')).toBeTruthy();
  });

  it('Enter 저장 중 바깥 클릭은 중복 저장하지 않는다', async () => {
    const t = await setup();
    let release!: () => void;
    t.server.todoWriteDelay = new Promise((r) => (release = r));
    await t.compose('한 번만 저장');
    await t.user.keyboard('{Enter}');
    await waitFor(() => expect(input().readOnly).toBe(true));
    await t.clickOutside();
    noInput();

    await act(async () => release());
    await screen.findByText('한 번만 저장');
    expect(t.writes()).toHaveLength(1);
    noInput();
  });

  it('다른 카테고리의 추가 버튼을 누르면 이전 입력을 저장하고 새 입력에 포커스를 준다', async () => {
    const t = await setup();
    await t.compose('회사 할 일');
    await t.user.click(screen.getByRole('button', { name: '혼자 하는 일에 할 일 추가' }));
    expect(t.writes()[0].body).toMatchObject({ categoryId: 1 });
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input().value).toBe('');

    await t.user.type(input(), '개인 할 일');
    await t.clickOutside();
    await screen.findByText('개인 할 일');
    expect(t.writes()[1].body).toMatchObject({ categoryId: 2 });
    expect(screen.getByText('회사 할 일')).toBeTruthy();
  });

  it('읽기 전용 카테고리의 할 일은 더블 클릭해도 수정창을 열지 않는다', async () => {
    const ctx = renderApp();
    for (const c of ctx.server.board.categories) c.editable = false;
    await signIn(ctx);
    await ctx.user.dblClick(screen.getByText('디자인 리뷰 준비'));
    noInput();
    expect(ctx.server.todoWrites).toHaveLength(0);
  });

  it('호버 버튼으로 이름을 바꾸거나 삭제한다', async () => {
    const t = await setup();
    const [, deleteButton] = screen.getAllByRole('button', { name: '삭제' });
    await t.user.click(deleteButton);
    await waitFor(() => expect(screen.queryByText('디자인 리뷰 준비')).toBeNull());
    expect(t.server.log).toContain('DELETE /todos/11');

    await t.user.click(screen.getAllByRole('button', { name: '이름 바꾸기' })[0]);
    expect(input().value).toBe('주간 보고서 쓰기');
  });

  it('터치는 한 번 탭으로 수정창을 열고, 수정창에서 삭제할 수 있다', async () => {
    const t = await setup();
    const title = screen.getByText('러닝 30분');
    fireEvent.pointerDown(title, { pointerType: 'touch' });
    fireEvent.click(title);
    expect(input().value).toBe('러닝 30분');
    const composer = input().parentElement!.parentElement!;
    await t.user.click(within(composer).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByText('러닝 30분')).toBeNull());
    expect(t.server.log).toContain('DELETE /todos/12');
  });
});
