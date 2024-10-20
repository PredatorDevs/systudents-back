import { Router } from 'express';
const router = Router();

import controller from '../controllers/policies.js';
import middleware from '../middlewares/middleware.js';

const { find, findById, add, update, remove, voidPolicy, details } = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/', checkToken, checkUserIsActive, find);
router.get('/:policyId', checkToken, checkUserIsActive, findById);

router.post('/', checkToken, checkUserIsActive, add);
router.post('/void', checkToken, checkUserIsActive, voidPolicy);

router.put('/', checkToken, checkUserIsActive, update);

router.delete('/:policyId', checkToken, checkUserIsActive, remove);

// POLICY DETAILS

router.get('/details', checkToken, checkUserIsActive, details.find);
router.get('/details/:policyId', checkToken, checkUserIsActive, details.findByPolicyId);

router.post('/details', checkToken, checkUserIsActive, details.add);

router.put('/details', checkToken, checkUserIsActive, details.update);

router.delete('/details/:policyDetailId', checkToken, checkUserIsActive, details.remove);

export default router;
