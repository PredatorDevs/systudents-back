import { Router } from 'express';
const router = Router();

import controller from '../controllers/authorizations.js';
import middleware from '../middlewares/middleware.js';

const { authLogin, authMH, authUserPassword, authUserPINCode, successVerification } = controller;

const { checkToken } = middleware;

router.post('/', authLogin);
router.post('/authmh', authMH);
router.post('/authpassword', authUserPassword);
router.post('/authuserpincode', authUserPINCode);
router.post('/checktoken', checkToken, successVerification);

export default router;
