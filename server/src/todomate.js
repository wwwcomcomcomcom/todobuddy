/**
 * 투두메이트 가져오기에 필요한 Firebase 공개 설정(apiKey·projectId)을 대신 읽어 준다.
 *
 * 투두메이트의 init.json 은 CORS 를 막아 두어 브라우저(PWA)가 직접 읽을 수 없다.
 * 서버는 고정된 주소의 공개 설정값만 중계하고, 비밀번호·토큰·일정은 브라우저 → 구글로 바로 간다.
 * 요청자가 주소를 정할 수 없어야 서버가 임의 URL 을 대신 읽는 통로가 되지 않는다.
 */
export const TODOMATE_INIT_URL = 'https://www.todomate.net/__/firebase/init.json';

const SAFE_VALUE = /^[A-Za-z0-9_-]{1,200}$/;

export class TodomateUnavailable extends Error {}

export function createTodomateConfigSource({
  fetch = globalThis.fetch,
  url = TODOMATE_INIT_URL,
  ttlMs = 6 * 60 * 60 * 1000,
  refreshCooldownMs = 60 * 1000,
  now = Date.now,
} = {}) {
  let cached = null;
  let fetchedAt = -Infinity;
  let inflight = null;

  async function load() {
    let res;
    try {
      res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      throw new TodomateUnavailable(`todomate init.json unreachable: ${err.message ?? err}`);
    }
    if (!res.ok) throw new TodomateUnavailable(`todomate init.json ${res.status}`);
    const body = await res.json().catch(() => null);
    const apiKey = body?.apiKey;
    const projectId = body?.projectId;
    if (!SAFE_VALUE.test(apiKey ?? '') || !SAFE_VALUE.test(projectId ?? '')) {
      throw new TodomateUnavailable('todomate init.json has no apiKey/projectId');
    }
    return { apiKey, projectId };
  }

  return {
    /**
     * 캐시된 값을 돌려준다. refresh 는 클라이언트가 키 오류를 받았을 때 한 번 쓰는 것으로,
     * 마지막으로 읽은 지 refreshCooldownMs 가 지나야 실제로 다시 읽는다.
     */
    async get({ refresh = false } = {}) {
      const age = now() - fetchedAt;
      const stale = !cached || age > ttlMs || (refresh && age > refreshCooldownMs);
      if (!stale) return cached;
      inflight ??= load()
        .then((value) => {
          cached = value;
          fetchedAt = now();
          return value;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
  };
}
