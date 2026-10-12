import type { Profile } from '../lib/models';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { showProfileEditDialog } from './ProfileEditDialog';
import { copyText } from './toast';

/** 왼쪽 열 맨 위의 프로필. 내 프로필이면 눌러서 수정할 수 있다. */
export function ProfileCard({ profile, editable }: { profile: Profile; editable: boolean }) {
  const bio = profile.bio?.trim();
  const isCrew = profile.type === 'crew';
  return (
    <section aria-label="프로필" className="flex items-center gap-3.5">
      <Avatar name={profile.name} url={profile.avatarUrl} size={56} crew={isCrew} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-extrabold">{profile.name}</h2>
        <p className={`mt-1 line-clamp-2 text-xs ${bio ? 'text-ink' : 'text-subtle'}`}>
          {bio || (editable ? '프로필에 자기소개를 입력해보세요' : '소개가 아직 없어요')}
        </p>
        {isCrew && profile.inviteCode && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(profile.inviteCode!, '초대 코드를 복사했어요')}
              className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-xs font-bold hover:bg-blob"
            >
              <Icon name="key" size={15} />
              초대코드 {profile.inviteCode}
            </button>
            {profile.memberCount != null && <span className="text-xs text-subtle">멤버 {profile.memberCount}명</span>}
          </div>
        )}
      </div>
      {editable && (
        <button
          type="button"
          aria-label="프로필 수정"
          title="프로필 수정"
          onClick={() => void showProfileEditDialog()}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-chip"
        >
          <Icon name="smile" size={20} />
        </button>
      )}
    </section>
  );
}
