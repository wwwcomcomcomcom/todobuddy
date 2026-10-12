export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 서버로 올리기 전에 미리 걸러낸다. 문제없으면 null. 서버도 같은 규칙으로 다시 확인한다. */
export function checkImage(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_EXTENSIONS.includes(ext)) return 'png, jpg, gif, webp 만 올릴 수 있어요.';
  if (file.size > MAX_IMAGE_BYTES) return '이미지가 너무 커요. 5MB 이하로 올려주세요.';
  return null;
}

/** 파일을 data: URL 의 base64 부분만 남겨 읽는다. */
export function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
