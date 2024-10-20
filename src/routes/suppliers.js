import { Router } from 'express';
const router = Router();

import controller from '../controllers/suppliers.js';
import middleware from '../middlewares/middleware.js';

const { find, add, update, remove, findPendingPurchases } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/pending-sales/:supplierId', checkToken, checkUserIsActive, findPendingPurchases);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:supplierId', checkToken, checkUserIsActive, remove);

export default router;
