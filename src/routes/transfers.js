import { Router } from 'express';
const router = Router();

import controller from '../controllers/transfers.js';
import middleware from '../middlewares/middleware.js';

const { 
  incomingTransfers, incomingTransfersBySentAtRange, incomingTransfersByReceivedAtRange,
  outcomingTransfers, outcomingTransfersBySentAtRange, outcomingTransfersReceivedAtRange,
  findById,
  confirmTransfer, confirmTransferDetail, rejectTransfer, rejectTransferDetail,
  add, addDetails, getRejectedDetails,
  restoreRejectedDetail,
  discardRejectedDetail
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/rejecteds', checkToken, checkUserIsActive, getRejectedDetails);

router.get('/incoming/:destinationLocationId', checkToken, checkUserIsActive, incomingTransfers);
router.get('/incoming/sent-at/:destinationLocationId/:initialDate/:finalDate', checkToken, checkUserIsActive, incomingTransfersBySentAtRange);
router.get('/incoming/received-at/:destinationLocationId/:initialDate/:finalDate', checkToken, checkUserIsActive, incomingTransfersByReceivedAtRange);

router.get('/outcoming/:originLocationId', checkToken, checkUserIsActive, outcomingTransfers);
router.get('/outcoming/sent-at/:originLocationId/:initialDate/:finalDate', checkToken, checkUserIsActive, outcomingTransfersBySentAtRange);
router.get('/outcoming/received-at/:originLocationId/:initialDate/:finalDate', checkToken, checkUserIsActive, outcomingTransfersReceivedAtRange);

router.get('/:transferId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);
router.post('/details', checkToken, checkUserIsActive, addDetails);

router.put('/confirm/:transferId', checkToken, checkUserIsActive, confirmTransfer);
router.put('/confirm-detail/:transferDetailId', checkToken, checkUserIsActive, confirmTransferDetail);

router.put('/reject/:transferId', checkToken, checkUserIsActive, rejectTransfer);
router.put('/reject-detail/:transferDetailId', checkToken, checkUserIsActive, rejectTransferDetail);

router.put('/restore-rejected/:transferRejectedDetailId', checkToken, checkUserIsActive, restoreRejectedDetail);
router.put('/discard-rejected/:transferRejectedDetailId', checkToken, checkUserIsActive, discardRejectedDetail);

export default router;
