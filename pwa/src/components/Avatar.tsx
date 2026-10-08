import { useState } from 'react';

/** 프로필 사진. 없거나 못 읽으면 이름 첫 글자를 보여준다. 크루는 둥근 사각형. */
export function Avatar({ name, url, size = 40, crew = false }: { name: string; url?: string | null; size?: number; crew?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = Array.from(name.trim())[0] ?? '?';
  const showImage = url && failed !== url;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden bg-chip font-bold text-subtle"
      style={{ width: size, height: size, borderRadius: crew ? size * 0.3 : '50%', fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(url)} />
      ) : (
        initial
      )}
    </span>
  );
}
