import { Router } from 'express';
const router = Router();

import controller from '../controllers/reports.js';
import middleware from '../middlewares/middleware.js';

const {
  testquery,
  kardexByProduct,
  calculatedKardexByProduct,
  createNewPdf,
  createNewPdfAlt,
  getPdf,
  getLocationProductsByCategory,
  getLocationProductsByBrand,
  getLocationProductsByFilteredData,
  shiftcutSettlement,
  shiftcutXSettlement,
  shiftcutZSettlement,
  getMainDashboardData,
  getCashierLocationSalesByMonth,
  getMonthlyFinalConsumerSaleBook,
  getDteMonthlyFinalConsumerSaleBook,
  getMonthlyTaxPayerSaleBook,
  getDteMonthlyTaxPayerSaleBook,
  getMonthlyFinalConsumerSaleBookPDF,
  getMonthlyTaxPayerSaleBookPDF,
  getMonthlyPurchasesBook,
  getMonthlyPurchaseBookPDF,
  getTransferSheet,
  getLowStockByLocation,
  getGeneralInventory,
  getGeneralInventoryStock,
  getProfitReportByLocationDateRange,
  excelDocs
} = controller;

const { checkToken, checkUserIsActive } = middleware;

router.get('/kardex/by-product/:locationId/:productId/:startDate/:endDate', checkToken, checkUserIsActive, kardexByProduct);
router.get('/kardex-calculated/by-product/:locationId/:productId/:startDate/:endDate', calculatedKardexByProduct);
router.get('/profit-report/:locationId/:startDate/:endDate', getProfitReportByLocationDateRange);

router.post('/create-pdf', createNewPdf);
router.post('/create-pdf-alt', createNewPdfAlt);
router.get('/get-pdf', getPdf);
router.get('/get-product-by-cat/:locationId', getLocationProductsByCategory);
router.get('/get-product-by-brand/:locationId', getLocationProductsByBrand);
router.get('/shiftcut-settlement/:shiftcutId', shiftcutSettlement);
router.get('/shiftcut-settlement-x/:shiftcutId', shiftcutXSettlement);
router.get('/shiftcut-settlement-z/:shiftcutDay/:initShiftcutId/:finalShiftcutId', shiftcutZSettlement);
router.get('/main-dashboard/:startDate/:endDate', getMainDashboardData);
router.get('/cashier-location-sales-by-month/:locationId/:cashierId/:documentTypeId/:month', getCashierLocationSalesByMonth);
router.get('/location-final-consumer-sale-book/:locationId/:month', getMonthlyFinalConsumerSaleBook);
router.get('/location-dte-final-consumer-sale-book/:locationId/:month', getDteMonthlyFinalConsumerSaleBook);
router.get('/location-tax-payer-sale-book/:locationId/:month', getMonthlyTaxPayerSaleBook);
router.get('/location-dte-tax-payer-sale-book/:locationId/:month', getDteMonthlyTaxPayerSaleBook);
router.get('/location-final-consumer-sale-book-pdf/:locationId/:month', getMonthlyFinalConsumerSaleBookPDF);
router.get('/location-tax-payer-sale-book-pdf/:locationId/:month', getMonthlyTaxPayerSaleBookPDF);
router.get('/location-purchase-book/:locationId/:month', getMonthlyPurchasesBook);
router.get('/location-purchase-book-pdf/:locationId/:month', getMonthlyPurchaseBookPDF);
router.get('/transfer-sheet/:transferId', getTransferSheet);
router.get('/low-stock-report/:locationId', getLowStockByLocation);
router.get('/general-inventory', getGeneralInventory);
router.get('/general-inventory-stock', getGeneralInventoryStock);

router.post('/get-product-by-filtered-data', getLocationProductsByFilteredData);

router.post('/testquery', testquery);

router.get('/excel/low-stock-report/:locationId', excelDocs.getLowStockByLocation);
router.get('/excel/profit-report/:locationId/:startDate/:endDate', excelDocs.getProfitReportByLocationDateRange);
router.get('/excel/pending-sales', excelDocs.getPendingSales);
router.get('/excel/pending-productpurchases', excelDocs.getPendingProductPurchases);

export default router;
