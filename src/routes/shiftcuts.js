import { Router } from 'express';
const router = Router();

import controller from '../controllers/shiftcuts.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findById,
  settlements,
  settlementsById,
  settlementsByLocation,
  settlementsByLocationCashierDate,
  settlementsByLocationCashierMonthDate,
  settlementsOrderSaleById
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);

router.get('/settlements', checkToken, checkUserIsActive, settlements);
router.get('/settlements/:shiftcutId', checkToken, checkUserIsActive, settlementsById);
router.get('/settlements/by-location/:locationId', checkToken, checkUserIsActive, settlementsByLocation);
router.get('/settlements/by-location-cashier-date/:locationId/:cashierId/:dateFilter', checkToken, checkUserIsActive, settlementsByLocationCashierDate);
router.get('/settlements/by-location-cashier-monthdate/:locationId/:cashierId/:monthDateFilter', checkToken, checkUserIsActive, settlementsByLocationCashierMonthDate);
router.get('/settlements/order-sales/:shiftcutId', checkToken, checkUserIsActive, settlementsOrderSaleById);

router.get('/:shiftcutId', checkToken, checkUserIsActive, findById);

export default router;
