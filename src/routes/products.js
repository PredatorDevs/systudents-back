import { Router } from 'express';
const router = Router();

import controller from '../controllers/products.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findDeactivated,
  findByLocationStockData,
  findByMultipleParams,
  findTaxesByProductId,
  findLocationStockCheck,
  add,
  update,
  remove,
  reactivate,
  checkAvailability,
  prices,
  stocks,
  packageConfigs
} = controller;

const { checkToken, checkUserIsActive } = middleware;

// http://127.0.0.1:5001/api/products/

router.get('/', checkToken, checkUserIsActive, find);

router.get('/deactivated', checkToken, checkUserIsActive, findDeactivated);
router.get('/taxes-data/:productId', checkToken, checkUserIsActive, findTaxesByProductId);
router.get('/by-location-stock-data/:locationId', checkToken, checkUserIsActive, findByLocationStockData);
router.get('/check-availability/:locationId/:productId/:quantity', checkToken, checkUserIsActive, checkAvailability);
router.get('/location-stock-check/:locationId', checkToken, checkUserIsActive, findLocationStockCheck);
router.get('/by-multiple-params/:locationId/:productFilterParam/:excludeServices/:productDistributionsId', checkToken, checkUserIsActive, findByMultipleParams);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);
router.put('/reactivate/:productId', checkToken, checkUserIsActive, reactivate);

router.delete('/:productId', checkToken, checkUserIsActive, remove);

// PRODUCT STOCKS

router.get('/stocks/adjustments', stocks.adjustments.find)
router.get('/stocks/adjustments/:productStockAdjustmentId', checkToken, checkUserIsActive, stocks.adjustments.findById)
router.get('/stocks/adjustments/details/:productStockAdjustmentId', checkToken, checkUserIsActive, stocks.adjustments.findDetailByAdjustmentId)
router.get('/stocks/:productId', checkToken, checkUserIsActive, stocks.findByProductId);

router.post('/stocks/adjustments', checkToken, checkUserIsActive, stocks.adjustments.add)
router.post('/stocks/adjustments/details', checkToken, checkUserIsActive, stocks.adjustments.addDetails)

router.put('/stocks', checkToken, checkUserIsActive, stocks.updateById);

// PRODUCT PRICES

router.get('/prices/:productId', checkToken, checkUserIsActive, prices.findByProductId);

router.post('/prices', checkToken, checkUserIsActive, prices.add);

router.put('/prices', checkToken, checkUserIsActive, prices.update);

router.delete('/prices/:productPriceId', checkToken, checkUserIsActive, prices.remove);

// PACKAGE CONFIGS

router.get('/package-configs/:productId', checkToken, checkUserIsActive, packageConfigs.findByProductId);

router.post('/package-configs', checkToken, checkUserIsActive, packageConfigs.add);

router.delete('/package-configs/:productPackageConfigId', checkToken, checkUserIsActive, packageConfigs.remove);

export default router;
