import { Router } from 'express';
const router = Router();

import controller from '../controllers/generals.js';
import middleware from '../middlewares/middleware.js';

const {
  findBanks,
  findProductDistributions,
  findRawMaterialDistributions,
  findDocumentTypes, 
  findPaymentTypes, 
  findPaymentMethods,
  findAccountingAccounts,
  findDepartments,
  findCities,
  findTaxes,
  findPackageTypes,
  findRelationships,
  validatePolicyDocNumber,
  findProductTypes,
  findRawMaterialTypes,
  findEconomicActivities,
  getCurrentServerTime,
  checkUniquenessValue
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/banks', checkToken, checkUserIsActive, findBanks);
router.get('/product-dist', checkToken, checkUserIsActive, findProductDistributions);
router.get('/rawmat-dist', checkToken, checkUserIsActive, findRawMaterialDistributions);
router.get('/document-types', checkToken, checkUserIsActive, findDocumentTypes);
router.get('/payment-types', checkToken, checkUserIsActive, findPaymentTypes);
router.get('/payment-methods', checkToken, checkUserIsActive, findPaymentMethods);
router.get('/acc-accounts', checkToken, checkUserIsActive, findAccountingAccounts);
router.get('/departments', checkToken, checkUserIsActive, findDepartments);
router.get('/cities', checkToken, checkUserIsActive, findCities);
router.get('/taxes', checkToken, checkUserIsActive, findTaxes);
router.get('/package-types', checkToken, checkUserIsActive, findPackageTypes);
router.get('/relationships', checkToken, checkUserIsActive, findRelationships);
router.get('/product-types', checkToken, checkUserIsActive, findProductTypes);
router.get('/rawmat-types', checkToken, checkUserIsActive, findRawMaterialTypes);
router.get('/economic-activities', checkToken, checkUserIsActive, findEconomicActivities);
router.get('/current-datetime-server', getCurrentServerTime);
router.get('/check-uniqueness', checkToken, checkUserIsActive, checkUniquenessValue);

router.post('/policy/validate-docnumber', checkToken, checkUserIsActive, validatePolicyDocNumber);

export default router;
