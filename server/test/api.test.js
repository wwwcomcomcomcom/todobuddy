import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { shiftDate, todayInZone } from '../src/recurrence.js';

const workDir = mkdtempSync(join(tmpdir(), 'todobuddy-test-'));
const PORT = 4111;
const base = `http://127.0.0.1:${PORT}`;
let server;

/** 서버가 응답할 때까지 기다린다. */
async function waitForReady(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // 아직 뜨는 중
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const login = async (name) => (await api('/auth/dev', { method: 'POST', body: { name } })).body;

before(async () => {
  server = spawn(process.execPath, [new URL('../src/index.js', import.meta.url).pathname], {
    env: {
      ...process.env,
      PORT: String(PORT),
      TODOBUDDY_DB: join(workDir, 'test.db'),
      TODOBUDDY_UPLOAD_DIR: join(workDir, 'uploads'),
      TODOBUDDY_LOG: 'off',
      TODOBUDDY_ALLOW_DEV_LOGIN: 'true',
    },
    stdio: 'ignore',
  });
  await waitForReady();
});

after(() => {
  server?.kill();
  rmSync(workDir, { recursive: true, force: true });
});

describe('카테고리 공개 범위', () => {
  it('친구에게는 public 카테고리만 자동으로 보이고 private 은 숨는다', async () => {
    const me = await login('가람');
    const friend = await login('나래');

    // 서로 친구가 된다.
    await api('/friends/request', { token: me.token, method: 'POST', body: { userId: friend.user.id } });
    const book = (await api('/friends', { token: friend.token })).body;
    await api(`/friends/${book.incoming[0].friendshipId}/accept`, { token: friend.token, method: 'POST' });

    await api('/categories', { token: me.token, method: 'POST', body: { name: '비밀일기', visibility: 'private' } });
    await api('/categories', { token: me.token, method: 'POST', body: { name: '운동기록', visibility: 'public' } });

    const seen = (await api(`/board?scope=user:${me.user.id}`, { token: friend.token })).body;
    assert.deepEqual(seen.categories.map((c) => c.name), ['운동기록']);
  });

  it("'shared' 카테고리는 지정한 친구에게만 보인다", async () => {
    const owner = await login('다올');
    const chosen = await login('라온');
    const other = await login('마루');

    for (const friend of [chosen, other]) {
      await api('/friends/request', { token: owner.token, method: 'POST', body: { userId: friend.user.id } });
      const book = (await api('/friends', { token: friend.token })).body;
      await api(`/friends/${book.incoming[0].friendshipId}/accept`, { token: friend.token, method: 'POST' });
    }

    await api('/categories', {
      token: owner.token,
      method: 'POST',
      body: {
        name: '둘만의 목표',
        visibility: 'shared',
        shares: [{ targetType: 'friend', targetId: chosen.user.id }],
      },
    });

    const chosenSees = (await api(`/board?scope=user:${owner.user.id}`, { token: chosen.token })).body;
    const otherSees = (await api(`/board?scope=user:${owner.user.id}`, { token: other.token })).body;
    assert.deepEqual(chosenSees.categories.map((c) => c.name), ['둘만의 목표']);
    assert.deepEqual(otherSees.categories, []);
  });

  it('친구가 아니면 남의 보드를 아예 볼 수 없다', async () => {
    const me = await login('바다');
    const stranger = await login('사랑');
    const res = await api(`/board?scope=user:${me.user.id}`, { token: stranger.token });
    assert.equal(res.status, 403);
  });

  it('크루에는 그 크루에 공유한 카테고리와 public 카테고리가 모인다', async () => {
    const owner = await login('아름');
    const member = await login('자유');

    const crew = (await api('/crews', { token: owner.token, method: 'POST', body: { name: '새벽조' } })).body;
    await api('/crews/join', { token: member.token, method: 'POST', body: { inviteCode: crew.inviteCode } });

    await api('/categories', {
      token: member.token,
      method: 'POST',
      body: { name: '크루에 공유', visibility: 'shared', shares: [{ targetType: 'crew', targetId: crew.id }] },
    });
    await api('/categories', { token: member.token, method: 'POST', body: { name: '혼자만', visibility: 'private' } });

    const seen = (await api(`/board?scope=crew:${crew.id}`, { token: owner.token })).body;
    assert.deepEqual(seen.categories.map((c) => c.name), ['크루에 공유']);
  });
});

describe('친구 관계', () => {
  it('양쪽이 동시에 요청하면 바로 친구가 된다', async () => {
    const a = await login('차랑');
    const b = await login('카람');

    const first = await api('/friends/request', { token: a.token, method: 'POST', body: { userId: b.user.id } });
    assert.equal(first.body.status, 'pending');

    const second = await api('/friends/request', { token: b.token, method: 'POST', body: { userId: a.user.id } });
    assert.equal(second.body.status, 'accepted');

    const book = (await api('/friends', { token: a.token })).body;
    assert.deepEqual(book.friends.map((f) => f.name), ['카람']);
  });

  it('친구를 삭제하면 그 친구 대상 공유도 정리된다', async () => {
    const a = await login('타온');
    const b = await login('파랑');

    await api('/friends/request', { token: a.token, method: 'POST', body: { userId: b.user.id } });
    let book = (await api('/friends', { token: b.token })).body;
    await api(`/friends/${book.incoming[0].friendshipId}/accept`, { token: b.token, method: 'POST' });

    const category = (await api('/categories', {
      token: a.token,
      method: 'POST',
      body: { name: '공유중', visibility: 'shared', shares: [{ targetType: 'friend', targetId: b.user.id }] },
    })).body;
    assert.equal(category.shares.length, 1);

    book = (await api('/friends', { token: a.token })).body;
    await api(`/friends/${book.friends[0].friendshipId}`, { token: a.token, method: 'DELETE' });

    const after = (await api('/categories', { token: a.token })).body;
    assert.equal(after.find((c) => c.name === '공유중').shares.length, 0);
  });
});

describe('TODO 와 캘린더', () => {
  it('TODO 는 날짜에 귀속되고, 다른 날짜에는 나타나지 않는다', async () => {
    const me = await login('하늘');
    const category = (await api('/categories', { token: me.token, method: 'POST', body: { name: '오늘할일' } })).body;

    await api('/todos', {
      token: me.token, method: 'POST',
      body: { categoryId: category.id, date: '2026-09-15', title: '첫번째' },
    });

    const onDay = (await api('/board?scope=me&date=2026-09-15', { token: me.token })).body;
    const nextDay = (await api('/board?scope=me&date=2026-09-16', { token: me.token })).body;
    assert.deepEqual(onDay.categories[0].todos.map((t) => t.title), ['첫번째']);
    assert.deepEqual(nextDay.categories[0].todos, []);
  });

  it('캘린더는 날짜별로 카테고리 색과 진행도를 돌려준다', async () => {
    const me = await login('가온');
    const category = (await api('/categories', {
      token: me.token, method: 'POST', body: { name: '색칠', color: '#EE8B8B' },
    })).body;

    const todo = (await api('/todos', {
      token: me.token, method: 'POST',
      body: { categoryId: category.id, date: '2026-09-20', title: 'a' },
    })).body;
    await api('/todos', {
      token: me.token, method: 'POST',
      body: { categoryId: category.id, date: '2026-09-20', title: 'b' },
    });
    await api(`/todos/${todo.id}`, { token: me.token, method: 'PATCH', body: { done: true } });

    const calendar = (await api('/board/calendar?scope=me&year=2026&month=9', { token: me.token })).body;
    const day = calendar.days.find((d) => d.date === '2026-09-20');
    assert.deepEqual(day.segments, [{ categoryId: category.id, color: '#EE8B8B', total: 2, done: 1 }]);
  });

  it('남의 카테고리에는 TODO 를 쓸 수 없다', async () => {
    const owner = await login('나온');
    const stranger = await login('다온');
    const category = (await api('/categories', { token: owner.token, method: 'POST', body: { name: '내꺼' } })).body;

    const res = await api('/todos', {
      token: stranger.token, method: 'POST',
      body: { categoryId: category.id, date: '2026-09-15', title: '침입' },
    });
    assert.equal(res.status, 403);
  });
});

const routineToday = () => todayInZone('Asia/Seoul');
let routineAccount = 0;
async function routineFixture(overrides = {}) {
  const me = await login(`루틴테스트${++routineAccount}`);
  const category = (await api('/categories', { token: me.token, method: 'POST', body: { name: '루틴', visibility: 'public' } })).body;
  const body = { categoryId: category.id, title: '매일 읽기', startDate: shiftDate(routineToday(), -4), endDate: null, timeZone: 'Asia/Seoul', rule: { frequency: 'daily', interval: 1 }, ...overrides };
  const created = await api('/routines', { token: me.token, method: 'POST', body });
  assert.equal(created.status, 201);
  return { me, category, routine: created.body };
}
async function routineTodos(token, date, scope = 'me') {
  const result = await api(`/board?scope=${scope}&date=${date}`, { token });
  assert.equal(result.status, 200);
  return result.body.categories.flatMap((c) => c.todos);
}

describe('반복 일정', () => {
  it('동시 조회에도 중복 없이 생성되고 완료와 캘린더 집계가 일치한다', async () => {
    const { me, category, routine } = await routineFixture();
    const today = routineToday();
    const boards = await Promise.all(Array.from({ length: 5 }, () => routineTodos(me.token, today)));
    for (const todos of boards) {
      assert.equal(todos.length, 1);
      assert.equal(todos[0].id, boards[0][0].id);
      assert.equal(todos[0].routineId, routine.id);
    }
    await api(`/todos/${boards[0][0].id}`, { token: me.token, method: 'PATCH', body: { done: true } });
    const [year, month] = today.split('-');
    const calendar = (await api(`/board/calendar?year=${year}&month=${month}`, { token: me.token })).body;
    assert.deepEqual(calendar.days.find((d) => d.date === today).segments, [{ categoryId: category.id, color: '#111111', total: 1, done: 1 }]);
    assert.equal((await routineTodos(me.token, shiftDate(today, 1)))[0].done, false);
    assert.equal((await routineTodos(me.token, '2099-12-31')).length, 1);
  });

  it('한 날짜 삭제는 재조회·달력 조회·루틴 수정 후에도 다시 생기지 않는다', async () => {
    const { me, routine } = await routineFixture();
    const today = routineToday();
    const todo = (await routineTodos(me.token, today))[0];
    assert.equal((await api(`/todos/${todo.id}`, { token: me.token, method: 'DELETE' })).status, 204);
    assert.deepEqual(await routineTodos(me.token, today), []);
    assert.equal((await api(`/routines/${routine.id}`, { token: me.token, method: 'PATCH', body: { ...routine, title: '새 이름' } })).status, 200);
    const [year, month] = today.split('-');
    await api(`/board/calendar?year=${year}&month=${month}`, { token: me.token });
    assert.deepEqual(await routineTodos(me.token, today), []);
    assert.equal((await routineTodos(me.token, shiftDate(today, 1)))[0].title, '새 이름');
  });

  for (const keepPastDone of [true, false]) for (const keepPastUndone of [true, false]) for (const removeToday of [true, false]) {
    it(`삭제: 완료 유지=${keepPastDone}, 미완료 유지=${keepPastUndone}, 오늘 삭제=${removeToday}`, async () => {
      const { me, routine } = await routineFixture();
      const today = routineToday();
      const completedDate = shiftDate(today, -4), cachedDate = shiftDate(today, -3), unseenDate = shiftDate(today, -2);
      const done = (await routineTodos(me.token, completedDate))[0];
      await api(`/todos/${done.id}`, { token: me.token, method: 'PATCH', body: { done: true } });
      await routineTodos(me.token, cachedDate);
      await routineTodos(me.token, shiftDate(today, 5));
      const preview = (await api(`/routines/${routine.id}/deletion-preview`, { token: me.token })).body;
      assert.deepEqual(preview, { today, timeZone: 'Asia/Seoul', pastDone: 1, pastUndone: 3, todayCount: 1, futureCount: 1 });
      const deleted = await api(`/routines/${routine.id}`, { token: me.token, method: 'DELETE', body: { keepPastDone, keepPastUndone, removeToday, asOfDate: preview.today } });
      assert.equal(deleted.status, 204);
      assert.equal((await routineTodos(me.token, completedDate)).length, Number(keepPastDone));
      for (const date of [cachedDate, unseenDate, shiftDate(today, -1)]) {
        assert.equal((await routineTodos(me.token, date)).length, Number(keepPastUndone));
      }
      assert.equal((await routineTodos(me.token, today)).length, Number(!removeToday));
      for (const date of [shiftDate(today, 1), shiftDate(today, 5), '2099-12-31']) assert.deepEqual(await routineTodos(me.token, date), []);
      assert.deepEqual((await api('/routines', { token: me.token })).body, []);
      // Retained rows stay editable even after the routine leaves management.
      if (keepPastDone) assert.equal((await api(`/todos/${done.id}`, { token: me.token, method: 'PATCH', body: { done: false } })).status, 200);
    });
  }

  it('수정은 과거의 미조회 기록, 완료 및 개별 수정 기록을 보존한다', async () => {
    const { me, routine } = await routineFixture();
    const today = routineToday();
    const done = (await routineTodos(me.token, today))[0];
    const edited = (await routineTodos(me.token, shiftDate(today, 1)))[0];
    await api(`/todos/${done.id}`, { token: me.token, method: 'PATCH', body: { done: true } });
    await api(`/todos/${edited.id}`, { token: me.token, method: 'PATCH', body: { title: '이날만 다른 이름' } });
    await routineTodos(me.token, shiftDate(today, 2));
    const updated = await api(`/routines/${routine.id}`, { token: me.token, method: 'PATCH', body: { ...routine, title: '새 루틴 이름', startDate: today } });
    assert.equal(updated.status, 200);
    assert.equal((await routineTodos(me.token, shiftDate(today, -2)))[0].title, '매일 읽기');
    assert.equal((await routineTodos(me.token, today))[0].done, true);
    assert.equal((await routineTodos(me.token, shiftDate(today, 1)))[0].title, '이날만 다른 이름');
    assert.equal((await routineTodos(me.token, shiftDate(today, 2)))[0].title, '새 루틴 이름');
    assert.equal((await api(`/routines/${routine.id}`, { token: me.token, method: 'PATCH', body: routine })).status, 409);
    const again = await api(`/routines/${routine.id}`, { token: me.token, method: 'PATCH', body: { ...updated.body, title: '다시 수정' } });
    assert.equal(again.status, 200);
    assert.equal((await routineTodos(me.token, shiftDate(today, -1)))[0].title, '매일 읽기');
    assert.equal((await routineTodos(me.token, shiftDate(today, 2)))[0].title, '다시 수정');
  });

  it('시작일과 종료일을 포함하고 범위 밖에는 생성하지 않는다', async () => {
    const today = routineToday();
    const { me } = await routineFixture({ startDate: today, endDate: shiftDate(today, 1) });
    assert.deepEqual(await routineTodos(me.token, shiftDate(today, -1)), []);
    assert.equal((await routineTodos(me.token, today)).length, 1);
    assert.equal((await routineTodos(me.token, shiftDate(today, 1))).length, 1);
    assert.deepEqual(await routineTodos(me.token, shiftDate(today, 2)), []);
  });

  it('공유 친구가 먼저 읽어도 생성되며 친구는 루틴을 수정하거나 삭제할 수 없다', async () => {
    const { me, category, routine } = await routineFixture();
    const friend = await login('루틴공유친구');
    await api('/friends/request', { token: me.token, method: 'POST', body: { userId: friend.user.id } });
    const book = (await api('/friends', { token: friend.token })).body;
    await api(`/friends/${book.incoming[0].friendshipId}/accept`, { token: friend.token, method: 'POST' });
    const todos = await routineTodos(friend.token, routineToday(), `user:${me.user.id}`);
    assert.equal(todos[0].routineId, routine.id);
    for (const method of ['PATCH', 'DELETE']) assert.equal((await api(`/routines/${routine.id}`, { token: friend.token, method, body: routine })).status, 404);
    assert.equal((await api(`/routines/${routine.id}/deletion-preview`, { token: friend.token })).status, 404);
    assert.equal((await api('/routines', { token: friend.token, method: 'POST', body: routine })).status, 403);
    assert.equal((await api(`/todos/${todos[0].id}`, { token: friend.token, method: 'DELETE' })).status, 404);
    await api(`/categories/${category.id}`, { token: me.token, method: 'DELETE' });
    assert.deepEqual((await api('/routines', { token: me.token })).body, []);
  });

  it('미리보기는 저장 없이 계산하며 잘못된 규칙과 삭제 기준일을 거부한다', async () => {
    const { me, routine } = await routineFixture();
    const preview = await api('/routines/preview', { token: me.token, method: 'POST', body: routine });
    assert.equal(preview.body.dates.length, 5);
    assert.equal(preview.body.dates[0], routineToday());
    const invalid = await api('/routines', { token: me.token, method: 'POST', body: { ...routine, rule: { frequency: 'weekly', interval: 1, weekdays: [] } } });
    assert.equal(invalid.status, 400);
    assert.equal((await api('/routines', { token: me.token })).body.length, 1);
    const options = { keepPastDone: true, keepPastUndone: true, removeToday: false, asOfDate: shiftDate(routineToday(), -1) };
    assert.equal((await api(`/routines/${routine.id}`, { token: me.token, method: 'DELETE', body: options })).status, 409);
    assert.equal((await api(`/routines/${routine.id}`, { token: me.token, method: 'DELETE', body: {} })).status, 400);
    assert.equal((await api('/routines')).status, 401);
  });
});
