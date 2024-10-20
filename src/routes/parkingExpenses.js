import { Router } from 'express';
const router = Router();

import controller from '../controllers/parkingExpenses.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findById,
  findTypes,
  add,
  update,
  remove,
  voidById
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/types', findTypes);
router.get('/:parkingExpenseId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);
router.put('/void', checkToken, checkUserIsActive, voidById);

router.delete('/:parkingExpenseId', checkToken, checkUserIsActive, remove);

export default router;
