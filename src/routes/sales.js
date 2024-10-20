import { Router } from 'express';
const router = Router();

import controller from '../controllers/sales.js';
import middleware from '../middlewares/middleware.js';

const { 
    find,
    findById,
    findByDocNumber,
    findByCustomerIdentifier,
    findByProductIdentifier,
    findByCashierDate,
    findByLocationCurrentActiveShiftcut,
    findByMyCashier,
    findPendings,
    findPendingsByLocation,
    findPendingAmountToPay, 
    add,
    validateDocNumber,
    voidSale,
    update,
    remove,
    details,
    payments,
    pdfDocs,
    excelDocs
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);

router.get('/byId/:saleId', checkToken, checkUserIsActive, findById);
router.get('/byDocNumber/:docNumber/:documentTypeId', checkToken, checkUserIsActive, findByDocNumber);
router.get('/by-customer/:customerIdentifier/:startDate/:endDate', checkToken, checkUserIsActive, findByCustomerIdentifier);
router.get('/by-product/:productIdentifier', checkToken, checkUserIsActive, findByProductIdentifier);
router.get('/by-cashier-date/:cashierId/:dateToSearch', checkToken, checkUserIsActive, findByCashierDate);
router.get('/my-cashier/:cashierId', checkToken, checkUserIsActive, findByMyCashier);

router.get('/active-shiftcut/location/:locationId', checkToken, checkUserIsActive, findByLocationCurrentActiveShiftcut);

router.get('/pendings', checkToken, checkUserIsActive, findPendings);
router.get('/pendings/by-location/:locationId', checkToken, checkUserIsActive, findPendingsByLocation);

router.get('/pending-amount-to-pay/:saleId', checkToken, checkUserIsActive, findPendingAmountToPay);

router.post('/', checkToken, checkUserIsActive, add);
router.post('/validate', checkToken, checkUserIsActive, validateDocNumber);
router.post('/void', checkToken, checkUserIsActive, voidSale);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:saleId', checkToken, checkUserIsActive, remove);

// SALES DETAILS

router.get('/details/:saleId', checkToken, checkUserIsActive, details.findBySaleId);

router.post('/details', checkToken, checkUserIsActive, details.add);

router.put('/details', checkToken, checkUserIsActive, details.update);

router.delete('/details/:saleDetailId', checkToken, checkUserIsActive, details.remove);

// SALES PAYMENTS

router.post('/payments/new-single-payment', checkToken, checkUserIsActive, payments.add);
router.post('/payments/new-general-payment', checkToken, checkUserIsActive, payments.addGeneral);

// PDF DOCS

router.get('/pdf-docs/byDocNumber/:docNumber/:documentTypeId', checkToken, checkUserIsActive, pdfDocs.findByDocNumber);
router.get('/pdf-docs/by-customer/:customerIdentifier/:startDate/:endDate', checkToken, checkUserIsActive, pdfDocs.findByCustomerIdentifier);
router.get('/pdf-docs/by-product/:productIdentifier', checkToken, checkUserIsActive, pdfDocs.findByProductIdentifier);

// EXCEL DOCS

router.get('/excel-docs/byDocNumber/:docNumber/:documentTypeId', checkToken, checkUserIsActive, excelDocs.findByDocNumber);
router.get('/excel-docs/by-customer/:customerIdentifier/:startDate/:endDate', checkToken, checkUserIsActive, excelDocs.findByCustomerIdentifier);
router.get('/excel-docs/by-product/:productIdentifier', checkToken, checkUserIsActive, excelDocs.findByProductIdentifier);

export default router;
