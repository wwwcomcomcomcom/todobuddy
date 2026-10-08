import { useEffect, useState } from 'react';

/** CSS 미디어 쿼리 결과를 따라간다. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** 캘린더 + 할 일 2단으로 펼칠 수 있는 너비 (Flutter 앱과 같은 720px). */
export const WIDE_QUERY = '(min-width: 720px)';

/** 브라우저에만 남기는 사소한 설정 (접힘 상태 등). 저장소를 못 쓰는 환경에서도 동작한다. */
export function usePersistentFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });
  const update = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // 사생활 보호 모드 등에서는 저장하지 않는다.
    }
  };
  return [value, update];
}
