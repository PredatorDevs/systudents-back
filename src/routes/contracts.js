import { Router } from 'express';
const router = Router();

import controller from '../controllers/contracts.js';
import middleware from '../middlewares/middleware.js';

const { find, findById, add, changeStatus, details, beneficiaries } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/:contractId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);
router.post('/change-status/:contractId/:newStatus', checkToken, checkUserIsActive, changeStatus);

router.post('/details/add-many', checkToken, checkUserIsActive, details.add);
router.post('/beneficiaries/add-many', checkToken, checkUserIsActive, beneficiaries.add);

export default router;
