import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { requireAuth } from '../auth.js';

const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export default function uploadsRouter(uploadDir) {
  const router = Router();
  router.use(requireAuth);

  /** 프로필 이미지를 base64 로 받아 저장하고 접근 URL 을 돌려준다. */
  router.post('/', (req, res) => {
    const { filename = 'image.png', dataBase64 } = req.body ?? {};
    const ext = extname(String(filename)).toLowerCase();
    if (!ALLOWED.has(ext)) return res.status(400).json({ error: 'unsupported_image_type' });
    if (!dataBase64) return res.status(400).json({ error: 'dataBase64 required' });

    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.byteLength > MAX_BYTES) return res.status(413).json({ error: 'image_too_large' });

    const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    writeFileSync(join(uploadDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  });

  return router;
}
