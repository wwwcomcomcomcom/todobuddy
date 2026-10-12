import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TODOMATE_INIT_URL, TodomateUnavailable, createTodomateConfigSource } from '../src/todomate.js';

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  fn.calls = calls;
  return fn;
}

describe('투두메이트 설정 중계', () => {
  it('고정된 init.json 에서 apiKey·projectId 만 뽑아 돌려준다', async () => {
    const fetch = fakeFetch([json({ apiKey: 'AIza-key_1', projectId: 'mate-914f3', authDomain: 'x', messagingSenderId: '1' })]);
    const source = createTodomateConfigSource({ fetch });
    assert.deepEqual(await source.get(), { apiKey: 'AIza-key_1', projectId: 'mate-914f3' });
    assert.deepEqual(fetch.calls, [TODOMATE_INIT_URL]);
  });

  it('캐시 수명 안에서는 다시 읽지 않고, 지나면 다시 읽는다', async () => {
    let now = 0;
    const fetch = fakeFetch([json({ apiKey: 'a', projectId: 'p' }), json({ apiKey: 'b', projectId: 'p' })]);
    const source = createTodomateConfigSource({ fetch, ttlMs: 1000, now: () => now });
    await source.get();
    now = 999;
    assert.equal((await source.get()).apiKey, 'a');
    now = 1001;
    assert.equal((await source.get()).apiKey, 'b');
    assert.equal(fetch.calls.length, 2);
  });

  it('refresh 는 쿨다운이 지났을 때만 실제로 다시 읽는다', async () => {
    let now = 0;
    const fetch = fakeFetch([json({ apiKey: 'a', projectId: 'p' }), json({ apiKey: 'b', projectId: 'p' })]);
    const source = createTodomateConfigSource({ fetch, refreshCooldownMs: 60_000, now: () => now });
    await source.get();
    now = 10_000;
    assert.equal((await source.get({ refresh: true })).apiKey, 'a');
    now = 61_000;
    assert.equal((await source.get({ refresh: true })).apiKey, 'b');
  });

  it('동시에 들어온 요청은 한 번만 읽는다', async () => {
    const fetch = fakeFetch([json({ apiKey: 'a', projectId: 'p' })]);
    const source = createTodomateConfigSource({ fetch });
    const [x, y] = await Promise.all([source.get(), source.get()]);
    assert.deepEqual(x, y);
    assert.equal(fetch.calls.length, 1);
  });

  it('연결 실패·오류 응답·이상한 값은 TodomateUnavailable 로 알린다', async () => {
    for (const response of [new Error('ECONNRESET'), json({}, 500), json({ projectId: 'p' }), json({ apiKey: 'a b', projectId: 'p' })]) {
      const source = createTodomateConfigSource({ fetch: fakeFetch([response]) });
      await assert.rejects(source.get(), TodomateUnavailable);
    }
  });

  it('실패 뒤에는 다음 요청에서 다시 시도한다', async () => {
    const fetch = fakeFetch([json({}, 503), json({ apiKey: 'a', projectId: 'p' })]);
    const source = createTodomateConfigSource({ fetch });
    await assert.rejects(source.get());
    assert.equal((await source.get()).apiKey, 'a');
  });
});
