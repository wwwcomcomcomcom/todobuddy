import type { KeyboardEvent } from 'react';

/**
 * 한글 IME 조합 중의 Enter 는 글자를 확정하는 키다. 이걸 제출로 받으면 마지막 글자가 다음 입력에 남거나 사라진다.
 * Chrome·Firefox 는 isComposing 을, Safari 는 compositionend 를 먼저 보내고 keyCode 229 를 남긴다. 둘 다 거른다.
 */
export function isComposing(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** 제출로 받아도 되는 Enter 인지. */
export const isSubmitEnter = (e: KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && !isComposing(e);
