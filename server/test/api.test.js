import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

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
