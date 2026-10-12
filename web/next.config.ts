import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 운영 배포는 돌고 있는 .next 를 건드리지 않게 다른 디렉터리에 빌드한 뒤 바꿔 끼운다 (server/deploy/todobuddy-deploy.sh).
  distDir: process.env.TODOBUDDY_NEXT_DIST_DIR || '.next',
};

export default nextConfig;
