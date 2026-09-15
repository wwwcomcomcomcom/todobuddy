import { BoardPreview } from '@/components/BoardPreview';
import { platforms, site } from '@/lib/site';

const features = [
  {
    color: '#f5c543',
    title: '하루 단위로 쌓이는 할 일',
    body: '할 일은 카테고리와 날짜에 함께 묶입니다. 캘린더로 지난 날과 다가올 날을 오가며 그 날의 목록만 펼쳐 읽고 씁니다.',
  },
  {
    color: '#ee8bc3',
    title: '한 달이 색으로 보입니다',
    body: '할 일이 있는 날에는 그 카테고리 색이 가로 띠로 쌓입니다. 다 끝낸 날은 체크가, 남은 날은 남은 개수가 적힙니다.',
  },
  {
    color: '#7aa2f7',
    title: '친구와 크루',
    body: '친구는 요청하고 수락해 맺습니다. 크루는 한 사람이 만들고 초대 코드로 모입니다. 각자가 공유하기로 한 카테고리만 그 자리에 올라옵니다.',
  },
];

const visibilities = [
  {
    key: 'private',
    label: '나만 보기',
    color: '#9aa0a6',
    body: '카테고리를 만들면 처음에는 여기입니다. 친구 화면에도, 크루 화면에도 올라가지 않습니다.',
  },
  {
    key: 'shared',
    label: '고른 상대에게만',
    color: '#5fb7c9',
    body: '크루와 친구를 하나씩 골라 그 카테고리만 엽니다. 고르지 않은 쪽에는 그대로 보이지 않습니다.',
  },
  {
    key: 'public',
    label: '모든 친구와 크루',
    color: '#7bc47f',
    body: '지금 맺은 친구와 속한 크루 전부에게 열립니다. 나중에 새로 맺은 친구에게도 자동으로 따라갑니다.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* 히어로 */}
      <section className="mx-auto max-w-[1120px] px-5 pt-14 pb-20 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14">
          <div className="rise">
            <h1 className="text-[40px] leading-[1.15] font-extrabold tracking-[-0.03em] sm:text-[52px]">
              할 일은 각자,
              <br />
              하루는 같이.
            </h1>
            <p className="mt-6 max-w-[34ch] text-[16.5px] leading-[1.75] text-subtle">
              할 일을 카테고리로 묶어 날짜에 붙여 둡니다. 친구와 크루에게는 내가 열어 둔 만큼만
              보입니다.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={site.latestReleaseUrl}
                className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-85"
                target="_blank"
                rel="noreferrer"
              >
                내려받기
              </a>
              <a
                href={site.repoUrl}
                className="rounded-full px-6 py-3.5 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors ring-inset hover:bg-chip"
                target="_blank"
                rel="noreferrer"
              >
                GitHub에서 보기
              </a>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-subtle">
              무료 · 오픈소스 · 서버는 직접 띄워 씁니다
            </p>
          </div>

          <div className="rise" style={{ animationDelay: '90ms' }}>
            <BoardPreview />
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-[20ch] text-[28px] leading-snug font-extrabold tracking-[-0.02em] sm:text-[32px]">
            하루치만 다룹니다
          </h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={index > 0 ? 'md:border-l md:border-line md:pl-8' : 'md:pr-8'}
              >
                <span
                  className="squircle block h-6 w-6"
                  style={{ background: feature.color }}
                  aria-hidden
                />
                <h3 className="mt-5 text-[17px] font-bold">{feature.title}</h3>
                <p className="mt-2.5 max-w-[38ch] text-[14.5px] leading-[1.8] text-subtle">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 공개 범위 */}
      <section id="sharing" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            <div>
              <h2 className="max-w-[18ch] text-[28px] leading-snug font-extrabold tracking-[-0.02em] sm:text-[32px]">
                어디까지 보여 줄지는 카테고리마다 정합니다
              </h2>
              <p className="mt-5 max-w-[34ch] text-[14.5px] leading-[1.8] text-subtle">
                친구·크루 화면은 읽기 전용입니다. 쓰기는 언제나 내 카테고리에서만 일어납니다.
              </p>
            </div>

            <dl className="divide-y divide-line border-y border-line">
              {visibilities.map((visibility) => (
                <div key={visibility.key} className="flex flex-col gap-2 py-5 sm:flex-row sm:gap-6">
                  <dt className="sm:w-[136px] sm:shrink-0">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                      style={{
                        background: `${visibility.color}1f`,
                        color: visibility.color,
                      }}
                    >
                      {visibility.label}
                    </span>
                  </dt>
                  <dd className="max-w-[46ch] text-[14.5px] leading-[1.8] text-subtle">
                    {visibility.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 다운로드 */}
      <section id="download" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-[28px] leading-snug font-extrabold tracking-[-0.02em] sm:text-[32px]">
            내려받기
          </h2>
          <p className="mt-5 max-w-[42ch] text-[14.5px] leading-[1.8] text-subtle">
            macOS 와 Windows 가 같은 코드로 돕니다. 두 쪽 모두 배포본이 있습니다.
          </p>

          <ul className="mt-10 divide-y divide-line border-y border-line">
            {platforms.map((platform) => (
              <li
                key={platform.name}
                className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-8"
              >
                <div className="sm:w-[120px] sm:shrink-0">
                  <div className="text-[17px] font-bold">{platform.name}</div>
                  <div className="mt-1 text-[12.5px] text-subtle">{platform.status}</div>
                </div>

                <p className="max-w-[52ch] flex-1 text-[14px] leading-[1.75] text-subtle">
                  {platform.detail}
                </p>

                <a
                  href={platform.href}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-ink px-5 py-3 text-center text-[14px] font-semibold text-white transition-opacity hover:opacity-85"
                >
                  {platform.cta}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="text-[15px] font-bold">macOS에서 처음 열 때</h3>
              <p className="mt-2.5 max-w-[42ch] text-[14px] leading-[1.8] text-subtle">
                아직 Apple Developer 인증서로 서명하지 않아, 처음 한 번은 macOS 가 실행을 막습니다.
                경고를 닫고 <span className="text-ink">시스템 설정 → 개인정보 보호 및 보안</span> 으로
                가면 아래쪽 보안 항목에 <span className="text-ink">그래도 열기</span> 가 생깁니다. 그
                다음부터는 더블클릭으로 열립니다.
              </p>
              <p className="mt-3 max-w-[42ch] text-[14px] leading-[1.8] text-subtle">
                터미널이 편하면 아래 한 줄로도 됩니다. 받은 파일에 붙는 격리 표시를 지웁니다.
              </p>
              <code className="mt-2.5 block overflow-x-auto rounded-xl bg-chip px-3.5 py-3 font-mono text-[12.5px] whitespace-pre text-ink">
                xattr -dr com.apple.quarantine &quot;/Applications/Todo Buddy.app&quot;
              </code>
            </div>

            <div>
              <h3 className="text-[15px] font-bold">서버가 함께 있어야 합니다</h3>
              <p className="mt-2.5 max-w-[42ch] text-[14px] leading-[1.8] text-subtle">
                할 일과 친구 관계는 직접 띄운 서버에 저장됩니다. 저장소의 안내를 따라 서버를 먼저
                실행한 뒤 앱을 열어 주세요.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
