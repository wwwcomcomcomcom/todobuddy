import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetDialogs } from '../components/dialogs';

// jsdom 에 없는 브라우저 API 를 채운다.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  resetDialogs();
  cleanup();
  localStorage.clear();
});
