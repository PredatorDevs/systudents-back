import { Router } from 'express';
const router = Router();

import controller from '../controllers/customers.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findById,
  findByLocation,
  findTypes,
  findPendingSales,
  findTotalPendingAmountToPay,
  add,
  addPhones,
  addRelatives,
  update,
  remove,
  removePhone,
  removeRelative
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/by-location/:locationId', checkToken, checkUserIsActive, findByLocation);
router.get('/types', checkToken, checkUserIsActive, findTypes);
router.get('/pending-sales/:customerId', checkToken, checkUserIsActive, findPendingSales);
router.get('/pending-amount-to-pay/:customerId', checkToken, checkUserIsActive, findTotalPendingAmountToPay);
router.get('/:customerId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);
router.post('/add-phones', checkToken, checkUserIsActive, addPhones);
router.post('/add-relatives', checkToken, checkUserIsActive, addRelatives);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:customerId', checkToken, checkUserIsActive, remove);
router.delete('/phone/:customerPhoneId', checkToken, checkUserIsActive, removePhone);
router.delete('/relative/:customerRelativeId', checkToken, checkUserIsActive, removeRelative);

export default router;
