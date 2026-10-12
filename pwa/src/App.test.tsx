import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, signIn } from './test/render';

describe('로그인과 메인 화면', () => {
  it('로그인 화면은 서버 설정에 맞는 버튼만 보여준다', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Todo Buddy' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: '이름만으로 시작하기 (개발용)' })).toBeTruthy();
    // googleWebEnabled:false 이므로 구글 버튼은 숨는다.
    expect(screen.queryByRole('button', { name: 'Google 계정으로 로그인' })).toBeNull();
  });

  it('로그인하면 프로필·캘린더·TODO 가 한 화면에 그려진다', async () => {
    const ctx = renderApp();
    await signIn(ctx);

    // 상단 스코프 칩: 나 · 크루 · 친구
    const scopes = screen.getByRole('navigation', { name: '보드 고르기' });
    expect(within(scopes).getByRole('button', { name: /달리기모임/ })).toBeTruthy();
    expect(within(scopes).getByRole('button', { name: /민서/ })).toBeTruthy();

    // 왼쪽: 프로필과 캘린더
    expect(screen.getByText('프로필에 자기소개를 입력해보세요')).toBeTruthy();
    expect(screen.getByText('2026년 9월')).toBeTruthy();
    expect(screen.getByRole('button', { name: '15일, 2026년 9월, 남은 할 일 1개' })).toBeTruthy();

    // 오른쪽: 카테고리와 TODO
    expect(screen.getByText('회사에서 할 일')).toBeTruthy();
    expect(screen.getByText('혼자 하는 일')).toBeTruthy();
    expect(screen.getByText('주간 보고서 쓰기')).toBeTruthy();

    expect(ctx.server.log).toContain('GET /board');
    expect(ctx.server.log).toContain('GET /board/calendar');
  });

  it('캘린더 칸은 카테고리 색 띠를 쌓아 칠한다', async () => {
    const ctx = renderApp();
    await signIn(ctx);
    const cell = screen.getByRole('button', { name: /^15일, 2026년 9월/ });
    const colors = [...cell.querySelectorAll('[data-color]')].map((el) => el.getAttribute('data-color'));
    expect(colors).toEqual(['#EE8B8B', '#F5C543']);
  });

  it('세션 쿠키가 살아 있으면 로그인 화면 없이 바로 메인으로 간다', async () => {
    const ctx = renderApp();
    ctx.server.signedIn = true;
    ctx.unmount();
    const again = renderApp({ server: ctx.server });
    expect(await screen.findByText('디자인 리뷰 준비')).toBeTruthy();
    expect(again.server.log).toContain('GET /auth/me');
  });

  it('남의 보드는 읽기 전용이라 추가·체크 버튼이 없다', async () => {
    const ctx = renderApp();
    await signIn(ctx);
    for (const c of ctx.server.board.categories) c.editable = false;
    await ctx.user.click(screen.getByRole('button', { name: /민서/ }));
    await waitFor(() => expect(ctx.server.requests.at(-1)?.query.get('scope')).toBe('user:2'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /할 일 추가/ })).toBeNull());
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: '프로필 수정' })).toBeNull();
  });

  it('체크박스는 먼저 화면을 바꾸고 서버에 알린다', async () => {
    const ctx = renderApp();
    await signIn(ctx);
    const box = screen.getByRole('checkbox', { name: '디자인 리뷰 준비' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    await ctx.user.click(box);
    expect(screen.getByRole('checkbox', { name: '디자인 리뷰 준비' }).getAttribute('aria-checked')).toBe('true');
    expect(ctx.server.todoWrites.at(-1)).toMatchObject({ method: 'PATCH', path: '/todos/11', body: { done: true } });
  });

  it('로그아웃하면 로그인 화면으로 돌아간다', async () => {
    const ctx = renderApp();
    await signIn(ctx);
    await ctx.user.click(screen.getByRole('button', { name: '메뉴' }));
    await ctx.user.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    expect(await screen.findByRole('button', { name: '이름만으로 시작하기 (개발용)' })).toBeTruthy();
    expect(ctx.server.log).toContain('POST /auth/logout');
  });

  it('세션이 만료되면(401) 로그인 화면에 이유를 보여준다', async () => {
    const ctx = renderApp();
    await signIn(ctx);
    ctx.server.interceptor = (req) =>
      req.path === '/board' ? new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) : undefined;
    await ctx.user.click(screen.getByRole('button', { name: /^16일, 2026년 9월/ }));
    expect(await screen.findByText('로그인이 만료되었어요. 다시 로그인해 주세요.')).toBeTruthy();
  });
});
