import { useRef, useState } from 'react';
import { errorMessage } from '../lib/api';
import { checkImage, IMAGE_EXTENSIONS, readAsBase64 } from '../lib/files';
import { useApp, useStore } from '../state/context';
import { Avatar } from './Avatar';
import { Modal, openDialog } from './dialogs';
import { Icon } from './Icon';
import { Button, ErrorText, inputClass } from './ui';

export const showProfileEditDialog = () => openDialog<void>((close) => <ProfileEditDialog close={close} />);

function ProfileEditDialog({ close }: { close: () => void }) {
  const store = useStore();
  const { me } = useApp();
  const [name, setName] = useState(me?.name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      setAvatarUrl(await store.api.uploadImage(file.name, await readAsBase64(file)));
    } catch (e) {
      setError(errorMessage(e, '사진을 올리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    await store.updateProfile({ name: name.trim(), bio: bio.trim(), avatarUrl: avatarUrl ?? undefined });
    close();
  };

  return (
    <Modal
      title="프로필 수정"
      onDismiss={() => !busy && close()}
      dismissible={!busy}
      actions={
        <>
          <Button variant="text" disabled={busy} onClick={close}>
            취소
          </Button>
          <Button disabled={busy || !name.trim()} onClick={save}>
            완료
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative mx-auto mb-2">
          <Avatar name={name} url={avatarUrl} size={88} />
          <button
            type="button"
            aria-label="사진 바꾸기"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="absolute right-0 bottom-0 inline-flex size-8 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50"
          >
            <Icon name="camera" size={16} />
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            data-testid="avatar-input"
            accept={IMAGE_EXTENSIONS.map((e) => `.${e}`).join(',')}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <label className="text-xs font-bold text-subtle">
          이름
          <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-subtle">
          한 줄 소개
          <textarea rows={3} className={`${inputClass} mt-1 resize-none`} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        {me?.handle && <p className="text-xs text-subtle">친구 추가 아이디: @{me.handle}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}
