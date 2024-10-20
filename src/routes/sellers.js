import { Router } from 'express';
const router = Router();

import controller from '../controllers/sellers.js';
import middleware from '../middlewares/middleware.js';

const { find, add, update, remove } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:sellerId', checkToken, checkUserIsActive, remove);

export default router;
