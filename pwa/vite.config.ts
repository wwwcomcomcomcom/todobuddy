/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// 운영과 같은 모양으로 붙인다: PWA 와 API 가 같은 출처, API 는 /api 아래.
// changeOrigin 을 끄면 Host 가 그대로 넘어가 서버의 같은 출처 검사(CSRF)를 통과한다.
const API = process.env.TODOBUDDY_API_PROXY ?? 'http://127.0.0.1:4000';
const proxy: Record<string, ProxyOptions> = {
  '/api': { target: API, rewrite: (path) => path.replace(/^\/api/, '') },
  '/uploads': { target: API },
};

// 배포 스크립트가 태그(vX.Y.Z)를 넣는다. 없으면 package.json 버전.
const version =
  process.env.TODOBUDDY_APP_VERSION || JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Todo Buddy',
        short_name: 'Todo Buddy',
        description: '친구·크루와 하루치 할 일을 나눠 보는 TODO 앱',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 해시가 붙은 자산과 아이콘만 미리 받아 둔다. index.html 은 아래에서 네트워크 우선으로 다룬다.
        globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // 화면 이동(SPA 경로)은 늘 새 index.html 을 먼저 받고, 오프라인일 때만 마지막으로 받은 것을 쓴다.
            // 경로가 달라도 같은 index.html 이므로 캐시 키를 하나로 모은다. /api·/uploads 는 캐시하지 않는다.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'todobuddy-shell',
              networkTimeoutSeconds: 4,
              plugins: [{ cacheKeyWillBeUsed: async () => '/index.html' }],
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
});
