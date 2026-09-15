/**
 * 배포 전에 채워야 하는 값들. 환경변수로 덮어쓸 수 있다.
 * GitHub 저장소가 아직 원격에 없어서 슬러그는 추정값이다.
 */
const repo = process.env.NEXT_PUBLIC_GITHUB_REPO ?? 'wwwcomcomcomcom/todobuddy';

export const site = {
  name: 'Todo Buddy',
  description: '친구·크루와 하루치 할 일을 나눠 보는 데스크탑 TODO 앱',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://todobuddy.https.gsmsv.site',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'iieiiergn@gmail.com',
  effectiveDate: '2026년 9월 15일',
  repoUrl: `https://github.com/${repo}`,
  releasesUrl: `https://github.com/${repo}/releases`,
  latestReleaseUrl: `https://github.com/${repo}/releases/latest`,
} as const;

export const platforms = [
  {
    name: 'macOS',
    status: '내려받아 바로 실행',
    detail: 'Apple Silicon · Intel. DMG 를 열어 응용 프로그램으로 옮기면 됩니다.',
    href: site.latestReleaseUrl,
    cta: 'DMG 내려받기',
    tone: 'primary',
  },
  {
    name: 'Windows',
    status: '직접 빌드',
    detail: '러너와 플러그인 배선은 끝났지만 빌드가 Windows 호스트에서만 돌아 아직 배포본이 없습니다.',
    href: `${site.repoUrl}#빠르게-실행하기`,
    cta: '빌드 방법 보기',
    tone: 'quiet',
  },
  {
    name: 'Linux',
    status: '직접 빌드',
    detail: '스캐폴드는 들어 있고 코드도 같지만 아직 검증하지 못했습니다.',
    href: `${site.repoUrl}#빠르게-실행하기`,
    cta: '빌드 방법 보기',
    tone: 'quiet',
  },
] as const;
