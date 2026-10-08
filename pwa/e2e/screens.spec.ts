import { expect, test, type Page } from '@playwright/test';
import { apiPost, devLogin, todoTitle, unique } from './helpers';

// 메인 밖의 화면들(기능 대조표)을 실제 서버를 상대로 한 바퀴 돈다.

const today = (page: Page) => page.evaluate(() => new Date().toLocaleDateString('sv-SE'));

test('카테고리 공개 범위·공유 대상·색을 바꾸고 삭제한다', async ({ page }) => {
  await devLogin(page, unique('카테'));
  const crew = await apiPost<{ id: number; name: string }>(page, '/crews', { name: unique('크루') });
  const category = await apiPost(page, '/categories', { name: '편집할 것', visibility: 'private' });

  await page.goto('/categories');
  await page.getByRole('button', { name: /^편집할 것.* 편집$/ }).click();
  await page.getByRole('button', { name: /공개설정/ }).click();
  await page.getByRole('dialog', { name: '공개설정' }).getByRole('radio', { name: '선택한 크루·친구' }).click();
  await page.getByRole('checkbox', { name: new RegExp(crew.name) }).check();
  await page.getByRole('button', { name: /색상/ }).click();
  await page.getByRole('dialog', { name: '색상' }).getByRole('radio', { name: '#7BC47F' }).click();
  await page.getByRole('button', { name: '완료' }).click();

  await expect(page.getByText('1곳 공유')).toBeVisible();
  const saved = await page.evaluate(() => fetch('/api/categories').then((r) => r.json()));
  expect(saved[0]).toMatchObject({ visibility: 'shared', color: '#7BC47F', shares: [{ targetType: 'crew', targetId: crew.id }] });

  await page.getByRole('button', { name: /^편집할 것.* 편집$/ }).click();
  await page.getByRole('button', { name: '카테고리 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('아직 카테고리가 없어요')).toBeVisible();
});

test('반복 일정을 미리보기로 확인해 저장하고, 기록 옵션을 골라 삭제한다', async ({ page }) => {
  await devLogin(page, unique('반복'));
  await apiPost(page, '/categories', { name: '루틴', visibility: 'private' });

  await page.goto('/routines/new');
  await page.getByPlaceholder('예: 책 20분 읽기').fill('물 마시기');
  await page.getByRole('radio', { name: '주마다' }).click();
  // 미리보기 5개가 나와야 저장할 수 있다.
  await expect(page.getByText(/^\d{4}-\d{2}-\d{2} \([월화수목금토일]\)$/)).toHaveCount(5);
  await page.getByRole('button', { name: '반복 일정 저장' }).click();

  await page.goto('/routines');
  await expect(page.getByText('물 마시기')).toBeVisible();
  await expect(page.getByText(/^매주 /)).toBeVisible();

  // 오늘 요일로 만들었으니 메인의 오늘 목록에 반복 표시와 함께 보인다.
  await page.goto('/');
  await expect(todoTitle(page, '물 마시기')).toBeVisible();
  await expect(page.getByText('반복 일정', { exact: true })).toBeVisible();

  await page.goto('/routines');
  await page.getByRole('button', { name: '반복 일정 삭제' }).click();
  const dialog = page.getByRole('dialog', { name: '반복 일정을 삭제할까요?' });
  await dialog.getByRole('checkbox', { name: /오늘 일정도 삭제 \(1개\)/ }).check();
  await expect(dialog.getByText(/오늘 1개 삭제/)).toBeVisible();
  await dialog.getByRole('button', { name: '반복 일정 삭제' }).click();
  await expect(page.getByText('아직 반복 일정이 없어요.')).toBeVisible();
  await page.goto('/');
  await expect(todoTitle(page, '물 마시기')).toHaveCount(0);
});

test('친구를 검색해 요청하고 취소한다', async ({ page }) => {
  await devLogin(page, unique('검색'));
  await page.goto('/people');
  await page.getByRole('searchbox').fill('민서');
  await page.getByRole('button', { name: '검색' }).click();
  await page.getByRole('button', { name: '친구 요청' }).click();
  await expect(page.getByText('민서님에게 요청을 보냈어요')).toBeVisible();
  await expect(page.getByText('수락 대기 중')).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('수락 대기 중')).toHaveCount(0);
});

test('크루를 만들면 칩에 생기고, 초대코드로 다른 사람이 참여하며, 방장은 혼자 남아야 삭제할 수 있다', async ({ page, browser }) => {
  await devLogin(page, unique('방장'));
  const name = unique('조');
  await page.goto('/people?tab=crews');
  await page.getByRole('button', { name: '크루 만들기' }).click();
  await page.getByRole('dialog').getByPlaceholder('크루 이름').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click();
  const row = page.getByRole('listitem').filter({ hasText: name });
  await expect(row).toBeVisible();
  const code = (await row.textContent())!.match(/초대코드 ([0-9A-F]{8})/)![1];

  const other = await browser.newPage();
  await devLogin(other, unique('조원'));
  await other.goto('/people?tab=crews');
  await other.getByRole('button', { name: '초대코드로 참여' }).click();
  await other.getByRole('dialog').getByPlaceholder('예: A1B2C3D4').fill(code);
  await other.getByRole('dialog').getByRole('button', { name: '참여' }).click();
  await expect(other.getByText(`${name} 크루에 참여했어요`)).toBeVisible();
  await other.goto('/');
  await other.getByRole('navigation', { name: '보드 고르기' }).getByRole('button', { name }).click();
  await expect(other.getByRole('button', { name: `초대코드 ${code}` })).toBeVisible();
  await expect(other.getByRole('region', { name: '프로필' }).getByText(name)).toBeVisible();

  await page.goto('/people?tab=crews');
  await row.getByRole('button', { name: '크루 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '크루 삭제' }).click();
  await expect(page.getByText('크루원이 남아 있는 동안에는 방장이 나갈 수 없어요.')).toBeVisible();

  await other.goto('/people?tab=crews');
  await other.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: '나가기' }).click();
  await other.getByRole('dialog').getByRole('button', { name: '나가기' }).click();
  await expect(other.getByText('아직 참여한 크루가 없어요')).toBeVisible();
  await other.close();

  await page.reload();
  await row.getByRole('button', { name: '크루 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '크루 삭제' }).click();
  await expect(page.getByText('아직 참여한 크루가 없어요')).toBeVisible();
});

test('프로필 이름·소개를 바꾸고 사진을 올린다', async ({ page }) => {
  await devLogin(page, unique('사진'));
  await page.getByRole('button', { name: '프로필 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '프로필 수정' });
  await dialog.getByTestId('avatar-input').setInputFiles('public/icon-192.png');
  await expect(dialog.locator('img[src^="/uploads/"]')).toBeVisible();
  await dialog.getByLabel('이름').fill('사진 올린 사람');
  await dialog.getByLabel('한 줄 소개').fill('안녕하세요');
  await dialog.getByRole('button', { name: '완료' }).click();

  const profile = page.getByRole('region', { name: '프로필' });
  await expect(profile.getByText('사진 올린 사람')).toBeVisible();
  await expect(profile.getByText('안녕하세요')).toBeVisible();
  await expect(profile.locator('img[src^="/uploads/"]')).toBeVisible();
  // 업로드한 파일을 /uploads 프록시로 실제로 읽을 수 있다.
  const src = await profile.locator('img').getAttribute('src');
  expect((await page.request.get(src!)).headers()['content-type']).toBe('image/png');
});

test('투두메이트에서 가져오면 카테고리와 할 일이 생긴다 (구글 API 는 가짜)', async ({ page }) => {
  await devLogin(page, unique('투두'));
  const date = await today(page);
  const [y, m, d] = date.split('-').map(Number);
  const ms = String(Date.UTC(y, m - 1, d));

  await page.route('**/api/todomate/config', (r) => r.fulfill({ json: { apiKey: 'fake-key', projectId: 'fake-project' } }));
  await page.route('https://identitytoolkit.googleapis.com/**', (r) => r.fulfill({ json: { idToken: 'fake-token', localId: 'u1' } }));
  await page.route('https://firestore.googleapis.com/**', async (r) => {
    expect(r.request().url()).toContain('/projects/fake-project/');
    const collection = r.request().postDataJSON().structuredQuery.from[0].collectionId;
    const doc = (id: string, fields: Record<string, unknown>) => ({ document: { name: `x/${collection}/${id}`, fields } });
    await r.fulfill({
      json:
        collection === 'Goal'
          ? [doc('g1', { title: { stringValue: '투두메이트 목표' }, color: { integerValue: '-8655630' }, visibility: { stringValue: 'public' } })]
          : [
              doc('t1', { content: { stringValue: '가져온 일' }, date: { integerValue: ms }, completed: { booleanValue: true }, goalID: { stringValue: 'g1' } }),
              doc('t2', { content: { stringValue: '아직 안 한 일' }, date: { integerValue: ms }, completed: { booleanValue: false }, goalID: { stringValue: 'g1' } }),
            ],
    });
  });

  await page.goto('/import/todomate');
  await page.getByLabel('투두메이트 이메일').fill('me@example.com');
  await page.getByLabel('비밀번호').fill('secret');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '일정 불러오기' }).click();
  await expect(page.getByText('가져온 일')).toBeVisible();
  await page.getByRole('button', { name: 'TodoBuddy로 가져오기' }).click();

  await expect(page.getByText('2건의 할 일을 가져왔어요.')).toBeVisible();
  await expect(page.getByText('투두메이트 목표')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '가져온 일' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('checkbox', { name: '아직 안 한 일' })).toHaveAttribute('aria-checked', 'false');
});
