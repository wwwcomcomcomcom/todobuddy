// e2e 용 TodoBuddy 서버: 임시 DB 에 시드를 깔고 개발용 로그인을 켜서 띄운다.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'todobuddy-e2e-'));
const serverDir = new URL('../../server/', import.meta.url).pathname;
const env = {
  ...process.env,
  PORT: process.env.E2E_API_PORT ?? '4210',
  TODOBUDDY_DB: join(dir, 'e2e.db'),
  TODOBUDDY_UPLOAD_DIR: join(dir, 'uploads'),
  TODOBUDDY_ALLOW_DEV_LOGIN: 'true',
  TODOBUDDY_LOG: 'off',
  // 시드의 '오늘' 과 브라우저(Asia/Seoul)의 '오늘' 을 맞춘다.
  TZ: 'Asia/Seoul',
};

const seed = spawnSync(process.execPath, ['src/seed.js'], { cwd: serverDir, env, stdio: 'inherit' });
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env, stdio: 'inherit' });
const stop = () => {
  server.kill();
  rmSync(dir, { recursive: true, force: true });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
