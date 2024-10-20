import { Router } from 'express';
const router = Router();

import controller from '../controllers/parkingReports.js';
import middleware from '../middlewares/middleware.js';

const {
  guardIncomesByMonth,
  guardIncomesByWeek,
  incomesByMonth,
  incomesByWeek,
  expensesByMonth,
  expensesByWeek
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/guard-incomes/:initDate/:finalDate', checkToken, checkUserIsActive, guardIncomesByMonth);
router.get('/guard-incomes-by-week/:initDate/:finalDate', checkToken, checkUserIsActive, guardIncomesByWeek);
router.get('/incomes-by-month/:initDate/:finalDate', checkToken, checkUserIsActive, incomesByMonth);
router.get('/incomes-by-week/:initDate/:finalDate', checkToken, checkUserIsActive, incomesByWeek);
router.get('/expenses-by-month/:initDate/:finalDate', checkToken, checkUserIsActive, expensesByMonth);
router.get('/expenses-by-week/:initDate/:finalDate', checkToken, checkUserIsActive, expensesByWeek);

export default router;
