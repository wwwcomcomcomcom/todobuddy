import { expect, type Page } from '@playwright/test';

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 720;

/** 개발용 로그인. 이름이 같으면 같은 계정이다 (시드 계정은 '하루'). */
export async function devLogin(page: Page, name = '하루') {
  await page.goto('/');
  await page.getByRole('button', { name: '이름만으로 시작하기 (개발용)' }).click();
  const dialog = page.getByRole('dialog', { name: '개발용 로그인' });
  await dialog.getByPlaceholder('사용할 이름').fill(name);
  await dialog.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '보드 고르기' })).toBeVisible();
}

/** 실험마다 겹치지 않는 이름. */
export const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** 앱과 똑같이 브라우저 안에서 세션 쿠키로 API 를 부른다 (준비 데이터를 빨리 만들 때). */
export async function apiPost<T = { id: number }>(page: Page, path: string, body: unknown): Promise<T> {
  const { status, json } = await page.evaluate(
    async ([p, b]) => {
      const res = await fetch(`/api${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    [path, body] as const,
  );
  expect(status, `${path} ${status}`).toBeLessThan(300);
  return json as T;
}

export const todoTitle = (page: Page, text: string) => page.getByTestId('todo-title').filter({ hasText: new RegExp(`^${text}$`) });
