import { Router } from 'express';
const router = Router();

import controller from '../controllers/expenses.js';
import middleware from '../middlewares/middleware.js';

const { find, findById, findTypes, getAttachmentsById, add, addv2, update, remove, voidById } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/types', findTypes);
router.get('/get-attachments/:expenseId', checkToken, checkUserIsActive, getAttachmentsById);
router.get('/:expenseId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, addv2);

router.put('/', checkToken, checkUserIsActive, update);
router.put('/void', checkToken, checkUserIsActive, voidById);

router.delete('/:expenseId', checkToken, checkUserIsActive, remove);


export default router;
