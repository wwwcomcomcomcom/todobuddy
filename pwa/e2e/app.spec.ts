import { expect, test } from '@playwright/test';
import { apiPost, devLogin, isMobile, todoTitle, unique } from './helpers';

// app_test.dart · widget_test.dart · todo_editing_test.dart 의 시나리오를 실제 서버와 브라우저로 돌린다.

test('시드 계정으로 로그인하면 프로필·캘린더·할 일이 그려지고, 새로고침해도 세션이 남는다', async ({ page }) => {
  await devLogin(page);
  const scopes = page.getByRole('navigation', { name: '보드 고르기' });
  await expect(scopes.getByRole('button', { name: /달리기모임/ })).toBeVisible();
  await expect(scopes.getByRole('button', { name: /민서/ })).toBeVisible();
  await expect(page.getByText('프로필에 자기소개를 입력해보세요')).toBeVisible();
  await expect(page.getByRole('region', { name: '캘린더' })).toBeVisible();
  await expect(todoTitle(page, '디자인 리뷰 준비')).toBeVisible();

  await page.reload();
  await expect(todoTitle(page, '디자인 리뷰 준비')).toBeVisible();
  await expect(page.getByRole('button', { name: '이름만으로 시작하기 (개발용)' })).toHaveCount(0);
});

test('할 일을 Enter 로 연달아 추가하고, 바깥을 눌러 저장한다', async ({ page }) => {
  await devLogin(page, unique('추가'));
  await apiPost(page, '/categories', { name: '오늘', visibility: 'private' });
  await page.reload();

  await page.getByRole('button', { name: '오늘에 할 일 추가' }).click();
  const input = page.getByRole('textbox', { name: '새 할 일' });
  await input.fill('첫 번째');
  await input.press('Enter');
  await expect(todoTitle(page, '첫 번째')).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();

  await input.fill('두 번째');
  await page.getByRole('region', { name: '프로필' }).click();
  await expect(todoTitle(page, '두 번째')).toBeVisible();
  await expect(input).toHaveCount(0);

  // 캘린더 오늘 칸에 남은 개수가 칠해진다.
  await expect(page.locator('[aria-current="date"]')).toHaveAccessibleName(/남은 할 일 2개/);

  await page.getByRole('checkbox', { name: '첫 번째' }).click();
  await page.getByRole('checkbox', { name: '두 번째' }).click();
  await expect(page.locator('[aria-current="date"]')).toHaveAccessibleName(/모두 완료/);
});

test('한글 IME 조합을 마친 뒤 Enter 는 한 번만, 글자 그대로 저장된다', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP 로 IME 를 흉내 낸다');
  await devLogin(page, unique('한글'));
  await apiPost(page, '/categories', { name: '한글', visibility: 'private' });
  await page.reload();
  await page.getByRole('button', { name: '한글에 할 일 추가' }).click();
  const input = page.getByRole('textbox', { name: '새 할 일' });
  await expect(input).toBeFocused();

  const cdp = await page.context().newCDPSession(page);
  // ㅎ → 하 → 할 을 조합하고 확정, 이어서 ' 일' 을 조합·확정한다.
  for (const text of ['ㅎ', '하', '할']) await cdp.send('Input.imeSetComposition', { text, selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '할' });
  await cdp.send('Input.insertText', { text: ' ' });
  for (const text of ['ㅇ', '이', '일']) await cdp.send('Input.imeSetComposition', { text, selectionStart: 1, selectionEnd: 1 });
  // 조합 중의 Enter 는 확정일 뿐 저장이 아니다.
  await page.keyboard.press('Enter');
  await cdp.send('Input.insertText', { text: '일' });
  await expect(input).toHaveValue('할 일');
  await input.press('Enter');

  await expect(todoTitle(page, '할 일')).toHaveCount(1);
  await expect(input).toHaveValue('');
  await page.getByRole('region', { name: '프로필' }).click();
  await expect(page.getByTestId('todo-title')).toHaveText(['할 일']);
});

test('기존 할 일을 수정해도 행 높이와 주변 위치가 그대로다', async ({ page }) => {
  await devLogin(page, unique('수정'));
  const category = await apiPost(page, '/categories', { name: '수정', visibility: 'private' });
  const date = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  const long = '회의 자료 정리와 발표 준비 및 다음 주 업무 계획 확인을 모두 마무리하기 그리고 한 줄을 넘기기 위한 조금 더 긴 설명';
  for (const title of ['짧은 할 일', long, '마지막']) await apiPost(page, '/todos', { categoryId: category.id, date, title });
  await page.reload();

  for (const title of ['짧은 할 일', long]) {
    const row = todoTitle(page, title).locator('xpath=..');
    const last = todoTitle(page, '마지막');
    const before = { row: await row.boundingBox(), last: await last.boundingBox() };

    if (!isMobile(page)) {
      await todoTitle(page, title).hover();
      await expect(row.getByRole('button', { name: '이름 바꾸기' })).toBeVisible();
      expect(await row.boundingBox()).toEqual(before.row);
      await todoTitle(page, title).dblclick();
    } else {
      await todoTitle(page, title).tap();
    }

    const input = page.getByRole('textbox', { name: '할 일 이름' });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(title);
    const editingRow = input.locator('xpath=../..');
    expect((await editingRow.boundingBox())?.height).toBeCloseTo(before.row!.height, 0);
    expect(await last.boundingBox()).toEqual(before.last);

    await page.getByRole('button', { name: '수정 취소' }).click();
    await expect(input).toHaveCount(0);
  }

  // 수정은 Enter 로 저장하고 닫는다.
  isMobile(page) ? await todoTitle(page, '짧은 할 일').tap() : await todoTitle(page, '짧은 할 일').dblclick();
  await page.getByRole('textbox', { name: '할 일 이름' }).fill('고친 할 일');
  await page.keyboard.press('Enter');
  await expect(todoTitle(page, '고친 할 일')).toBeVisible();
  await page.reload();
  await expect(todoTitle(page, '고친 할 일')).toBeVisible();
});

test('친구 보드는 읽기 전용이다', async ({ page }) => {
  await devLogin(page);
  await page.getByRole('navigation', { name: '보드 고르기' }).getByRole('button', { name: /민서/ }).click();
  await expect(page.getByText('민서의 하루')).toBeVisible();
  await expect(todoTitle(page, '러닝 5km')).toBeVisible();
  await expect(page.getByRole('button', { name: /할 일 추가/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '프로필 수정' })).toHaveCount(0);
});

test('카테고리를 만들고 키보드로 순서를 바꾸면 메인에도 반영된다', async ({ page }) => {
  await devLogin(page, unique('정렬'));
  for (const name of ['첫째', '둘째']) {
    await page.goto('/categories/new');
    await page.getByRole('textbox', { name: '카테고리 이름' }).fill(name);
    await page.getByRole('button', { name: '완료' }).click();
    await expect(page.getByRole('textbox', { name: '카테고리 이름' })).toHaveCount(0);
  }
  await page.goto('/categories');
  const list = page.getByRole('list', { name: '카테고리 목록' });
  await expect(list.getByRole('listitem')).toHaveText([/첫째/, /둘째/]);

  await page.getByRole('button', { name: '둘째 순서 바꾸기' }).focus();
  // dnd-kit 은 집어 든 뒤 자리를 재고 움직이므로 한 박자씩 쉰다.
  for (const key of ['Space', 'ArrowUp', 'Space']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  await expect(list.getByRole('listitem')).toHaveText([/둘째/, /첫째/]);

  await page.goto('/');
  await expect(page.getByRole('group')).toHaveText([/둘째/, /첫째/]);
});

test('로그아웃하면 새로고침해도 로그인 화면이다', async ({ page }) => {
  await devLogin(page, unique('나감'));
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '이름만으로 시작하기 (개발용)' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '이름만으로 시작하기 (개발용)' })).toBeVisible();
});

test('설치할 수 있는 PWA 이고, 오프라인이면 껍데기와 안내를 보여준다', async ({ page, context }) => {
  await devLogin(page);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json).toMatchObject({ display: 'standalone', start_url: '/', name: 'Todo Buddy' });
  expect(json.icons.map((i: { purpose: string }) => i.purpose)).toContain('maskable');

  // 서비스워커가 자리를 잡고 이 페이지를 맡을 때까지 기다린다.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '오프라인이에요' })).toBeVisible();

  // 다시 연결되면 스스로 다시 불러온다.
  await context.setOffline(false);
  await expect(todoTitle(page, '디자인 리뷰 준비')).toBeVisible();
});

test('@visual 메인 화면', async ({ page }) => {
  await devLogin(page);
  await expect(todoTitle(page, '디자인 리뷰 준비')).toBeVisible();
  // 캘린더는 달마다 줄 수가 달라 날짜를 타지 않는 부분만 비교한다 (골든의 home.png · todo_editing.png 를 대신한다).
  await expect(page.getByRole('region', { name: '프로필' })).toHaveScreenshot('profile.png');
  await expect(page.locator('section[aria-label$=" 할 일"]')).toHaveScreenshot('todos.png');

  // 수정 중인 행
  isMobile(page) ? await todoTitle(page, '디자인 리뷰 준비').tap() : await todoTitle(page, '디자인 리뷰 준비').dblclick();
  await expect(page.locator('section[aria-label$=" 할 일"]')).toHaveScreenshot('todo-editing.png');
});
