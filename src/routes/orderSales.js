import { Router } from 'express';
const router = Router();

import controller from '../controllers/orderSales.js';
import middleware from '../middlewares/middleware.js';

const { 
  find,
  findById,
  add, 
  update, 
  changeStatus, 
  consolidate,
  remove,
  details
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/byId/:orderSaleId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);
router.put('/change-status', checkToken, checkUserIsActive, changeStatus);
router.put('/consolidate', checkToken, checkUserIsActive, consolidate);

router.delete('/:orderSaleId', checkToken, checkUserIsActive, remove);

// PRODUCTION DETAILS

router.get('/details/:orderSaleId', checkToken, checkUserIsActive, details.findByOrderSaleId);

router.post('/details', checkToken, checkUserIsActive, details.add);

router.put('/details', checkToken, checkUserIsActive, details.update);

router.delete('/details/:orderSaleDetailId', checkToken, checkUserIsActive, details.remove);

export default router;
