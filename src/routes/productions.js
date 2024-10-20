import { Router } from 'express';
const router = Router();

import controller from '../controllers/productions.js';
import middleware from '../middlewares/middleware.js';

const { 
  find, 
  findById, 
  findByLocationCurrentActiveShiftcut, 
  findRecents, 
  findByRangeDate, 
  findByLocationRangeDate, 
  getAttachmentsById,
  summaryByShiftcut, 
  add,
  addv2,
  update, 
  remove, 
  voidProduction, 
  details 
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/recents', checkToken, checkUserIsActive, findRecents);
router.get('/:productionId', checkToken, checkUserIsActive, findById);
router.get('/active-shiftcut/location/:locationId', checkToken, checkUserIsActive, findByLocationCurrentActiveShiftcut);
router.get('/by-range-date/:initialDate/:finalDate', checkToken, checkUserIsActive, findByRangeDate);
router.get('/by-location/:locationId/by-range-date/:initialDate/:finalDate', checkToken, checkUserIsActive, findByLocationRangeDate);
router.get('/summary/:shiftcutId', checkToken, checkUserIsActive, summaryByShiftcut);
router.get('/get-attachments/:productionId', checkToken, checkUserIsActive, getAttachmentsById);

router.post('/', checkToken, checkUserIsActive, addv2);
router.post('/void', checkToken, checkUserIsActive, voidProduction);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:productionId', checkToken, checkUserIsActive, remove);

// PRODUCTION DETAILS

router.get('/details/:productionId', checkToken, checkUserIsActive, details.findByProductionId);

router.post('/details', checkToken, checkUserIsActive, details.add);

router.put('/details', checkToken, checkUserIsActive, details.update);

router.delete('/details/:productionDetailId', checkToken, checkUserIsActive, details.remove);

export default router;
