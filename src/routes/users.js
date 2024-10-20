import { Router } from 'express';
const router = Router();

import controller from '../controllers/users.js';
import middleware from '../middlewares/middleware.js';

const { find, getActionLogs, add, update, remove } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/action-logs/:month', checkToken, checkUserIsActive, getActionLogs);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);

router.delete(
  '/:userId',
  checkToken,
  checkUserIsActive,
  remove
);

export default router;
