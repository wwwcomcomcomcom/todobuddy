import type { ReactNode } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../components/toast';
import { Button, ScreenHeader } from '../components/ui';
import { promptInstall, useInstallState } from '../pwa/install';
import { checkForUpdate } from '../pwa/updates';

/**
 * 앱 설정. 데스크탑 앱의 "컴퓨터 시작 시 자동 실행" 은 웹에서 켤 수 없어 빠졌고,
 * 대신 "앱으로 설치" 안내를 둔다.
 */
export default function SettingsScreen() {
  const install = useInstallState();

  return (
    <>
      <ScreenHeader title="앱 설정" />
      <main className="safe-px safe-pb mx-auto flex max-w-2xl flex-col gap-4 pt-4">
        <Card icon="install" title="앱으로 설치">
          {install.installed ? (
            <p>이미 앱으로 설치해서 쓰고 있어요.</p>
          ) : install.canPrompt ? (
            <>
              <p>홈 화면이나 앱 목록에 Todo Buddy 를 추가하면 주소창 없이 앱처럼 열려요.</p>
              <Button
                icon="download"
                className="mt-3 self-start"
                onClick={async () => {
                  if (await promptInstall()) toast('설치했어요. 이제 앱 목록에서 열 수 있어요.');
                }}
              >
                설치하기
              </Button>
            </>
          ) : install.platform === 'ios' ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Safari 아래쪽(또는 위쪽)의 공유 버튼 <Icon name="share" size={16} className="inline align-text-bottom" /> 을 누르고
              </li>
              <li>
                <b>홈 화면에 추가</b> 를 고른 뒤 <b>추가</b> 를 눌러요.
              </li>
              <li>Safari 가 아닌 브라우저라면 Safari 로 이 주소를 열어 주세요.</li>
            </ol>
          ) : (
            <>
              <p>Chrome·Edge 주소창 오른쪽의 설치 아이콘이나, 브라우저 메뉴의 <b>앱 설치</b>(Android 는 <b>홈 화면에 추가</b>)를 눌러요.</p>
              <p className="mt-1 text-subtle">Firefox·Safari(macOS) 는 설치 지원이 약해요. 북마크해 두고 써도 돼요.</p>
            </>
          )}
        </Card>

        <Card icon="settings" title="컴퓨터 시작 시 자동 실행">
          <p>웹 앱은 스스로 자동 실행을 켤 수 없어요.</p>
          <p className="mt-1 text-subtle">
            Windows·macOS 의 Chrome·Edge 에 설치했다면 <b>chrome://apps</b>(Edge 는 <b>edge://apps</b>) 에서 Todo Buddy 를
            오른쪽 클릭해 로그인할 때 시작하는 옵션을 켜면 돼요. 브라우저에 따라 없을 수도 있어요.
          </p>
        </Card>

        <Card icon="refresh" title="업데이트">
          <p>새 버전이 나오면 화면 아래에 알려 드려요. 지금 확인할 수도 있어요.</p>
          <Button variant="tonal" className="mt-3 self-start" onClick={() => void checkForUpdate({ manual: true })}>
            업데이트 확인
          </Button>
          <p className="mt-3 text-xs text-subtle">버전 {__APP_VERSION__}</p>
        </Card>
      </main>
    </>
  );
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl bg-chip p-5 text-sm leading-relaxed">
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-extrabold">
        <Icon name={icon} size={20} />
        {title}
      </h2>
      {children}
    </section>
  );
}
