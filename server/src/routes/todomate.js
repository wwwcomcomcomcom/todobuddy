import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { TodomateUnavailable } from '../todomate.js';

/** GET /todomate/config → {apiKey, projectId}. 로그인한 사용자만 쓸 수 있다. */
export default function todomateRouter(source) {
  const router = Router();
  router.use(requireAuth);

  router.get('/config', async (req, res, next) => {
    try {
      res.json(await source.get({ refresh: req.query.refresh === '1' }));
    } catch (err) {
      if (!(err instanceof TodomateUnavailable)) return next(err);
      console.error(err.message);
      res.status(502).json({ error: 'todomate_unavailable' });
    }
  });

  return router;
}
