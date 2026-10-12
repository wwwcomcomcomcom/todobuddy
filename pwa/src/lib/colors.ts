/** 앱 전반의 색. app/lib/theme.dart · web/app/globals.css 와 같은 팔레트다. 한쪽을 바꾸면 다른 쪽도 맞출 것. */
export const colors = {
  ink: '#111111',
  subtle: '#9AA0A6',
  chipBg: '#F1F2F4',
  blob: '#DDE0E4',
  divider: '#E6E8EB',
  saturday: '#3B82F6',
  sunday: '#EF4444',
} as const;

/** 카테고리 색상 선택지. */
export const palette = ['#111111', '#EE8B8B', '#F5C543', '#7BC47F', '#5FB7C9', '#7AA2F7', '#B08BEE', '#EE8BC3'];

export const normalizeHex = (hex: string | null | undefined, fallback: string = colors.ink) => {
  const cleaned = String(hex ?? '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) return `#${cleaned.slice(2).toUpperCase()}`;
  return fallback;
};
