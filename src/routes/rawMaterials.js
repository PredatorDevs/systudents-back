import { Router } from 'express';
const router = Router();

import controller from '../controllers/rawMaterials.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findDeactivated,
  findByLocationStockData,
  findByMultipleParams,
  findTaxesByRawMaterialId,
  findLocationStockCheck,
  add,
  update,
  remove,
  reactivate,
  stocks
} = controller;

const { checkToken, checkUserIsActive } = middleware;

// http://127.0.0.1:5001/api/rawmaterials/

router.get('/', checkToken, checkUserIsActive, find);

router.get('/deactivated', checkToken, checkUserIsActive, findDeactivated);
router.get('/taxes-data/:rawMaterialId', checkToken, checkUserIsActive, findTaxesByRawMaterialId);
router.get('/by-location-stock-data/:locationId', checkToken, checkUserIsActive, findByLocationStockData);
router.get('/location-stock-check/:locationId', checkToken, checkUserIsActive, findLocationStockCheck);
router.get('/by-multiple-params/:locationId/:rawMaterialFilterParam/:excludeServices/:rawMaterialDistributionsId', checkToken, checkUserIsActive, findByMultipleParams);

router.post('/', checkToken, checkUserIsActive, add);

router.put('/', checkToken, checkUserIsActive, update);
router.put('/reactivate/:rawMaterialId', checkToken, checkUserIsActive, reactivate);

router.delete('/:rawMaterialId', checkToken, checkUserIsActive, remove);

// RAW MATERIALS STOCKS

router.get('/stocks/adjustments', stocks.adjustments.find)
router.get('/stocks/adjustments/:rawMaterialStockAdjustmentId', checkToken, checkUserIsActive, stocks.adjustments.findById)
router.get('/stocks/adjustments/details/:rawMaterialStockAdjustmentId', checkToken, checkUserIsActive, stocks.adjustments.findDetailByAdjustmentId)
router.get('/stocks/:rawMaterialId', checkToken, checkUserIsActive, stocks.findByRawMaterialId);

router.post('/stocks/adjustments', checkToken, checkUserIsActive, stocks.adjustments.add)
router.post('/stocks/adjustments/details', checkToken, checkUserIsActive, stocks.adjustments.addDetails)

router.put('/stocks', checkToken, checkUserIsActive, stocks.updateById);

export default router;
