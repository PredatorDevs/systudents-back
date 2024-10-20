import { Router } from 'express';
const router = Router();

import controller from '../controllers/locations.js';
import middleware from '../middlewares/middleware.js';

const { find } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);

export default router;
