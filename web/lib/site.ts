/**
 * 배포 전에 채워야 하는 값들. 환경변수로 덮어쓸 수 있다.
 */
const repo = process.env.NEXT_PUBLIC_GITHUB_REPO ?? 'wwwcomcomcomcom/todobuddy';

export const site = {
  name: 'Todo Buddy',
  description: '친구·크루와 하루치 할 일을 나눠 보는 TODO 앱',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://todobuddy.https.gsmsv.site',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'iieiiergn@gmail.com',
  effectiveDate: '2026년 9월 15일',
  repoUrl: `https://github.com/${repo}`,
  // 웹 앱(PWA)은 같은 호스트의 /app/ 에서 nginx 가 서빙한다. Next 의 라우트가 아니므로 <Link> 대신 <a> 로 건다.
  appPath: '/app/',
} as const;

// 웹 앱을 홈 화면·앱 목록에 추가하는 방법. 앱 안의 설정 > 앱으로 설치 안내와 같은 말을 쓴다.
export const installGuides = [
  {
    name: '컴퓨터',
    browser: 'Chrome · Edge (Windows · macOS)',
    steps: '주소창 오른쪽의 설치 아이콘을 누르거나, 브라우저 메뉴에서 앱 설치를 고릅니다.',
  },
  {
    name: 'Android',
    browser: 'Chrome',
    steps: '오른쪽 위 메뉴(⋮)에서 홈 화면에 추가 또는 앱 설치를 고릅니다.',
  },
  {
    name: 'iPhone · iPad',
    browser: 'Safari',
    steps: '공유 버튼을 누르고 홈 화면에 추가를 고른 뒤 추가를 누릅니다.',
  },
  {
    name: 'Mac',
    browser: 'Safari',
    steps: '메뉴 막대의 파일 → Dock에 추가를 고릅니다 (macOS Sonoma 이상).',
  },
] as const;
