import { Router } from 'express';
const router = Router();

import controller from '../controllers/parkingCheckouts.js';
import middleware from '../middlewares/middleware.js';

const {
  find,
  findById,
  add,
  update,
  remove,
  voidById,
  pendingTickets,
  parkingGuards
} = controller;

const { checkToken, checkUserIsActive } = middleware;


router.get('/', checkToken, checkUserIsActive, find);
router.get('/pending-tickets/:parkingCheckoutId', checkToken, checkUserIsActive, pendingTickets.findByParkingCheckoutId);
router.get('/parking-guards', checkToken, checkUserIsActive, parkingGuards.find);
router.get('/:parkingCheckoutId', checkToken, checkUserIsActive, findById);

// ---

router.post('/', checkToken, checkUserIsActive, add);
router.post('/pending-tickets', checkToken, checkUserIsActive, pendingTickets.add);
router.post(
  '/pending-tickets/:parkingCheckoutPendingTicketId',
  checkToken,
  checkUserIsActive,
  pendingTickets.checkoutPendingById
);
router.post('/parking-guards', checkToken, checkUserIsActive, parkingGuards.add);

// ---

router.put('/', checkToken, checkUserIsActive, update);
router.put('/void', checkToken, checkUserIsActive, voidById);
router.put('/pending-tickets', checkToken, checkUserIsActive, pendingTickets.update);
router.put('/parking-guards', checkToken, checkUserIsActive, parkingGuards.update);

// ---

router.delete('/parking-guards/:parkingGuardId', checkToken, checkUserIsActive, parkingGuards.delete);
router.delete('/:parkingCheckoutId', checkToken, checkUserIsActive, remove);

export default router;
