import { Router } from 'express';
const router = Router();

import controller from '../controllers/mails.js';

const { sendMail } = controller;

router.get('/send-test', sendMail);

export default router;
