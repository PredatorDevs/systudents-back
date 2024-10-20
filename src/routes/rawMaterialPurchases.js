import { Router } from 'express';
const router = Router();

import controller from '../controllers/rawMaterialPurchases.js';
import middleware from '../middlewares/middleware.js';

const { 
  find,
  findById,
  findPendings,
  findPendingsByLocation,
  findPendingAmountToPay,
  add,
  voidRawMaterialPurchase,
  findByLocationMonth,
  details,
  payments    
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/byId/:rawMaterialPurchaseId', checkToken, checkUserIsActive, findById);

router.get('/pendings', checkToken, checkUserIsActive, findPendings);
router.get('/pendings/by-location/:locationId', checkToken, checkUserIsActive, findPendingsByLocation);
router.get('/pending-amount-to-pay/:rawMaterialPurchaseId', checkToken, checkUserIsActive, findPendingAmountToPay);
router.get('/by-month/:locationId/:dateToSearch', checkToken, checkUserIsActive, findByLocationMonth);

router.post('/', checkToken, checkUserIsActive, add);

router.post('/void', checkToken, checkUserIsActive, voidRawMaterialPurchase);

// SALES DETAILS

router.get('/details/:rawMaterialPurchaseId', checkToken, checkUserIsActive, details.findByRawMaterialPurchaseId);

router.post('/details', checkToken, checkUserIsActive, details.add);

// SALES PAYMENTS

router.post('/payments/new-single-payment', checkToken, checkUserIsActive, payments.add);

export default router;
