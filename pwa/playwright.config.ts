import { defineConfig, devices } from '@playwright/test';

// 실제 서버(개발용 로그인 켬, 시드 데이터) + 빌드한 PWA(vite preview, /api 프록시)로 돈다.
// 웹 앱은 /app/ 아래에 있으므로 테스트의 goto 는 상대 경로('categories')로 쓴다. '/categories' 는 호스트 루트다.
const API_PORT = 4210;
const APP_PORT = 4173;
const APP_URL = `http://127.0.0.1:${APP_PORT}/app/`;

export default defineConfig({
  testDir: 'e2e',
  // 같은 서버·시드 데이터를 공유하므로 순서대로 돈다.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: APP_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node e2e/start-server.mjs',
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${APP_PORT}`,
      url: APP_URL,
      env: { TODOBUDDY_API_PROXY: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
