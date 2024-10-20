import { Router } from 'express';
const router = Router();

import controller from '../controllers/dte.js';
import middleware from '../middlewares/middleware.js';

const { check, signCF, signCCF, getCFPDF, getCCFPDF, sendEmailCF, sendEmailCCF, voidCF, voidCCF } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/check/:saleId', check);
router.get('/sign/cf/:saleId', signCF);
router.get('/sign/ccf/:saleId', signCCF);

router.get('/pdf/cf/download/:saleId', getCFPDF);
router.get('/pdf/ccf/download/:saleId', getCCFPDF);

router.get('/sendmail/cf/:saleId', sendEmailCF);
router.get('/sendmail/ccf/:saleId', sendEmailCCF);

router.delete('/void/cf/:saleId/:authBy', voidCF);
router.delete('/void/ccf/:saleId/:authBy', voidCCF);

export default router;
