import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { AppStore } from '../state/store';
import { FakeServer } from './fakeServer';

/** 가짜 서버에 붙인 앱을 띄운다. 날짜는 가짜 보드와 같은 2026-09-15 로 고정한다. */
export function renderApp({ server = new FakeServer(), path = '/' }: { server?: FakeServer; path?: string } = {}) {
  const store = new AppStore({
    api: server.api(),
    initial: { selectedDate: '2026-09-15', visibleMonth: { year: 2026, month: 9 } },
  });
  const user = userEvent.setup();
  const view = render(<App store={store} initialPath={path} />);
  return { server, store, user, ...view };
}

/** 개발용 로그인을 거쳐 메인 화면까지 들어간다. */
export async function signIn(ctx: ReturnType<typeof renderApp>) {
  await ctx.user.click(await screen.findByRole('button', { name: '이름만으로 시작하기 (개발용)' }));
  await ctx.user.type(screen.getByPlaceholderText('사용할 이름'), '하루');
  await ctx.user.click(screen.getByRole('button', { name: '시작' }));
  await screen.findByText('디자인 리뷰 준비');
}
