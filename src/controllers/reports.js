import PdfPrinter from 'pdfmake';
import * as fs from 'fs';
import connUtil from "../helpers/connectionUtil.js";
import renders from "../helpers/pdfRendering.js";
import rendersAlt from "../helpers/pdfRenderingAlt.js";
import errorResponses from '../helpers/errorResponses.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import stringHelpers from '../helpers/stringHelpers.js';
import xl from 'excel4node';

const controller = {};

controller.excelDocs = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fonts = {
  Roboto: {
    normal: path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
    italics: path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
  }
};

const excelHeaderStyle = {
  font: {
    bold: true,
    color: '#000000',
    size: 12,
  },
  border: {
    left: {
      style: 'thin', //§18.18.3 ST_BorderStyle (Border Line Styles) ['none', 'thin', 'medium', 'dashed', 'dotted', 'thick', 'double', 'hair', 'mediumDashed', 'dashDot', 'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'slantDashDot']
      color: '#000000' // HTML style hex value
    },
    right: {
      style: 'thin',
      color: '#000000'
    },
    top: {
      style: 'thin',
      color: '#000000'
    },
    bottom: {
      style: 'thin',
      color: '#000000'
    },
  },
  numberFormat: '$#,##0.00; ($#,##0.00); -',
};

const excelBodyStyle = {
  font: {
    bold: false,
    color: '#000000',
    size: 10,
  },
  border: {
    left: {
      style: 'thin', //§18.18.3 ST_BorderStyle (Border Line Styles) ['none', 'thin', 'medium', 'dashed', 'dotted', 'thick', 'double', 'hair', 'mediumDashed', 'dashDot', 'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'slantDashDot']
      color: '#000000' // HTML style hex value
    },
    right: {
      style: 'thin',
      color: '#000000'
    },
    top: {
      style: 'thin',
      color: '#000000'
    },
    bottom: {
      style: 'thin',
      color: '#000000'
    },
  },
  numberFormat: '$#,##0.00; ($#,##0.00); -',
};

const queries = {
  kardexByProduct: `
    SELECT * FROM (
      SELECT
        log.id AS logId,
        IFNULL(policies.docNumber, '-') AS referenceNumber,
        IFNULL(policies.docDatetime, '1990-01-01 00:00:00') AS referenceDatetime,
        CONCAT("Ingreso de póliza #", IFNULL(policies.docNumber, '-')) AS concept,
        'Póliza' AS referenceType,
        0.00 AS sales,
        log.quantity AS purchases,
        log.newBalance AS balance
      FROM
        productstocklogs log
        INNER JOIN policies 
          ON log.referenceId = policies.id
        INNER JOIN policydetails 
          ON policies.id = policydetails.policyId
      WHERE
        log.productStockId = (
          SELECT id FROM productstocks WHERE locationId = ? AND productId = ? LIMIT 1
        )
        AND log.referenceType = 'policy'
        AND DATE_FORMAT(policies.docDatetime, "%Y-%m-%d") BETWEEN ? AND ?
      UNION
      SELECT
        log.id AS logId,
        IFNULL(sales.docNumber, '-') AS referenceNumber,
        IFNULL(sales.docDatetime, '1990-01-01 00:00:00') AS referenceDatetime,
        CONCAT("Venta #", IFNULL(sales.docNumber, '-')) AS concept,
        'Venta' AS referenceType,
        log.quantity AS sales,
        0.00 AS purchases,
        log.newBalance AS balance
      FROM
        productstocklogs log
        INNER JOIN sales 
          ON log.referenceId = sales.id
        INNER JOIN saledetails 
          ON sales.id = saledetails.saleId
      WHERE 
        log.productStockId = (
          SELECT id FROM productstocks WHERE locationId = ? AND productId = ? LIMIT 1
        )
        AND log.referenceType = 'sale'
        AND DATE_FORMAT(sales.docDatetime, "%Y-%m-%d") BETWEEN ? AND ?
    ) AS result
    ORDER BY result.referenceDatetime;
  `,
  calculatedKardexByProduct: `
    SET @initialStockValue = (SELECT initialStock FROM productstocks WHERE locationId = ? AND productId = ?);
    
    WITH cte_product_kardex AS (
      SELECT 
        0 AS documentType,
        NULL AS documentNumber,
        "2024-01-01 00:00:00" AS documentDatetime,
        NULL AS documentPerson,
        "Saldo Inicial" AS documentConcept,
        "" AS documentNationality,
        NULL AS documentUnitCost,
        NULL AS documentUnitValue,
        @initialStockValue AS documentProductQuantity
      UNION ALL
        SELECT 
        1 AS documentType,
        IFNULL(head.docNumber, "-") AS documentNumber,
        head.docDatetime AS documentDatetime,
        head.supplier AS documentPerson,
        "Póliza" AS documentConcept,
        "SV" AS documentNationality,
        det.unitCost AS documentUnitCost,
        det.unitCost AS documentUnitValue,
        det.quantity AS documentProductQuantity
      FROM 
        policies head
        INNER JOIN policydetails det ON head.id = det.policyId
      WHERE
        head.locationId = ?
        AND det.productId = ?
        -- PRODUCT PURCHASES MOVEMENT SELECT
        UNION ALL
          SELECT 
          1 AS documentType,
          IFNULL(head.documentNumber, "-") AS documentNumber,
          head.documentDatetime AS documentDatetime,
          supplier.name AS documentPerson,
          "Compra" AS documentConcept,
          "SV" AS documentNationality,
          det.unitCost AS documentUnitCost,
          det.unitCost AS documentUnitValue,
          det.quantity AS documentProductQuantity
        FROM 
          productpurchases head
          INNER JOIN productpurchasedetails det ON head.id = det.productPurchaseId
          INNER JOIN suppliers supplier ON head.supplierId = supplier.id
        WHERE
          head.locationId = ?
          AND det.productId = ?
      UNION ALL
      SELECT 
        2 AS documentType,
        IFNULL(head.docNumber, "-") AS documentNumber,
        head.docDatetime AS documentDatetime,
        cus.fullName AS documentPerson,
        "Venta" AS documentConcept,
        IFNULL(cus.nationality, "SV") AS documentNationality,
        det.unitCost AS documentUnitCost,
        (det.unitPrice / 1.13) AS documentUnitValue,
        det.quantity AS documentProductQuantity
      FROM 
        sales head
        INNER JOIN customers cus ON head.customerId = cus.id
        INNER JOIN saledetails det ON head.id = det.saleId
      WHERE
        head.locationId = ?
        AND det.productId = ?
      UNION ALL
      SELECT 
      det.adjustmentType AS documentType,
      IFNULL(head.id, "-") AS documentNumber,
      head.adjustmentDatetime AS documentDatetime,
      head.comments AS documentPerson,
      CONCAT("AJUSTE INV - ", IF(det.adjustmentType = 1, "ENTRADA", "SALIDA")) AS documentConcept,
      "SV" AS documentNationality,
      det.unitCost AS documentUnitCost,
      0 AS documentUnitValue,
      det.quantity AS documentProductQuantity
      FROM 
      productstockadjustments head
      INNER JOIN productstockadjustmentdetails det ON head.id = det.productStockAdjustmentId
      WHERE
      det.locationId = ?
      AND det.productId = ?
    )
    SELECT
      ROW_NUMBER() OVER() AS documentCorrelative,
      documentType,
      documentNumber,
      documentDatetime,
      DATE_FORMAT(documentDatetime, "%d/%m/%y") AS documentDatetimeFormatted,
      documentPerson,
      documentConcept,
      documentNationality,
      documentUnitCost,
      documentUnitValue,
      documentProductQuantity
    FROM 
      cte_product_kardex
    ORDER BY 
      documentDatetime ASC;  
  `,
  getGeneralInventory: `
    SELECT
      ps.productId,
      ps.productName,
      p.productCost,
      p.productTotalTaxes,
      p.productTotalCost,
      p.packageContent,
      ROUND(SUM(ps.stock), 2) AS totalStock,
      (p.productCost * SUM(ps.stock)) AS totalStockCost,
      (p.productTotalTaxes * SUM(ps.stock)) AS totalStockTotalTaxes,
      (p.productTotalCost * SUM(ps.stock)) AS totalStockTotalCost
    FROM
      vw_productstocks ps
      INNER JOIN vw_products p ON ps.productId = p.productId
    GROUP BY
      ps.productId,
      ps.productName,
      p.productCost,
      p.productTotalTaxes,
      p.productTotalCost,
      p.packageContent
    ORDER BY
      ps.productName;
  `,
  getGeneralInventoryStock: `
    SELECT
      ps.productStockId,
      ps.locationId,
      ps.locationName,
      ps.productId,
      ps.productName,
      p.packageContent,
      ROUND(ps.stock, 2) AS stock
    FROM
      vw_productstocks ps
      INNER JOIN vw_products p ON ps.productId = p.productId
    ORDER BY
      productName,
      locationId;
  `,
  getLocationProductsByCategory: `
    SELECT id, name FROM categories
    WHERE id IN (SELECT categoryId FROM products WHERE isActive = 1);
    SELECT
      productId,
      productName,
      packageContent,
      productCost,
      productCategoryId,
      ROUND((
        SELECT
          stock
        FROM
          productstocks
        WHERE
          productId = vw_products.productId
          AND locationId = ?
      ), 2) AS currentLocationStock
    FROM
      vw_products;
  `,
  getLocationProductsByBrand: `
    SELECT id, name FROM brands
    WHERE id IN (SELECT brandId FROM products WHERE isActive = 1);
    SELECT
      productId,
      productName,
      packageContent,
      productCost,
      productBrandId,
      ROUND((
        SELECT
          stock
        FROM
          productstocks
        WHERE
          productId = vw_products.productId
          AND locationId = ?
      ), 2) AS currentLocationStock
    FROM
      vw_products;
  `,
  shiftcutSettlement: `
    SELECT * FROM vw_shitfcuts WHERE shiftcutId = ?;
    
    CALL usp_ReportShiftcutSales(?);
    CALL usp_ShiftcutSummary(?);
    CALL usp_ShiftcutPayments(?);
    CALL usp_ShiftcutCashFundMovements(?);

    WITH gas_sale_cte AS (
      SELECT
        sd.productId,
        p.code AS productCode,
        p.name AS productName,
        sd.unitPrice,
        ROUND(SUM(sd.quantity), 4) AS totalQuantity,
        SUM(sd.unitPrice * sd.quantity) AS totalSale,
        SUM((
        SELECT round(fn_calculatesaledetailtaxamountbyid(sd.id, sd.unitPrice, sd.quantity, 1), 4)
        FROM saledetails det
        WHERE det.id = sd.id
        )) AS totalIva,
        SUM((
        SELECT round(fn_calculatesaledetailtaxamountbyid(sd.id, sd.unitPrice, sd.quantity, 2), 4)
        FROM saledetails det
        WHERE det.id = sd.id
        )) AS totalFovial,
        SUM((
        SELECT round(fn_calculatesaledetailtaxamountbyid(sd.id, sd.unitPrice, sd.quantity, 3), 4)
        FROM saledetails det
        WHERE det.id = sd.id
        )) AS totalCotrans
      FROM
        saledetails sd
        INNER JOIN products p ON sd.productId = p.id
        INNER JOIN sales s ON sd.saleId = s.id
      WHERE
        sd.isActive = 1
        AND sd.isVoided = 0
        -- AND sd.productId IN (2614, 2613, 2612)
        AND s.shiftcutId = ?
        AND s.isActive = 1
        AND s.isVoided = 0
      GROUP BY
        sd.productId,
        p.code,
        p.name,
        sd.unitPrice
    )
    SELECT
      productId,
      productCode,
      productName,
      unitPrice,
      totalQuantity,
      totalSale,
      totalIva,
      totalFovial,
      totalCotrans
    FROM
      gas_sale_cte cte
    WHERE
      cte.productId IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      999999 AS productId,
      '' AS productCode,
      'TOTAL COMBUSTIBLES' AS productName,
      0.00 AS unitPrice,
      SUM(totalQuantity) AS totalQuantity,
      SUM(totalSale) AS totalSale,
      SUM(totalIva) AS totalIva,
      SUM(totalFovial) AS totalFovial,
      SUM(totalCotrans) AS totalCotrans
    FROM
      gas_sale_cte cte
    WHERE
      cte.productId IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      productId,
      productCode,
      productName,
      unitPrice,
      totalQuantity,
      totalSale,
      totalIva,
      totalFovial,
      totalCotrans
    FROM
      gas_sale_cte cte
    WHERE
      cte.productId NOT IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      999998 AS productId,
      '' AS productCode,
      'TOTAL LUBRICANTES' AS productName,
      0.00 AS unitPrice,
      SUM(totalQuantity) AS totalQuantity,
      SUM(totalSale) AS totalSale,
      SUM(totalIva) AS totalIva,
      SUM(totalFovial) AS totalFovial,
      SUM(totalCotrans) AS totalCotrans
    FROM
      gas_sale_cte cte
    WHERE
      cte.productId NOT IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      999997 AS productId,
      'TGENERAL' AS productCode,
      'TOTAL GENERAL' AS productName,
      0.00 AS unitPrice,
      SUM(totalQuantity) AS totalQuantity,
      SUM(totalSale) AS totalSale,
      SUM(totalIva) AS totalIva,
      SUM(totalFovial) AS totalFovial,
      SUM(totalCotrans) AS totalCotrans
    FROM
      gas_sale_cte cte;
  `,
  shiftcutXSettlement: `
    SELECT
      locationOwnerTradename, -- ENCABEZADO: NEGOCIO
      locationOwnerName, -- ENCABEZADO: NOMBRE O RAZON SOCIAL
      locationOwnerActivityCode, -- ENCABEZADO: CODIGO GIRO
      locationOwnerActivityDescription, -- ENCABEZADO: NOMBRE GIRO
      locationOwnerNit, -- ENCABEZADO: NIT
      locationOwnerNrc, -- ENCABEZADO: NRC
      shiftcutDatetime, -- ENCABEZADO: FECHA DE TURNO
      date_format(shiftcutDatetime, '%d-%m-%Y %h:%i:%s') AS shiftcutDatetimeFormatted,
      openedByFullname, -- ENCABEZADO: TURNO ABIERTO POR
      closedByFullname, -- ENCABEZADO: TURNO CERADO POR
      cashierName, -- ENCABEZADO: NOMBRE DE CAJA
      shiftcutNumber -- ENCABEZADO: NUMERO TURNO
    FROM
      vw_shitfcuts
    WHERE
      shiftcutId = ?;
    CALL usp_ShiftcutX(?);
  `,
  shiftcutZSettlement: `
    SELECT
      shiftcut.locationId,
      shiftcut.locationName,
      shiftcut.cashierId,
      shiftcut.cashierName,
      date_format(shiftcut.closedAt, '%Y-%m-%d') AS shiftcutDatetime,
      shiftcut.locationOwnerTradename, -- ENCABEZADO: NEGOCIO
      shiftcut.locationOwnerName, -- ENCABEZADO: NOMBRE O RAZON SOCIAL
      shiftcut.locationOwnerActivityCode, -- ENCABEZADO: CODIGO GIRO
      shiftcut.locationOwnerActivityDescription, -- ENCABEZADO: NOMBRE GIRO
      shiftcut.locationOwnerNit, -- ENCABEZADO: NIT
      shiftcut.locationOwnerNrc, -- ENCABEZADO: NRC
      ? AS shiftcutDate, -- ENCABEZADO: FECHA DE TURNO    
  	MIN(shiftcut.shiftcutNumber) AS prevShiftcutNumber,
  	MAX(shiftcut.shiftcutNumber) AS lastShiftcutNumber,
        MIN(shiftcut.shiftcutId) AS prevShiftcutId,
        MAX(shiftcut.shiftcutId) AS lastShiftcutId,
      (
        SELECT SUM(vs.total)
        FROM vw_sales vs
        WHERE vs.shiftcutId
          BETWEEN MIN(shiftcut.shiftcutId) AND
          MAX(shiftcut.shiftcutId)
      ) AS totalSale
    FROM 
      vw_shitfcuts shiftcut
    WHERE 
      shiftcut.locationId = 1
      AND shiftcut.cashierId = 5
      AND shiftcut.shiftcutStatus = 2
      AND date_format(shiftcut.closedAt, '%Y-%m-%d') = ?
    GROUP BY
      shiftcut.locationId,
      shiftcut.locationName,
      shiftcut.cashierId,
      shiftcut.cashierName,
      date_format(shiftcut.closedAt, '%Y-%m-%d'),
      shiftcut.locationOwnerTradename, -- ENCABEZADO: NEGOCIO
      shiftcut.locationOwnerName, -- ENCABEZADO: NOMBRE O RAZON SOCIAL
      shiftcut.locationOwnerActivityCode, -- ENCABEZADO: CODIGO GIRO
      shiftcut.locationOwnerActivityDescription, -- ENCABEZADO: NOMBRE GIRO
      shiftcut.locationOwnerNit, -- ENCABEZADO: NIT
      shiftcut.locationOwnerNrc; -- ENCABEZADO: NRC
    
    CALL usp_ShiftcutZ(?, ?);
  `,
  getMainDashboardData: `
    CALL usp_MainDashboard(?, ?);
  `,
  getCashierLocationSalesByMonth: `
    SELECT *
    FROM vw_sales
    WHERE locationId = ?
    AND cashierId = ?
    AND documentTypeId = ?
    AND docDatetimeFormatted = ?
    ORDER BY docNumber;
  `,
  getMonthlyFinalConsumerSaleBook: `
    SELECT
      ROW_NUMBER() OVER(ORDER BY vs.docDatetime) AS rowNum,
      date_format(vs.docDatetime, '%Y-%m-%d') AS reportDay,
      vs.documentTypeId AS documentTypeId,
      vs.serie AS serie,
      vs.cashierId AS cashierId,
      MIN(CAST(vs.docNumber as SIGNED INTEGER)) AS documentNumberFrom,
      MAX(CAST(vs.docNumber as SIGNED INTEGER)) AS documentNumberTo,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 1, (vs.noTaxableSubTotal - vs.IVAretention + vs.IVAperception - (IF (vs.isNoTaxableOperation = 1, vs.ivaTaxAmount, 0) + vs.fovialTaxAmount + vs.cotransTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 0, (vs.taxableSubTotal - vs.IVAretention + vs.IVAperception - (IF (vs.isNoTaxableOperation = 0, vs.ivaTaxAmount, 0) + vs.fovialTaxAmount + vs.cotransTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 0, vs.ivaTaxAmount, 0), 0)) AS ivaTaxAmount,
      SUM(IFNULL(vs.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(vs.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(0, 0)) AS exportations,
      SUM(IFNULL(vs.total - (IF (vs.isNoTaxableOperation = 1, vs.ivaTaxAmount, 0)), 0)) AS total,
      SUM(IFNULL(0, 0)) AS totalToThirdAccounts,
      SUM(IFNULL(vs.totalTaxes, 0)) AS totalTaxes,
      ROUND(SUM(IFNULL(vs.IVARetention, 0)), 2) AS IVARetention,
      ROUND(SUM(IFNULL(vs.IVAPerception, 0)), 2) AS IVAPerception
    FROM
      vw_sales vs
    WHERE
      vs.locationId = ?
      AND vs.documentTypeId IN (1, 2)
      AND vs.docDatetimeFormatted = ?
      AND vs.isVoided = 0
    GROUP BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.documentTypeId,
      vs.serie,
      vs.cashierId
    ORDER BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.cashierId,
      CAST(vs.docNumber as SIGNED INTEGER);

    WITH cte_details AS (
      SELECT
          det.saleId AS saleId,
        det.productId AS productId,
        det.productDistributionId AS productDistributionId,
          round((det.unitPrice * det.quantity), 2) AS subTotal,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 1), 4) AS ivaTaxAmount,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 2), 4) AS fovialTaxAmount,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 3), 4) AS cotransTaxAmount
      FROM
          saledetails det
      WHERE
        det.saleId IN (
          SELECT
            vs.id
          FROM
            sales vs
          WHERE
            vs.locationId = ?
            AND vs.documentTypeId IN (1, 2)
            AND date_format(vs.docDatetime, '%Y-%m') = ?
            AND vs.isVoided = 0
        )
    )
    SELECT
      'TIENDA' AS summaryDescription,
      '#f6ffed' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 1
    UNION ALL
    SELECT
      'PISTA (COMBUSTIBLES)' AS summaryDescription,
      '#f9f0ff' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 2
      AND cte.productId IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      'PISTA (LUBRICANTES Y OTROS)' AS summaryDescription,
      '#fff0f6' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 2
      AND cte.productId NOT IN (2614, 2613, 2612);
  `,
  getDteMonthlyFinalConsumerSaleBook: `
    SELECT
      ROW_NUMBER() OVER(ORDER BY vs.docDatetime) AS rowNum,
      date_format(vs.docDatetime, '%d/%m/%Y') AS fechaEmision,
      4 AS claseDocumento,
      vs.dteType AS tipoDocumento,
      REPLACE(vs.controlNumber, '-', '') AS numeroResolucion,
      vs.receptionStamp AS serieDocumento,
      MIN(vs.docNumber) AS numeroControlInternoDel,
      MAX(vs.docNumber) AS numeroControlInternoAl,
      MIN(vs.controlNumber) AS numeroDocumentoDel,
      MAX(vs.controlNumber) AS numeroDocumentoAl,
      vs.cashierId AS numMaquinaRegistradora,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 1, (vs.noTaxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount)), 0), 0)) AS ventasExentas,
      0 AS ventasIntExentasNoSujProporcion,
      0 AS ventasNoSujetas,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 0, (vs.taxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount)), 0), 0)) AS ventasGravadasLocales,
      SUM(IFNULL(IF (vs.isNoTaxableOperation = 0, vs.ivaTaxAmount, 0), 0)) AS montoIva,
      SUM(IFNULL(vs.fovialTaxAmount, 0)) AS montoFovial,
      SUM(IFNULL(vs.cotransTaxAmount, 0)) AS montoCotrans,
      0 AS exportacionesDentroAreaCentroAme,
      0 AS exportacionesFueraAreaCentroAme,
      0 AS exportacionesDeServicios,
      0 AS ventasZonasFrancasYDPA,
      0 AS ventasCuentaTercerosNoDomiciliados,
      SUM(IFNULL(vs.total - (IF (vs.isNoTaxableOperation = 1, vs.ivaTaxAmount, 0)) - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount), 0)) AS totalVentas,
      2 AS numeroAnexo
      -- vs.cashierId
    FROM
      vw_sales vs
    WHERE
      vs.locationId = ?
      AND vs.documentTypeId IN (1, 2)
      AND vs.docDatetimeFormatted = ?
      AND vs.isVoided = 0
      AND vs.receptionStamp IS NOT NULL
      AND vs.cashierId NOT IN (13)
    GROUP BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.documentTypeId,
      vs.cashierId
    ORDER BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.docNumber;
  `,
  getMonthlyTaxPayerSaleBook: `
    SELECT
      ROW_NUMBER() OVER(ORDER BY vs.docDatetime) AS rowNum,
      date_format(vs.docDatetime, '%Y-%m-%d') AS reportDay,
      vs.documentTypeId AS documentTypeId,
      vs.cashierId AS cashierId,
      vs.docNumber AS documentNumber,
      '' AS formUniqueController,
      vs.customerFullname AS customerFullname,
      vs.customerNrc AS customerNrc,
      IFNULL(if (vs.isNoTaxableOperation = 1, (vs.noTaxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount + vs.ivaTaxAmount)), 0), 0) AS noTaxableSubTotal,
      IFNULL(if(vs.isNoTaxableOperation = 0, vs.taxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount + vs.ivaTaxAmount), 0), 0) AS taxableSubTotal,
      IFNULL(vs.taxableSubTotalWithoutTaxes, 0) AS taxableSubTotalWithoutTaxes,
      IFNULL(if (vs.isNoTaxableOperation = 0, (vs.ivaTaxAmount), 0) , 0) AS ivaTaxAmount,
      IFNULL(vs.fovialTaxAmount, 0) AS fovialTaxAmount,
      IFNULL(vs.cotransTaxAmount, 0) AS cotransTaxAmount,
      IFNULL(vs.totalTaxes, 0) AS totalTaxes,
      IFNULL(vs.IVAretention, 0) AS IVAretention,
      IFNULL(vs.IVAperception , 0) AS IVAperception,
      0 AS thirdNoTaxableSubTotal,
      0 AS thirdTaxableSubTotal,
      0 AS thirdTaxableSubTotalWithoutTaxes,
      0 AS thirdTotalTaxes,
      IFNULL(vs.total - (IF (vs.isNoTaxableOperation = 1, vs.ivaTaxAmount, 0)) - vs.IVAretention + vs.IVAperception, 0) AS total
    FROM
      vw_sales vs
    WHERE
      vs.locationId = ?
      AND vs.documentTypeId IN (3)
      AND vs.docDatetimeFormatted = ?
      AND vs.isVoided = 0
    ORDER BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.docNumber;

    WITH cte_details AS (
      SELECT
          det.saleId AS saleId,
        det.productId AS productId,
        det.productDistributionId AS productDistributionId,
          round((det.unitPrice * det.quantity), 2) AS subTotal,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 1), 4) AS ivaTaxAmount,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 2), 4) AS fovialTaxAmount,
          round(fn_calculatesaledetailtaxamountbyid(det.id, det.unitPrice, det.quantity, 3), 4) AS cotransTaxAmount
      FROM
          saledetails det
      WHERE
        det.saleId IN (
          SELECT
            vs.id
          FROM
            sales vs
          WHERE
            vs.locationId = ?
            AND vs.documentTypeId IN (3)
            AND date_format(vs.docDatetime, '%Y-%m') = ?
            AND vs.isVoided = 0
        )
    )
    SELECT
      'TIENDA' AS summaryDescription,
      '#f6ffed' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 1
    UNION ALL
    SELECT
      'PISTA (COMBUSTIBLES)' AS summaryDescription,
      '#f9f0ff' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 2
      AND cte.productId IN (2614, 2613, 2612)
    UNION ALL
    SELECT
      'PISTA (LUBRICANTES Y OTROS)' AS summaryDescription,
      '#fff0f6' AS summaryBgColor,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS noTaxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.subTotal - (cte.fovialTaxAmount + cte.cotransTaxAmount + cte.ivaTaxAmount)), 0), 0)) AS taxableSubTotal,
      SUM(IFNULL(if((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 0, (cte.ivaTaxAmount), 0) , 0)) AS ivaTaxAmount,
      SUM(IFNULL(cte.fovialTaxAmount, 0)) AS fovialTaxAmount,
      SUM(IFNULL(cte.cotransTaxAmount, 0)) AS cotransTaxAmount,
      SUM(IFNULL(cte.subTotal - (IF ((SELECT head.isNoTaxableOperation FROM sales head WHERE id = cte.saleId) = 1, cte.ivaTaxAmount, 0)), 0)) AS total
    FROM
      cte_details cte
    WHERE
      cte.productDistributionId = 2
      AND cte.productId NOT IN (2614, 2613, 2612);
  `,
  getDteMonthlyTaxPayerSaleBook: `
    SELECT
      -- ROW_NUMBER() OVER(ORDER BY vs.docDatetime) AS rowNum,
      date_format(vs.docDatetime, '%d/%m/%Y') AS fechaEmision,
      4 AS claseDocumento,
      vs.dteType AS tipoDocumento,
      REPLACE(vs.controlNumber, '-', '') AS numeroResolucion,
      vs.receptionStamp AS serieDocumento,
      vs.controlNumber AS numeroDocumento,
      '' AS numeroControlInterno,
      IFNULL(vs.customerNrc, vs.customerNit) AS nitNrcCliente,
      vs.customerFullname AS nombreRazonSocialDenominacion,
      IFNULL(if (vs.isNoTaxableOperation = 1, (vs.noTaxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount + vs.ivaTaxAmount)), 0), 0) AS ventasExentas,
      0 AS ventasNoSujetas,
      IFNULL(if(vs.isNoTaxableOperation = 0, vs.taxableSubTotal - vs.IVAretention + vs.IVAperception - (vs.fovialTaxAmount + vs.cotransTaxAmount + vs.ivaTaxAmount), 0), 0) AS ventasGravadasLocales,
      IFNULL(vs.fovialTaxAmount, 0) AS fovialTaxAmount,
      IFNULL(vs.cotransTaxAmount, 0) AS cotransTaxAmount,
      IFNULL(if (vs.isNoTaxableOperation = 0, (vs.ivaTaxAmount), 0) , 0) AS debitoFiscal,
      IFNULL(vs.IVAretention, 0) AS IVAretention,
      IFNULL(vs.IVAperception , 0) AS IVAperception,
      0 AS ventasCuentaTercerosNoDomicioliados,
      0 AS debitoFiscalPorVentaCuentaTerceros,
      IFNULL(vs.total - (IF (vs.isNoTaxableOperation = 1, vs.ivaTaxAmount, 0)) - vs.IVAretention + vs.IVAperception, 0) AS totalVentas,
      '' AS duiCliente,
      1 AS numeroAnexo
    FROM
      vw_sales vs
    WHERE
      vs.locationId = ?
      AND vs.documentTypeId IN (3)
      AND vs.docDatetimeFormatted = ?
      AND vs.isVoided = 0
      AND vs.receptionStamp IS NOT NULL
      AND vs.cashierId NOT IN (13)
    ORDER BY
      date_format(vs.docDatetime, '%Y-%m-%d'),
      vs.docNumber;
  `,
  getMonthlyPurchasesBook: `
    SELECT
      ROW_NUMBER() OVER(ORDER BY vpp.documentDatetime) AS rowNum,
      date_format(vpp.documentDatetime, '%Y-%m-%d') AS reportDay,
      vpp.documentTypeId AS documentTypeId,
      vpp.documentNumber AS documentNumber,
      vpp.supplierNrc AS supplierNrc,
      vpp.supplierName AS supplierName,
      IFNULL(vpp.noTaxableSubTotal, 0) AS noTaxableSubTotal,
      0 AS noTaxableSubTotalImport,
      IFNULL(vpp.taxableSubTotal, 0) AS taxableSubTotal,
      0 AS taxableSubTotalImport,
      IFNULL(vpp.taxableSubTotalWithoutTaxes, 0) AS taxableSubTotalWithoutTaxes,
      0 AS taxableSubTotalWithoutTaxesImport,
      IFNULL(vpp.totalTaxes, 0) AS totalTaxes,
      IFNULL(vpp.total, 0) AS total,
      ROUND(IFNULL(vpp.IVAretention, 0), 2) AS IVAretention,
      0 AS totalExcludeIndividuals
    FROM
      vw_productpurchases vpp
    WHERE
      vpp.locationId = ?
      AND vpp.documentDatetimeFormatted = ?
    UNION ALL
    SELECT
      ROW_NUMBER() OVER(ORDER BY vpp.documentDatetime) AS rowNum,
      date_format(vpp.documentDatetime, '%Y-%m-%d') AS reportDay,
      vpp.documentTypeId AS documentTypeId,
      vpp.documentNumber AS documentNumber,
      vpp.supplierNrc AS supplierNrc,
      vpp.supplierName AS supplierName,
      IFNULL(vpp.noTaxableSubTotal, 0) AS noTaxableSubTotal,
      0 AS noTaxableSubTotalImport,
      IFNULL(vpp.taxableSubTotal, 0) AS taxableSubTotal,
      0 AS taxableSubTotalImport,
      IFNULL(vpp.taxableSubTotalWithoutTaxes, 0) AS taxableSubTotalWithoutTaxes,
      0 AS taxableSubTotalWithoutTaxesImport,
      IFNULL(vpp.totalTaxes, 0) AS totalTaxes,
      IFNULL(vpp.total, 0) AS total,
      ROUND(IFNULL(vpp.IVAretention, 0), 2) AS IVAretention,
      0 AS totalExcludeIndividuals
    FROM
      vw_rawmaterialpurchases vpp
    WHERE
      vpp.locationId = ?
      AND vpp.documentDatetimeFormatted = ?
    ORDER BY
      2,
      4;
  `,
  getTransferSheet: `
    SELECT * FROM vw_transfers WHERE transferId = ?;
    SELECT * FROM vw_transferdetails WHERE transferId = ?;
  `,
  getLowStockByLocation: `
    CALL usp_ReportMinStocks(?);
  `,
  getProfitReportByLocationDateRange: `
    SELECT name FROM locations WHERE id = ?;

    SELECT
      head.docDatetimeLabel,
      date_format(head.docDatetime, '%Y-%m-%d') AS docDatetimeFormat,
      head.documentTypeName,
      head.docNumber,
      det.productCode,
      det.categoryName,
      det.productName,
      det.quantity,
      det.unitPrice, -- PRECIO UNITARIO
      det.taxableSubTotal, -- VENTA TOTAL
      det.totalTaxes, -- PRECIO VENTA IVA
      det.unitCost, -- COSTO UNITARIO
      det.totalCost, -- COSTO VENTA
      det.totalCostTaxes, -- COSTO MAS IVA VENTA
      (det.taxableSubTotal - det.totalCost) AS profit -- UTILIDAD
    FROM
      vw_sales head
      INNER JOIN vw_saledetails det ON head.id = det.saleId
    WHERE
      head.locationId = ?
      AND date_format(head.docDatetime, '%Y-%m-%d') BETWEEN ? AND ?
    ORDER BY
      head.docDatetime;
  `,
  getPendingSales: `
    SELECT customerId, customerCode, customerFullname, businessName FROM vw_pendingsalecustomers vp;
    SELECT
      customerId,
      saleId,
      docDatetimeFormatted,
      documentTypeName,
      docNumber,
      saleTotal,
      saleTotalPaid,
      salePendingAmount,
      IF (expired = 0, salePendingAmount, IF (expired = 1 AND ABS(expiresIn) BETWEEN 0 AND 29, salePendingAmount, 0)) AS currentDebt,
      IF (expired = 1 AND ABS(expiresIn) BETWEEN 30 AND 60, salePendingAmount, 0) AS debt30,
      IF (expired = 1 AND ABS(expiresIn) BETWEEN 61 AND 90, salePendingAmount, 0) AS debt60,
      IF (expired = 1 AND ABS(expiresIn) > 90, salePendingAmount, 0) AS debt90
    FROM
      vw_customerpendingsales vc; 
  `,
  getPendingProductPurchases: `
    SELECT supplierId, supplierName FROM vw_pendingproductpurchasesuppliers vp;
    SELECT
      supplierId,
      productPurchaseId ,
      documentDatetimeFormatted,
      documentTypeName,
      documentNumber,
      productPurchaseTotal,
      productPurchaseTotalPaid,
      productPurchasePendingAmount,
      IF (expired = 0, productPurchasePendingAmount, IF (expired = 1 AND ABS(expiresIn) BETWEEN 0 AND 29, productPurchasePendingAmount, 0)) AS currentDebt,
      IF (expired = 1 AND ABS(expiresIn) BETWEEN 30 AND 60, productPurchasePendingAmount, 0) AS debt30,
      IF (expired = 1 AND ABS(expiresIn) BETWEEN 61 AND 90, productPurchasePendingAmount, 0) AS debt60,
      IF (expired = 1 AND ABS(expiresIn) > 90, productPurchasePendingAmount, 0) AS debt90
    FROM
      vw_supplierpendingproductpurchases vc; 
  `
}

controller.testquery = (req, res) => {
  const { data } = req.body;
  req.getConnection(
    connUtil.connFunc(
      `SELECT * FROM testtable WHERE id = @param AND name = @param;`, 
      [
        data.id,
        data.name
      ], 
      res
    )
  );
}

controller.kardexByProduct = (req, res) => {
  const { locationId, productId, startDate, endDate } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.kardexByProduct, 
      [
        locationId || 0, productId || 0, startDate, endDate, 
        locationId || 0, productId || 0, startDate, endDate
      ], 
      res
    )
  );
}

controller.calculatedKardexByProduct = (req, res) => {
  const { locationId, productId, startDate, endDate } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.calculatedKardexByProduct, 
      [ locationId, productId, locationId, productId, locationId, productId, locationId, productId, locationId, productId ], 
      res
    )
  );
}

controller.getProfitReportByLocationDateRange = (req, res) => {
  const { locationId, startDate, endDate } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getProfitReportByLocationDateRange, 
      [ locationId, locationId, startDate, endDate ], 
      res,
      1
    )
  );
}

controller.createNewPdf = (req, res) => {
  try {
    renders.generateNewPdf();
    res.json({ status: 200, message: 'success' });
  } catch(error) {
    res.json({ status: 400, message: 'error' });
  }
}

controller.createNewPdfAlt = (req, res) => {
  try {
    rendersAlt.generateNewPdf();
    res.json({ status: 200, message: 'success' });
  } catch(error) {
    console.log(error);
    res.json({ status: 400, message: 'error' });
  }
}

controller.getPdf = (req, res) => {
  try {
    const file = fs.createReadStream(process.cwd() + '/src/pdfs/newpdfalt.pdf');
    const stat = fs.statSync(process.cwd() + '/src/pdfs/newpdfalt.pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=quote.pdf');
    file.pipe(res);
  } catch(error) {
    console.log(error);
    res.json({ status: 400, message: 'error' });
  }
}

controller.getGeneralInventory = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      conn.query(
        queries.getGeneralInventory,
        [],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const resultData = result;

              const printer = new PdfPrinter(fonts);
          
              const bodyData = [];
              bodyData.push([
                'CODIGO',
                'NOMBRE',
                { text: 'EXISTENCIAS', bold: false, alignment: 'right' },
                { text: 'CONTENIDO', bold: false, alignment: 'right' },
                { text: 'GENERAL', bold: false, alignment: 'right' },
                { text: 'COSTO UNI.', bold: false, alignment: 'right' },
                { text: 'VALOR TOTAL', bold: true, alignment: 'right' }
              ]);

              let repTotalValue = 0;
              let repTotalTaxValue = 0;
              let repGranTotalValue = 0;
              for(const item of (resultData || [])) {
                repTotalValue += +item?.totalStockCost;
                repTotalTaxValue += +item?.totalStockTotalTaxes;
                repGranTotalValue += +item?.totalStockTotalCost;

                bodyData.push([
                  { text: item?.productId || '', bold: false, alignment: 'left' },
                  { text: item?.productName || '', bold: false, alignment: 'left' },
                  { text: item?.totalStock || 0, bold: false, alignment: 'right' },
                  { text: item?.packageContent || 0, bold: false, alignment: 'right' },
                  { text: ((+item?.totalStock || 0) / (+item?.packageContent || 0)).toFixed(2), bold: false, alignment: 'right' },
                  { text: item?.productCost || 0, bold: false, alignment: 'right' },
                  { text: (+item?.totalStockCost).toFixed(2), bold: true, alignment: 'right' }
                ]);
              }

              bodyData.push([
                { text: '', bold: false, alignment: 'left' },
                { text: 'VALOR TOTAL SIN IVA', bold: true, alignment: 'left' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: (+repTotalValue).toFixed(2), bold: true, alignment: 'right' }
              ]);

              bodyData.push([
                { text: '', bold: false, alignment: 'left' },
                { text: 'IVA (13%)', bold: true, alignment: 'left' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: (+repTotalTaxValue).toFixed(2), bold: true, alignment: 'right' }
              ]);

              bodyData.push([
                { text: '', bold: false, alignment: 'left' },
                { text: 'GRAN TOTAL', bold: true, alignment: 'left' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: '-', bold: false, alignment: 'right' },
                { text: (+repGranTotalValue).toFixed(2), bold: true, alignment: 'right' }
              ]);
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'Reporte Valor Monetario Inventario General', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: 'Puma Santa Rosa', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 7
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=bycategories.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getGeneralInventoryStock = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      conn.query(
        queries.getGeneralInventoryStock,
        [],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const resultData = result;

              

              const printer = new PdfPrinter(fonts);
          
              const bodyData = [];
              bodyData.push([
                'SUCURSAL',
                'CODIGO',
                'NOMBRE',
                { text: 'EXISTENCIAS', bold: false, alignment: 'right' },
                { text: 'CONTENIDO', bold: false, alignment: 'right' },
                { text: 'GENERAL', bold: false, alignment: 'right' },
              ]);

              for(const item of (resultData || [])) {

                bodyData.push([
                  { text: item?.locationName || '', bold: false, alignment: 'left' },
                  { text: item?.productId || '', bold: false, alignment: 'left' },
                  { text: item?.productName || '', bold: false, alignment: 'left' },
                  { text: item?.stock || 0, bold: false, alignment: 'right' },
                  { text: item?.packageContent || 0, bold: false, alignment: 'right' },
                  { text: ((+item?.stock || 0) / (+item?.packageContent || 0)).toFixed(2), bold: false, alignment: 'right' },
                ]);
              }
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'Reporte Inventario General', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: 'Centro de Llantas', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['20%', '10%', '45%', '10%', '10%', '15%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 7
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=bycategories.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getLocationProductsByCategory = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId } = req.params;

      conn.query(
        queries.getLocationProductsByCategory,
        [ locationId ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const categoriesData = result[0];
              const productsData = result[1];

              

              const printer = new PdfPrinter(fonts);
          
              const bodyData = [];
              bodyData.push(['CODIGO', 'NOMBRE', 'EXISTENCIAS', 'CONTENIDO', 'GENERAL', 'COSTO', 'VALOR']);
          
              for(const category of (categoriesData || [])) {
                bodyData.push([
                  '',
                  { text: category?.name || '', bold: true, decoration: 'underline' },
                  '',
                  '',
                  '',
                  '',
                  ''
                ]);
                for(const product of (productsData || []).filter(x => x.productCategoryId === category.id)) {
                  bodyData.push([
                    product?.productId || 0,
                    product?.productName || '',
                    product?.currentLocationStock || 0,
                    product?.packageContent || 0,
                    ((+product?.currentLocationStock || 0) / (+product?.packageContent || 0)).toFixed(2),
                    product?.productCost || 0,
                    ((+product?.currentLocationStock || 0) * (+product?.productCost || 0)).toFixed(2)
                  ]);
                }
              }
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=bycategories.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getLocationProductsByBrand = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId } = req.params;

      conn.query(
        queries.getLocationProductsByBrand,
        [ locationId ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const brandsData = result[0];
              const productsData = result[1];

              const fonts = {
                // Roboto: {
                //   normal: process.cwd() + '/src/fonts/Roboto-Regular.ttf',
                //   bold: process.cwd() + '/src/fonts/Roboto-Medium.ttf',
                //   italics: process.cwd() + '/src/fonts/Roboto-Italic.ttf',
                //   bolditalics: process.cwd() + '/src/fonts/Roboto-MediumItalic.ttf'
                // },
                Roboto: {
                  normal: path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
                  bold: path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
                  italics: path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
                  bolditalics: path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
                }
              };

              const printer = new PdfPrinter(fonts);
          
              const bodyData = [];
              bodyData.push(['CODIGO', 'NOMBRE', 'EXISTENCIAS', 'CONTENIDO', 'GENERAL', 'COSTO', 'VALOR']);
          
              for(const brand of (brandsData || [])) {
                bodyData.push([
                  '',
                  { text: brand?.name || '', bold: true, decoration: 'underline' },
                  '',
                  '',
                  '',
                  '',
                  ''
                ]);
                for(const product of (productsData || []).filter(x => x.productBrandId === brand.id)) {
                  bodyData.push([
                    product?.productId || 0,
                    product?.productName || '',
                    product?.currentLocationStock || 0,
                    product?.packageContent || 0,
                    ((+product?.currentLocationStock || 0) / (+product?.packageContent || 0)).toFixed(2),
                    product?.productCost || 0,
                    ((+product?.currentLocationStock || 0) * (+product?.productCost || 0)).toFixed(2)
                  ]);
                }
              }
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'Reporte de Productos por Marca', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=bycategories.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getLocationProductsByFilteredData = (req, res) => {
  try {
    const { productsData } = req.body;

    const fonts = {
      Roboto: {
        normal: path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
        bold: path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
        italics: path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
        bolditalics: path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
      }
    };

    const printer = new PdfPrinter(fonts);

    const bodyData = [];
    bodyData.push(['CODIGO', 'NOMBRE', 'EXISTENCIAS', 'CONTENIDO', 'GENERAL', 'COSTO', 'VALOR']);

    for(const product of (productsData || [])) {
      bodyData.push([
        product?.productId || 0,
        product?.productName || '',
        product?.currentLocationStock || 0,
        product?.packageContent || 0,
        ((+product?.currentLocationStock || 0) / (+product?.packageContent || 0)).toFixed(2),
        product?.productCost || 0,
        ((+product?.currentLocationStock || 0) * (+product?.productCost || 0)).toFixed(2)
      ]);
    }

    const docDefinition = {
      header: function(currentPage, pageCount, pageSize) {
        // Podemos tener hasta cuatro líneas de encabezado de página
        return [
          { text: 'Reporte de Productos (Filtro Personalizado)', alignment: 'left', margin: [40, 30, 40, 0] },
          { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
          // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
          // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
        ]
      },
      footer: function(currentPage, pageCount) {
        // Podemos tener hasta cuatro líneas de pie de página
        return [
          { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
          { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
          // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
          // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
        ]
      },
      content: [
        {
          layout: 'headerLineOnly', // optional
          table: {
            // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
            // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
            headerRows: 1,
            widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
            body: bodyData
          }
        }
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 6
      },
      pageSize: 'LETTER',
      pageMargins: [ 40, 60, 40, 60 ]
    };
    
    const options = {};

    const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=bycustomfilter.pdf');

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch(error) {
    res.json({ status: 400, message: 'error', errorContent: error });
  }
}

controller.shiftcutSettlement = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { shiftcutId } = req.params;

      conn.query(
        queries.shiftcutSettlement,
        [
          shiftcutId,
          shiftcutId,
          shiftcutId,
          shiftcutId,
          shiftcutId,
          shiftcutId
        ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {

              const shiftcutData = result[0];
              const salesReportData = result[1];
              const summaryData = result[3];
              const paymentsData = result[5];
              const movementsData = result[7];
              const gasStationSummary = result[9];

              const printer = new PdfPrinter(fonts);
          
              const summaryBodyData = [];
              summaryBodyData.push(['CONCEPTO', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);
          
              const gasStaionSummaryBodyData = [];
              gasStaionSummaryBodyData.push([
                'DESCRIPCION',
                { text: 'CANTIDAD', bold: false, alignment: 'right' },
                { text: 'PREC. UNI.', bold: false, alignment: 'right' },
                { text: 'VENTA TOTAL', bold: false, alignment: 'right' },
                { text: 'IVA', bold: false, alignment: 'right' },
                { text: 'FOVIAL', bold: false, alignment: 'right' },
                { text: 'COTRANS', bold: false, alignment: 'right' }
              ]);

              const salesReportBodyData = [];
              salesReportBodyData.push(['DOCUMENTO', 'TIPO', 'CLIENTE', 'DESCRIPCIÓN', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              const paymentsBodyData = [];
              paymentsBodyData.push(['REGISTRADO POR', 'DOCUMENTO', 'CLIENTE', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              const movementsBodyData = [];
              movementsBodyData.push([
                'OPERACION',
                'POR',
                'RAZON',
                { text: 'ANTERIOR' || '', bold: false, alignment: 'right' },
                { text: 'MONTO' || '', bold: false, alignment: 'right' },
                { text: 'SALDO' || '', bold: false, alignment: 'right' }
              ]);

              for(const gasStationSummaryItem of (gasStationSummary || [])) {
                gasStaionSummaryBodyData.push([
                  { text: gasStationSummaryItem?.productName || '', bold: false, background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.totalQuantity).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.unitPrice).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.totalSale).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.totalIva).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.totalFovial).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' },
                  { text: Number(gasStationSummaryItem?.totalCotrans).toFixed(4) || '', bold: false, alignment: 'right', background: gasStationSummaryItem?.productCode === '' ? '#f0f5ff' : gasStationSummaryItem?.productCode === 'TGENERAL' ? '#d9f7be' : '#ffffff' }
                ]);
              }
              
              let saleReportTotalSaleAmount = 0;
              let saleDetailText = '';
              for(const sale of (salesReportData || [])) {
                if (sale?.productQuantity !== null && sale?.productUnitPrice) {
                  saleDetailText = `(${Number(sale?.productQuantity).toFixed(0)} x ${sale?.productUnitPrice})`;
                } else {
                  saleDetailText = '';
                }

                if (sale.saleId === null) {
                  saleReportTotalSaleAmount += +sale?.totalSale;
                }
                salesReportBodyData.push([
                  { text: sale?.document || '', bold: false },
                  { text: sale?.paymentTypeName || '', bold: false },
                  { text: sale?.customerFullname || '', bold: false },
                  { text: `${sale?.productName} ${saleDetailText}` || '', bold: false },
                  { text: sale?.totalSale || '', bold: false, alignment: 'right' }
                ]);
              }

              salesReportBodyData.push([
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: 'TOTAL GENERAL', bold: false },
                { text: Number(saleReportTotalSaleAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              ]);

              for(const concept of (summaryData || [])) {
                summaryBodyData.push([
                  { text: concept?.movementType || '', bold: false },
                  { text: Number(concept?.totalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                ]);
              }

              for(const payment of (paymentsData || [])) {
                paymentsBodyData.push([
                  { text: payment?.registeredByFullname || '', bold: false },
                  { text: payment?.document || '', bold: false },
                  { text: payment?.customerFullname || '', bold: false },
                  { text: Number(payment?.totalPaid).toFixed(2) || '', bold: false, alignment: 'right' }
                ]);
              }

              for(const movement of (movementsData || [])) {
                movementsBodyData.push([
                  { text: movement?.movementTypeName || '', bold: false },
                  { text: movement?.userPINCodeFullname || '', bold: false },
                  { text: movement?.comments || '', bold: false },
                  { text: Number(movement?.prevAmount).toFixed(2) || '', bold: false, alignment: 'right' },
                  { text: Number(movement?.amount).toFixed(2) || '', bold: false, alignment: 'right' },
                  { text: Number(movement?.newAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                ]);
              }
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'Reporte de Cierre de Caja', fontSize: 16, alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  { text: 'Información de cierre', fontSize: 13 },
                  { text: `${shiftcutData[0]?.cashierName} - Turno #${shiftcutData[0]?.shiftcutNumber}` },
                  { text: `Apertura`, bold: true },
                  { text: `${shiftcutData[0]?.openedAt} por ${shiftcutData[0]?.openedByFullname}` },
                  { text: `Cierre`, bold: true },
                  { text: `${shiftcutData[0]?.closedAt} por ${shiftcutData[0]?.closedByFullname}` },
                  { text: '-', fontSize: 13 },
                  { text: 'Resumen de caja', fontSize: 13 },
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['25%', '25%'],
                      body: [
                        ...summaryBodyData,
                        [
                          { text: 'Caja Chica Final', bold: false },
                          { text: Number(shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                        ],
                        [
                          { text: 'Efectivo Total Final', bold: false },
                          { text: Number(shiftcutData[0]?.finalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                        ],
                        [
                          { text: 'Efectivo a entregar', bold: false },
                          { text: Number(+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                        ],
                        [
                          { text: 'Efectivo entregado', bold: false },
                          { text: Number(shiftcutData[0]?.remittedAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                        ],
                        [
                          { text: 'Diferencia', bold: false },
                          { text: Number(+shiftcutData[0]?.remittedAmount - (+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds)).toFixed(2) || '', bold: false, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  (shiftcutData[0]?.productDistributionsId === 2) ? { text: '-', fontSize: 13 } : { text: '', fontSize: 13 },
                  (shiftcutData[0]?.productDistributionsId === 2) ? { text: 'Resumen de Pista', fontSize: 13 } : { text: '', fontSize: 13 },
                  (shiftcutData[0]?.productDistributionsId === 2) ? {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['40%', '10%', '10%', '10%', '10%', '10%', '10%'],
                      body: gasStaionSummaryBodyData
                    }
                  } : { text: '', fontSize: 13 },
                  { text: '-', fontSize: 13 },
                  { text: 'Resumen de ventas', fontSize: 13 },
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['10%', '10%', '30%', '40%', '10%'],
                      body: salesReportBodyData
                    }
                  },
                  { text: '-', fontSize: 13 },
                  { text: 'Resumen de abonos', fontSize: 13 },
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['20%', '20%', '40%', '20%'],
                      body: paymentsBodyData
                    }
                  },
                  { text: '-', fontSize: 13 },
                  { text: 'Movimientos de Caja Chica', fontSize: 13 },
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                      // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                      headerRows: 1,
                      widths: ['10%', '20%', '40%', '10%', '10%', '10%'],
                      body: movementsBodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=shiftcutsettlement.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.shiftcutXSettlement = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { shiftcutId } = req.params;

      conn.query(
        queries.shiftcutXSettlement,
        [ shiftcutId, shiftcutId ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const shiftcutData = result[0];

              const {
                locationOwnerTradename,
                locationOwnerName,
                locationOwnerActivityCode,
                locationOwnerActivityDescription,
                locationOwnerNit,
                locationOwnerNrc,
                shiftcutDatetime,
                shiftcutDatetimeFormatted,
                openedByFullname,
                closedByFullname,
                cashierName,
                shiftcutNumber
              } = shiftcutData[0];

              const ticketsXData = result[1];

              const {
                label: ticketLabel,
                numberOfTransactions: ticketNumberOfTransactions,
                initialDocNumber: ticketInitialDocNumber,
                finalDocNumber: ticketFinalDocNumber,
                taxableTotal: ticketTaxableTotal,
                noTaxableTotal: ticketNoTaxableTotal,
                noSubjectTotal: ticketNoSubjectTotal,
                total: ticketTotal
              } = ticketsXData[0];

              const cfXData = result[2];

              const {
                label: cfLabel,
                numberOfTransactions: cfNumberOfTransactions,
                initialDocNumber: cfInitialDocNumber,
                finalDocNumber: cfFinalDocNumber,
                taxableTotal: cfTaxableTotal,
                noTaxableTotal: cfNoTaxableTotal,
                noSubjectTotal: cfNoSubjectTotal,
                total: cfTotal
              } = cfXData[0];

              const ccfXData = result[3];

              const {
                label: ccfLabel,
                numberOfTransactions: ccfNumberOfTransactions,
                initialDocNumber: ccfInitialDocNumber,
                finalDocNumber: ccfFinalDocNumber,
                taxableTotal: ccfTaxableTotal,
                noTaxableTotal: ccfNoTaxableTotal,
                noSubjectTotal: ccfNoSubjectTotal,
                total: ccfTotal
              } = ccfXData[0];

              const printer = new PdfPrinter(fonts);
          
              // const summaryBodyData = [];
              // summaryBodyData.push(['CONCEPTO', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);
          
              // const salesReportBodyData = [];
              // salesReportBodyData.push(['DOCUMENTO', 'TIPO', 'CLIENTE', 'DESCRIPCIÓN', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              // const paymentsBodyData = [];
              // paymentsBodyData.push(['REGISTRADO POR', 'DOCUMENTO', 'CLIENTE', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              // const movementsBodyData = [];
              // movementsBodyData.push([
              //   'OPERACION',
              //   'POR',
              //   'RAZON',
              //   { text: 'ANTERIOR' || '', bold: false, alignment: 'right' },
              //   { text: 'MONTO' || '', bold: false, alignment: 'right' },
              //   { text: 'SALDO' || '', bold: false, alignment: 'right' }
              // ]);
              
              // let saleReportTotalSaleAmount = 0;
              // for(const sale of (salesReportData || [])) {
              //   if (sale.saleId === null) {
              //     saleReportTotalSaleAmount += +sale?.totalSale;
              //   }
              //   salesReportBodyData.push([
              //     { text: sale?.document || '', bold: false },
              //     { text: sale?.paymentTypeName || '', bold: false },
              //     { text: sale?.customerFullname || '', bold: false },
              //     { text: sale?.productName || '', bold: false },
              //     { text: sale?.totalSale || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // salesReportBodyData.push([
              //   { text: '', bold: false },
              //   { text: '', bold: false },
              //   { text: '', bold: false },
              //   { text: 'TOTAL GENERAL', bold: false },
              //   { text: Number(saleReportTotalSaleAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              // ]);

              // for(const concept of (summaryData || [])) {
              //   summaryBodyData.push([
              //     { text: concept?.movementType || '', bold: false },
              //     { text: Number(concept?.totalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // for(const payment of (paymentsData || [])) {
              //   paymentsBodyData.push([
              //     { text: payment?.registeredByFullname || '', bold: false },
              //     { text: payment?.document || '', bold: false },
              //     { text: payment?.customerFullname || '', bold: false },
              //     { text: Number(payment?.totalPaid).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // for(const movement of (movementsData || [])) {
              //   movementsBodyData.push([
              //     { text: movement?.movementTypeName || '', bold: false },
              //     { text: movement?.userPINCodeFullname || '', bold: false },
              //     { text: movement?.comments || '', bold: false },
              //     { text: Number(movement?.prevAmount).toFixed(2) || '', bold: false, alignment: 'right' },
              //     { text: Number(movement?.amount).toFixed(2) || '', bold: false, alignment: 'right' },
              //     { text: Number(movement?.newAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }
          
              const docDefinition = {
                // header: function(currentPage, pageCount, pageSize) {
                //   // Podemos tener hasta cuatro líneas de encabezado de página
                //   return [
                //     { text: 'Reporte de Cierre de Caja', fontSize: 16, alignment: 'left', margin: [40, 30, 40, 0] },
                //     { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                //     // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                //     // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                //   ]
                // },
                // footer: function(currentPage, pageCount) {
                //   // Podemos tener hasta cuatro líneas de pie de página
                //   return [
                //     { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //   ]
                // },
                content: [
                  { text: `${locationOwnerTradename}`, fontSize: 11, alignment: 'center' },
                  { text: `${locationOwnerName}`, fontSize: 9, alignment: 'center' },
                  { text: `${locationOwnerActivityDescription}`, fontSize: 9, alignment: 'center' },
                  {
                    layout: 'noBorders',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: 'NIT:', bold: false, fontSize: 9 },
                          { text: `${locationOwnerNit}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'NRC:', bold: false, fontSize: 9 },
                          { text: `${locationOwnerNrc}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Caja:', bold: false, fontSize: 9 },
                          { text: `${cashierName}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Turno:', bold: false, fontSize: 9 },
                          { text: `${shiftcutNumber}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Fecha:', bold: false, fontSize: 9 },
                          { text: `${shiftcutDatetimeFormatted}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Apertura:', bold: false, fontSize: 9 },
                          { text: `${openedByFullname}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Cierre:', bold: false, fontSize: 9 },
                          { text: `${closedByFullname}`, bold: false, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  { text: `TOTAL X`, fontSize: 11, alignment: 'center' },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${ticketLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${ticketTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${ticketNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${ticketNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${ticketTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${cfLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${cfTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${cfNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${cfNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${cfTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${ccfLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${ccfTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${ccfNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${ccfNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${ccfTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: 'TOTAL VENTAS:', bold: false, fontSize: 11 },
                          { text: `$${+ticketTotal + +cfTotal + +ccfTotal}`, bold: false, fontSize: 11, alignment: 'right' }
                        ],
                        [
                          { text: 'Transacciones:', bold: false, fontSize: 9 },
                          { text: `${+ticketNumberOfTransactions + +cfNumberOfTransactions + +ccfNumberOfTransactions}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${ticketLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+ticketNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${ticketInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${ticketFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${cfLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+cfNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${cfInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${cfFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${ccfLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+ccfNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${ccfInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${ccfFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['25%', '25%'],
                  //     body: [
                  //       ...summaryBodyData,
                  //       [
                  //         { text: 'Caja Chica Final', bold: false },
                  //         { text: Number(shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo Total Final', bold: false },
                  //         { text: Number(shiftcutData[0]?.finalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo a entregar', bold: false },
                  //         { text: Number(+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo entregado', bold: false },
                  //         { text: Number(shiftcutData[0]?.remittedAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Diferencia', bold: false },
                  //         { text: Number(+shiftcutData[0]?.remittedAmount - (+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds)).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ]
                  //     ]
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Resumen de ventas', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['10%', '10%', '30%', '40%', '10%'],
                  //     body: salesReportBodyData
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Resumen de abonos', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['20%', '20%', '40%', '20%'],
                  //     body: paymentsBodyData
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Movimientos de Caja Chica', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['10%', '20%', '40%', '10%', '10%', '10%'],
                  //     body: movementsBodyData
                  //   }
                  // }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'A7',
                pageMargins: [ 5, 5, 5, 5 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=shiftcutsettlement.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.shiftcutZSettlement = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { shiftcutDay, initShiftcutId, finalShiftcutId } = req.params;

      conn.query(
        queries.shiftcutZSettlement,
        [ shiftcutDay, shiftcutDay, initShiftcutId, finalShiftcutId ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const shiftcutData = result[0];

              const {
                locationId,
                locationName,
                cashierId,
                cashierName,
                locationOwnerTradename,
                locationOwnerName,
                locationOwnerActivityCode,
                locationOwnerActivityDescription,
                locationOwnerNit,
                locationOwnerNrc,
                shiftcutDatetime,
                shiftcutDate,
                openedByFullname,
                closedByFullname,
                prevShiftcutNumber,
                lastShiftcutNumber,
                prevShiftcutId,
                lastShiftcutId
              } = shiftcutData[0];

              const ticketsZData = result[1];

              const {
                label: ticketLabel,
                numberOfTransactions: ticketNumberOfTransactions,
                initialDocNumber: ticketInitialDocNumber,
                finalDocNumber: ticketFinalDocNumber,
                taxableTotal: ticketTaxableTotal,
                noTaxableTotal: ticketNoTaxableTotal,
                noSubjectTotal: ticketNoSubjectTotal,
                total: ticketTotal
              } = ticketsZData[0];

              const cfZData = result[2];

              const {
                label: cfLabel,
                numberOfTransactions: cfNumberOfTransactions,
                initialDocNumber: cfInitialDocNumber,
                finalDocNumber: cfFinalDocNumber,
                taxableTotal: cfTaxableTotal,
                noTaxableTotal: cfNoTaxableTotal,
                noSubjectTotal: cfNoSubjectTotal,
                total: cfTotal
              } = cfZData[0];

              const ccfZData = result[3];

              const {
                label: ccfLabel,
                numberOfTransactions: ccfNumberOfTransactions,
                initialDocNumber: ccfInitialDocNumber,
                finalDocNumber: ccfFinalDocNumber,
                taxableTotal: ccfTaxableTotal,
                noTaxableTotal: ccfNoTaxableTotal,
                noSubjectTotal: ccfNoSubjectTotal,
                total: ccfTotal
              } = ccfZData[0];

              const printer = new PdfPrinter(fonts);
          
              // const summaryBodyData = [];
              // summaryBodyData.push(['CONCEPTO', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);
          
              // const salesReportBodyData = [];
              // salesReportBodyData.push(['DOCUMENTO', 'TIPO', 'CLIENTE', 'DESCRIPCIÓN', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              // const paymentsBodyData = [];
              // paymentsBodyData.push(['REGISTRADO POR', 'DOCUMENTO', 'CLIENTE', { text: 'MONTO' || '', bold: false, alignment: 'right' }]);

              // const movementsBodyData = [];
              // movementsBodyData.push([
              //   'OPERACION',
              //   'POR',
              //   'RAZON',
              //   { text: 'ANTERIOR' || '', bold: false, alignment: 'right' },
              //   { text: 'MONTO' || '', bold: false, alignment: 'right' },
              //   { text: 'SALDO' || '', bold: false, alignment: 'right' }
              // ]);
              
              // let saleReportTotalSaleAmount = 0;
              // for(const sale of (salesReportData || [])) {
              //   if (sale.saleId === null) {
              //     saleReportTotalSaleAmount += +sale?.totalSale;
              //   }
              //   salesReportBodyData.push([
              //     { text: sale?.document || '', bold: false },
              //     { text: sale?.paymentTypeName || '', bold: false },
              //     { text: sale?.customerFullname || '', bold: false },
              //     { text: sale?.productName || '', bold: false },
              //     { text: sale?.totalSale || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // salesReportBodyData.push([
              //   { text: '', bold: false },
              //   { text: '', bold: false },
              //   { text: '', bold: false },
              //   { text: 'TOTAL GENERAL', bold: false },
              //   { text: Number(saleReportTotalSaleAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              // ]);

              // for(const concept of (summaryData || [])) {
              //   summaryBodyData.push([
              //     { text: concept?.movementType || '', bold: false },
              //     { text: Number(concept?.totalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // for(const payment of (paymentsData || [])) {
              //   paymentsBodyData.push([
              //     { text: payment?.registeredByFullname || '', bold: false },
              //     { text: payment?.document || '', bold: false },
              //     { text: payment?.customerFullname || '', bold: false },
              //     { text: Number(payment?.totalPaid).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }

              // for(const movement of (movementsData || [])) {
              //   movementsBodyData.push([
              //     { text: movement?.movementTypeName || '', bold: false },
              //     { text: movement?.userPINCodeFullname || '', bold: false },
              //     { text: movement?.comments || '', bold: false },
              //     { text: Number(movement?.prevAmount).toFixed(2) || '', bold: false, alignment: 'right' },
              //     { text: Number(movement?.amount).toFixed(2) || '', bold: false, alignment: 'right' },
              //     { text: Number(movement?.newAmount).toFixed(2) || '', bold: false, alignment: 'right' }
              //   ]);
              // }
          
              const docDefinition = {
                // header: function(currentPage, pageCount, pageSize) {
                //   // Podemos tener hasta cuatro líneas de encabezado de página
                //   return [
                //     { text: 'Reporte de Cierre de Caja', fontSize: 16, alignment: 'left', margin: [40, 30, 40, 0] },
                //     { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                //     // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                //     // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                //   ]
                // },
                // footer: function(currentPage, pageCount) {
                //   // Podemos tener hasta cuatro líneas de pie de página
                //   return [
                //     { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //   ]
                // },
                content: [
                  { text: `${locationOwnerTradename}`, fontSize: 11, alignment: 'center' },
                  { text: `${locationOwnerName}`, fontSize: 9, alignment: 'center' },
                  { text: `${locationOwnerActivityDescription}`, fontSize: 9, alignment: 'center' },
                  {
                    layout: 'noBorders',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: 'NIT:', bold: false, fontSize: 9 },
                          { text: `${locationOwnerNit}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'NRC:', bold: false, fontSize: 9 },
                          { text: `${locationOwnerNrc}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Caja:', bold: false, fontSize: 9 },
                          { text: `${cashierName}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Turno inicial:', bold: false, fontSize: 9 },
                          { text: `${prevShiftcutNumber || 0}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Turno final:', bold: false, fontSize: 9 },
                          { text: `${lastShiftcutNumber || 0}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Fecha:', bold: false, fontSize: 9 },
                          { text: `${shiftcutDate}`, bold: false, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  { text: `TOTAL Z`, fontSize: 11, alignment: 'center' },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${ticketLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${ticketTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${ticketNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${ticketNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${ticketTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${cfLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${cfTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${cfNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${cfNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${cfTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: `${ccfLabel}`, bold: true, fontSize: 9 },
                          { text: '', bold: false, fontSize: 9 },
                        ],
                        [
                          { text: 'Venta Gravada:', bold: false, fontSize: 9 },
                          { text: `$${ccfTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta Exenta:', bold: false, fontSize: 9 },
                          { text: `$${ccfNoTaxableTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Venta No Sujeta:', bold: false, fontSize: 9 },
                          { text: `$${ccfNoSubjectTotal}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: 'Total:', bold: true, fontSize: 9 },
                          { text: `$${ccfTotal}`, bold: true, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [
                          { text: 'TOTAL VENTAS:', bold: false, fontSize: 11 },
                          { text: `$${+ticketTotal + +cfTotal + +ccfTotal}`, bold: false, fontSize: 11, alignment: 'right' }
                        ],
                        [
                          { text: 'Transacciones:', bold: false, fontSize: 9 },
                          { text: `${+ticketNumberOfTransactions + +cfNumberOfTransactions + +ccfNumberOfTransactions}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${ticketLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+ticketNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${ticketInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${ticketFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${cfLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+cfNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${cfInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${cfFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `${ccfLabel}:`, bold: true, fontSize: 9 },
                          { text: `${+ccfNumberOfTransactions}`, bold: true, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Inicial`, bold: false, fontSize: 9 },
                          { text: `${ccfInitialDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ],
                        [
                          { text: `Final`, bold: false, fontSize: 9 },
                          { text: `${ccfFinalDocNumber || '-'}`, bold: false, fontSize: 9, alignment: 'right' }
                        ]
                      ]
                    }
                  },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['25%', '25%'],
                  //     body: [
                  //       ...summaryBodyData,
                  //       [
                  //         { text: 'Caja Chica Final', bold: false },
                  //         { text: Number(shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo Total Final', bold: false },
                  //         { text: Number(shiftcutData[0]?.finalAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo a entregar', bold: false },
                  //         { text: Number(+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Efectivo entregado', bold: false },
                  //         { text: Number(shiftcutData[0]?.remittedAmount).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ],
                  //       [
                  //         { text: 'Diferencia', bold: false },
                  //         { text: Number(+shiftcutData[0]?.remittedAmount - (+shiftcutData[0]?.finalAmount - +shiftcutData[0]?.initialAmount - +shiftcutData[0]?.cashFunds)).toFixed(2) || '', bold: false, alignment: 'right' }
                  //       ]
                  //     ]
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Resumen de ventas', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['10%', '10%', '30%', '40%', '10%'],
                  //     body: salesReportBodyData
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Resumen de abonos', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['20%', '20%', '40%', '20%'],
                  //     body: paymentsBodyData
                  //   }
                  // },
                  // { text: '-', fontSize: 13 },
                  // { text: 'Movimientos de Caja Chica', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     // Los encabezados se muestran automáticamente en todas las páginas en las que se extienda la tabla
                  //     // Puedes definir el número de filas que serán tratadas como encabezados de la tabla
                  //     headerRows: 1,
                  //     widths: ['10%', '20%', '40%', '10%', '10%', '10%'],
                  //     body: movementsBodyData
                  //   }
                  // }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'A7',
                pageMargins: [ 5, 5, 5, 5 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=shiftcutsettlement.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getMainDashboardData = (req, res) => {
  const { startDate, endDate } = req.params;
  req.getConnection(connUtil.connFunc(queries.getMainDashboardData, [ startDate || '2024-01-01', endDate || '2024-01-01' ], res));
}

controller.getCashierLocationSalesByMonth = (req, res) => {
  const { locationId, cashierId, documentTypeId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getCashierLocationSalesByMonth, 
      [ locationId || 0, cashierId || 0, documentTypeId || 0, month ], 
      res
    )
  );
}

controller.getMonthlyFinalConsumerSaleBook = (req, res) => {
  const { locationId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getMonthlyFinalConsumerSaleBook, 
      [ locationId || 0, month || '2000-01', locationId || 0, month || '2000-01' ], 
      res
    )
  );
}

controller.getDteMonthlyFinalConsumerSaleBook = (req, res) => {
  const { locationId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getDteMonthlyFinalConsumerSaleBook, 
      [ locationId || 0, month || '2000-01' ], 
      res
    )
  );
}

controller.getMonthlyTaxPayerSaleBook = (req, res) => {
  const { locationId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getMonthlyTaxPayerSaleBook, 
      [ locationId || 0, month || '2000-01', locationId || 0, month || '2000-01' ], 
      res
    )
  );
}

controller.getDteMonthlyTaxPayerSaleBook = (req, res) => {
  const { locationId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getDteMonthlyTaxPayerSaleBook, 
      [ locationId || 0, month || '2000-01' ], 
      res
    )
  );
}

controller.getMonthlyPurchasesBook = (req, res) => {
  const { locationId, month } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.getMonthlyPurchasesBook, 
      [ locationId || 0, month || '2000-01', locationId || 0, month || '2000-01' ], 
      res
    )
  );
}

controller.getMonthlyFinalConsumerSaleBookPDF = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId, month } = req.params;

      conn.query(
        queries.getMonthlyFinalConsumerSaleBook,
        [ locationId || 0, month || '2000-01' ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              

              const printer = new PdfPrinter(fonts);

              const getDataSumByProperty = (propertyName) => {
                let total = 0;
                for (const value of result) {
                  total += +(value?.[propertyName] || 0)
                }
                return total.toFixed(2);
              }

              const tableData = [];

              tableData.push([
                { text: 'DIA' || '', bold: false, alignment: 'left' },
                { text: 'DEL No' || '', bold: false, alignment: 'left' },
                { text: 'AL No' || '', bold: false, alignment: 'left' },
                { text: 'No CAJA O SISTEMAS COMPUTARIZADO' || '', bold: false, alignment: 'left' },
                { text: 'EXENTAS' || '', bold: false, alignment: 'right' },
                { text: 'GRAVADAS' || '', bold: false, alignment: 'right' },
                { text: 'EXPORTACIONES' || '', bold: false, alignment: 'right' },
                { text: 'TOTAL VENTAS DIARIAS PROPIAS' || '', bold: false, alignment: 'right' },
                { text: 'VENTAS A CUENTA DE TERCEROS' || '', bold: false, alignment: 'right' },
                { text: 'IVA RETENIDO' || '', bold: false, alignment: 'right' }
              ]);
              
              for(const element of (result || [])) {
                tableData.push([
                  { text: element?.reportDay || '', bold: false },
                  { text: element?.documentNumberFrom || '', bold: false },
                  { text: element?.documentNumberTo || '', bold: false },
                  { text: element?.cashierId || '', bold: false },
                  { text: element?.noTaxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.taxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.exportations || '', bold: false, alignment: 'right' },
                  { text: element?.total || '', bold: false, alignment: 'right' },
                  { text: element?.totalToThirdAccounts || '', bold: false, alignment: 'right' },
                  { text: element?.IVARetention || '', bold: false, alignment: 'right' }
                ]);
              }

              tableData.push([
                { text: 'TOTALES', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: getDataSumByProperty('noTaxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('taxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('exportations'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('totalToThirdAccounts'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('IVARetention'), bold: false, alignment: 'right' }
              ]);

              const docDefinition = {
                pageOrientation: 'portrait',
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  // return [
                  //   {
                  //     columns: [
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center'},
                  //           { text: 'Copia para repartidor', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       },
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center' },
                  //           { text: 'Copia para encargado de sala', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       }
                  //     ],
                  //     // optional space between columns
                  //     columnGap: 10,
                  //     margin: [40, 30, 40, 0]
                  //   }
                  // ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Libro de Ventas ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM YYYY'))}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `Pagina ${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    text: `EMPRESA:`,
                    fontSize: 10
                  },
                  {
                    text: `LIBRO O REGISTRO DE OPERACIONES DE VENTA A CONSUMIDORES (Art. 141 C.T. y 83 de R.C.T.)`,
                    fontSize: 12
                  },
                  {
                    text: `NOMBRE DEL CONTRIBUYENTE: `,
                    fontSize: 10
                  },
                  {
                    columns: [
                      {
                        width: '33%',
                        text: `MES: ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM'))}`,
                        fontSize: 10
                      },
                      {
                        width: '33%',
                        text: `AÑO: ${dayjs(month).format('YYYY')}`,
                        fontSize: 10
                      },
                      {
                        width: '34%',
                        text: `NRC:`,
                        fontSize: 10
                      }
                    ]
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    layout: 'noBorders', // optional
                    table: {
                      headerRows: 1,
                      widths: ['10%', '20%', '10%', '10%', '10%', '10%', '10%', '10%', '10%'],
                      body: [[
                        { text: '' },
                        { text: 'DOCUMENTOS EMITIDOS' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' }
                      ]]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines', // optional
                    table: {
                      headerRows: 1,
                      widths: ['10%', '10%', '10%', '10%', '10%', '10%', '10%', '10%', '10%', '10%'],
                      body: tableData
                    }
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA NETA:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total') - getDataSumByProperty('totalTaxes')).toFixed(2)}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `DEBITO FISCAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('totalTaxes'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA TOTAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    text: 'Firma Contribuyente o Contador: __________________________________________',
                    alignment: 'right',
                    margin: [ 0, 5, 0, 0 ]
                  },
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=transfersheet.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getMonthlyTaxPayerSaleBookPDF = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId, month } = req.params;

      conn.query(
        queries.getMonthlyTaxPayerSaleBook,
        [ locationId || 0, month || '2000-01' ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              

              const printer = new PdfPrinter(fonts);

              const getDataSumByProperty = (propertyName) => {
                let total = 0;
                for (const value of result) {
                  total += +(value?.[propertyName] || 0)
                }
                return total.toFixed(2);
              }

              const tableData = [];

              tableData.push([
                { text: 'CORRELATIVO' || '', bold: false, alignment: 'left' },
                { text: 'FECHA DE EMISION' || '', bold: false, alignment: 'left' },
                { text: 'NO DE FACTURA' || '', bold: false, alignment: 'left' },
                { text: 'CONTROL FORMULARIO UNICO' || '', bold: false, alignment: 'left' },
                { text: 'NOMBRE CONTRIBUYENTE' || '', bold: false, alignment: 'left' },
                { text: 'NRC' || '', bold: false, alignment: 'left' },
                { text: 'EXENTAS' || '', bold: false, alignment: 'right' },
                { text: 'GRAVADAS' || '', bold: false, alignment: 'right' },
                { text: 'DEBITO FISCAL' || '', bold: false, alignment: 'right' },
                { text: 'EXENTAS' || '', bold: false, alignment: 'right' },
                { text: 'GRAVADAS' || '', bold: false, alignment: 'right' },
                { text: 'DEBITO FISCAL' || '', bold: false, alignment: 'right' },
                { text: 'IMPUESTO RETENIDO' || '', bold: false, alignment: 'right' },
                { text: 'VENTAS TOTALES' || '', bold: false, alignment: 'right' }
              ]);
              
              for(const element of (result || [])) {
                tableData.push([
                  { text: element?.rowNum || '', bold: false },
                  { text: element?.reportDay || '', bold: false },
                  { text: element?.documentNumber || '', bold: false },
                  { text: element?.formUniqueController || '', bold: false },
                  { text: element?.customerFullname || '', bold: false },
                  { text: element?.customerNrc || '', bold: false },
                  { text: element?.noTaxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.taxableSubTotalWithoutTaxes || '', bold: false, alignment: 'right' },
                  { text: element?.totalTaxes || '', bold: false, alignment: 'right' },
                  { text: element?.thirdNoTaxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.thirdTaxableSubTotalWithoutTaxes || '', bold: false, alignment: 'right' },
                  { text: element?.thirdTotalTaxes || '', bold: false, alignment: 'right' },
                  { text: element?.IVARetention || '', bold: false, alignment: 'right' },
                  { text: element?.total || '', bold: false, alignment: 'right' }
                ]);
              }

              tableData.push([
                { text: 'TOTALES', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: getDataSumByProperty('noTaxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('taxableSubTotalWithoutTaxes'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('totalTaxes'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('thirdNoTaxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('thirdTaxableSubTotalWithoutTaxes'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('thirdTotalTaxes'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('IVARetention'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right' }
              ]);

              const docDefinition = {
                pageOrientation: 'landscape',
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  // return [
                  //   {
                  //     columns: [
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center'},
                  //           { text: 'Copia para repartidor', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       },
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center' },
                  //           { text: 'Copia para encargado de sala', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       }
                  //     ],
                  //     // optional space between columns
                  //     columnGap: 10,
                  //     margin: [40, 30, 40, 0]
                  //   }
                  // ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Libro de Ventas ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM YYYY'))}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `Pagina ${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    text: `EMPRESA:`,
                    fontSize: 10
                  },
                  {
                    text: `LIBRO O REGISTRO DE OPERACIONES DE VENTAS AL CONTRIBUYENTE (Art.141 C.T. Y 85 R.C.T.)`,
                    fontSize: 12
                  },
                  {
                    text: `NOMBRE DEL CONTRIBUYENTE: `,
                    fontSize: 10
                  },
                  {
                    columns: [
                      {
                        width: '33%',
                        text: `MES: ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM'))}`,
                        fontSize: 10
                      },
                      {
                        width: '33%',
                        text: `AÑO: ${dayjs(month).format('YYYY')}`,
                        fontSize: 10
                      },
                      {
                        width: '34%',
                        text: `NRC:`,
                        fontSize: 10
                      }
                    ]
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    layout: 'noBorders', // optional
                    table: {
                      headerRows: 1,
                      widths: ['6.25%', '6.25%', '6.25%', '6.25%', '18.75%', '6.25%', '18.75%', '18.75%', '6.25%', '6.25%'],
                      body: [[
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: 'PROPIAS' },
                        { text: 'A CUENTAS DE TERCEROS' },
                        { text: '' },
                        { text: '' }
                      ]]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines', // optional
                    table: {
                      headerRows: 1,
                      widths: ['6.25%', '6.25%', '6.25%', '6.25%', '18.75%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%'],
                      body: tableData
                    }
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA NETA:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total') - getDataSumByProperty('totalTaxes')).toFixed(2)}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `DEBITO FISCAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('totalTaxes'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA TOTAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    text: 'Firma Contribuyente o Contador: __________________________________________',
                    alignment: 'right',
                    margin: [ 0, 5, 0, 0 ]
                  },
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=transfersheet.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getMonthlyPurchaseBookPDF = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId, month } = req.params;

      conn.query(
        queries.getMonthlyPurchasesBook,
        [ locationId || 0, month || '2000-01', locationId || 0, month || '2000-01' ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              

              const printer = new PdfPrinter(fonts);

              const getDataSumByProperty = (propertyName) => {
                let total = 0;
                for (const value of result) {
                  total += +(value?.[propertyName] || 0)
                }
                return total.toFixed(2);
              }

              const tableData = [];

              tableData.push([
                { text: 'CORR' || '', bold: false, alignment: 'left' },
                { text: 'FECHA DE EMISION' || '', bold: false, alignment: 'left' },
                { text: 'NO DE FACTURA' || '', bold: false, alignment: 'left' },
                { text: 'NO DE REGISTRO' || '', bold: false, alignment: 'left' },
                { text: 'NOMBRE PROVEEDOR' || '', bold: false, alignment: 'left' },
                { text: 'INTERNAS' || '', bold: false, alignment: 'right' },
                { text: 'IMPORT.' || '', bold: false, alignment: 'right' },
                { text: 'INTERNAS' || '', bold: false, alignment: 'right' },
                { text: 'IMPORT.' || '', bold: false, alignment: 'right' },
                { text: 'CREDITO FISCAL' || '', bold: false, alignment: 'right' },
                { text: 'TOTAL COMPRAS' || '', bold: false, alignment: 'right' },
                { text: 'RETENCION TERCEROS' || '', bold: false, alignment: 'right' },
                { text: 'COMPRAS A SUJETOS EXCLUIDOS' || '', bold: false, alignment: 'right' }
              ]);
              
              for(const element of (result || [])) {
                tableData.push([
                  { text: element?.rowNum || '', bold: false },
                  { text: element?.reportDay || '', bold: false },
                  { text: element?.documentNumber || '', bold: false },
                  { text: element?.supplierNrc || '', bold: false },
                  { text: element?.supplierName.substring(0, 46) || '', bold: false, fontSize: 5 },
                  { text: element?.noTaxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.noTaxableSubTotalImport || 0, bold: false, alignment: 'right' },
                  { text: element?.taxableSubTotal || '', bold: false, alignment: 'right' },
                  { text: element?.taxableSubTotalImport || 0, bold: false, alignment: 'right' },
                  { text: element?.totalTaxes || '', bold: false, alignment: 'right' },
                  { text: element?.total || '', bold: false, alignment: 'right' },
                  { text: element?.IVAretention || '', bold: false, alignment: 'right' },
                  { text: element?.totalExcludeIndividuals || 0, bold: false, alignment: 'right' }
                ]);
              }

              tableData.push([
                { text: 'TOTALES', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false, fontSize: 5 },
                { text: getDataSumByProperty('noTaxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('noTaxableSubTotalImport'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('taxableSubTotal'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('taxableSubTotalImport'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('totalTaxes'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('IVAretention'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('totalExcludeIndividuals'), bold: false, alignment: 'right' }
              ]);

              const docDefinition = {
                pageOrientation: 'landscape',
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  // return [
                  //   {
                  //     columns: [
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center'},
                  //           { text: 'Copia para repartidor', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       },
                  //       {
                  //         // auto-sized columns have their widths based on their content
                  //         width: '50%',
                  //         stack: [
                  //           { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center' },
                  //           { text: 'Copia para encargado de sala', fontSize: 11, alignment: 'center' }
                  //         ]
                  //       }
                  //     ],
                  //     // optional space between columns
                  //     columnGap: 10,
                  //     margin: [40, 30, 40, 0]
                  //   }
                  // ]
                },
                footer: function(currentPage, pageCount) {
                  // Podemos tener hasta cuatro líneas de pie de página
                  return [
                    { text: `Libro de Ventas ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM YYYY'))}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    { text: `Pagina ${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                    // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                  ]
                },
                content: [
                  {
                    text: `EMPRESA:`,
                    fontSize: 10
                  },
                  {
                    text: `LIBRO O REGISTRO DE COMPRAS (Art. 141 C.T. y 86 R.C.T.)`,
                    fontSize: 12
                  },
                  {
                    text: `NOMBRE DEL CONTRIBUYENTE: `,
                    fontSize: 10
                  },
                  {
                    columns: [
                      {
                        width: '33%',
                        text: `MES: ${stringHelpers.capitalizeWord(dayjs(month).format('MMMM'))}`,
                        fontSize: 10
                      },
                      {
                        width: '33%',
                        text: `AÑO: ${dayjs(month).format('YYYY')}`,
                        fontSize: 10
                      },
                      {
                        width: '34%',
                        text: `NRC:`,
                        fontSize: 10
                      }
                    ]
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    layout: 'noBorders', // optional
                    table: {
                      headerRows: 1,
                      widths: ['5%', '6%', '6%', '6%', '28.90%', '12%', '12%', '6%', '6%', '6%', '6%'],
                      body: [[
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: 'Exentas', alignment: 'center' },
                        { text: 'Afectas', alignment: 'center' },
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '' }
                      ]]
                    }
                  },
                  {
                    layout: 'lightHorizontalLines', // optional
                    table: {
                      headerRows: 1,
                      widths: ['5%', '6%', '6%', '6%', '28.90%', '6%', '6%', '6%', '6%', '6%', '6%', '6%', '6%'],
                      body: tableData
                    }
                  },
                  /*
                  // 1.66
                  // 0.66
                  // 0.66
                  // 0.66
                  */
                  // 0.66
                  // 0.66
                  // 0.66
                  // 0.66
                  // 0.66
                  // 0.66
                  // 0.66
                  // 0.66
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA NETA:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total') - getDataSumByProperty('totalTaxes')).toFixed(2)}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `DEBITO FISCAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('totalTaxes'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    columns: [
                      {
                        width: '20%',
                        text: `VENTA TOTAL:`
                      },
                      {
                        width: '20%',
                        text: `${(getDataSumByProperty('total'))}`,
                        alignment: 'right'
                      },
                      {
                        width: '60%',
                        text: ``
                      }
                    ]
                  },
                  {
                    text: 'Firma Contribuyente o Contador: __________________________________________',
                    alignment: 'right',
                    margin: [ 0, 5, 0, 0 ]
                  },
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=transfersheet.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getTransferSheet = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { transferId } = req.params;

      conn.query(
        queries.getTransferSheet,
        [ transferId || 0, transferId || 0 ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {

              const transferHeader = result[0][0];
              const transferDetails = result[1];

              const fonts = {
                Roboto: {
                  normal: path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
                  bold: path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
                  italics: path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
                  bolditalics: path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
                }
              };

              const printer = new PdfPrinter(fonts);

              const transferDetailData = [];
              transferDetailData.push([
                'PRODUCTO',
                { text: 'CANTIDAD' || '', bold: false, alignment: 'right' },
                { text: 'ENTREGA' || '', bold: false, alignment: 'right' }
              ]);

              const transferDetailData2 = [];
              transferDetailData2.push([
                'PRODUCTO',
                { text: 'CANTIDAD' || '', bold: false, alignment: 'right' },
                { text: 'RECIBE' || '', bold: false, alignment: 'right' }
              ]);
              
              for(const det of (transferDetails || [])) {
                transferDetailData.push([
                  { text: det?.productName || '', bold: false },
                  { text: det?.quantityExpected || '', bold: false, alignment: 'right' },
                  {
                    svg: `
                      <svg width="30" height="10">
                        <rect x="0" y="0" width="30" height="10"
                        style="fill:white;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
                      </svg>
                    `,
                    alignment: 'right'
                  },
                ]);
                transferDetailData2.push([
                  { text: det?.productName || '', bold: false },
                  { text: det?.quantityExpected || '', bold: false, alignment: 'right' },
                  {
                    svg: `
                      <svg width="30" height="10">
                        <rect x="0" y="0" width="30" height="10"
                        style="fill:white;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
                      </svg>
                    `,
                    alignment: 'right'
                  },
                ]);
              }

              const docDefinition = {
                pageOrientation: 'landscape',
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    // { text: 'HOJA DE TRASLADO', fontSize: 16, alignment: 'left', margin: [40, 30, 40, 0] },
                    // { text: 'Centro Llantas Turcios', alignment: 'left', margin: [40, 0, 40, 0] }
                    {
                      columns: [
                        {
                          // auto-sized columns have their widths based on their content
                          width: '50%',
                          stack: [
                            { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center'},
                            { text: 'Copia para repartidor', fontSize: 11, alignment: 'center' }
                          ]
                        },
                        {
                          // auto-sized columns have their widths based on their content
                          width: '50%',
                          stack: [
                            { text: `Hoja de traslado #${transferHeader?.transferId}`, fontSize: 13, alignment: 'center' },
                            { text: 'Copia para encargado de sala', fontSize: 11, alignment: 'center' }
                          ]
                        }
                      ],
                      // optional space between columns
                      columnGap: 10,
                      margin: [40, 30, 40, 0]
                    }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                // footer: function(currentPage, pageCount) {
                //   // Podemos tener hasta cuatro líneas de pie de página
                //   return [
                //     { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //   ]
                // },
                content: [
                  {
                    columns: [
                      {
                        // auto-sized columns have their widths based on their content
                        width: '50%',
                        stack: [
                          {
                            columns: [
                              {
                                // auto-sized columns have their widths based on their content
                                width: '50%',
                                stack: [
                                  { text: 'Fecha', fontSize: 9, alignment: 'left'},
                                  { text: 'Proviene de:', fontSize: 9, alignment: 'left'},
                                  { text: 'Entregar a:', fontSize: 9, alignment: 'left' }
                                ]
                              },
                              {
                                // auto-sized columns have their widths based on their content
                                width: '50%',
                                stack: [
                                  { text: `${transferHeader?.sentAt}`, fontSize: 9, bold: true, alignment: 'right' },
                                  { text: `${transferHeader?.originLocationName}`, fontSize: 9, bold: true, alignment: 'right' },
                                  { text: `${transferHeader?.destinationLocationName}`, fontSize: 9, bold: true, alignment: 'right' }
                                ]
                              }
                            ]
                          },
                          {
                            layout: 'lightHorizontalLines', // optional
                            table: {
                              headerRows: 1,
                              widths: ['50%', '25%', '25%'],
                              body: transferDetailData
                            }
                          },
                          { text: '__________________________________________', fontSize: 10, alignment: 'center'},
                          { text: 'FIRMA', fontSize: 10, alignment: 'center'},
                          {
                            layout: 'lightHorizontalLines', // optional
                            table: {
                              headerRows: 1,
                              widths: ['100%'],
                              body: [
                                [{text: 'OBSERVACIONES'}],
                                [{text: '-'}],
                                [{text: '-'}],
                                [{text: '-'}],
                                [{text: ''}]
                              ]
                            }
                          }
                        ]
                      },
                      {
                        // auto-sized columns have their widths based on their content
                        width: '50%',
                        stack: [
                          {
                            columns: [
                              {
                                // auto-sized columns have their widths based on their content
                                width: '50%',
                                stack: [
                                  { text: 'Fecha:', fontSize: 9, alignment: 'left'},
                                  { text: 'Proviene de:', fontSize: 9, alignment: 'left'},
                                  { text: 'Entregar a:', fontSize: 9, alignment: 'left' }
                                ]
                              },
                              {
                                // auto-sized columns have their widths based on their content
                                width: '50%',
                                stack: [
                                  { text: `${transferHeader?.sentAt}`, fontSize: 9, bold: true, alignment: 'right' },
                                  { text: `${transferHeader?.originLocationName}`, fontSize: 9, bold: true, alignment: 'right' },
                                  { text: `${transferHeader?.destinationLocationName}`, fontSize: 9, bold: true, alignment: 'right' }
                                ]
                              }
                            ]
                          },
                          {
                            layout: 'lightHorizontalLines', // optional
                            table: {
                              headerRows: 1,
                              widths: ['50%', '25%', '25%'],
                              body: transferDetailData2
                            }
                          },
                          { text: '__________________________________________', fontSize: 10, alignment: 'center'},
                          { text: 'FIRMA', fontSize: 10, alignment: 'center'},
                          {
                            layout: 'lightHorizontalLines', // optional
                            table: {
                              headerRows: 1,
                              widths: ['100%'],
                              body: [
                                [{text: 'OBSERVACIONES'}],
                                [{text: '-'}],
                                [{text: '-'}],
                                [{text: '-'}],
                                [{text: ''}]
                              ]
                            }
                          }
                        ]
                      }
                    ],
                    // optional space between columns
                    columnGap: 10
                  }
                  // { text: 'Resumen de ventas', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     headerRows: 1,
                  //     widths: ['10%', '10%', '30%', '40%', '10%'],
                  //     body: salesReportBodyData
                  //   }
                  // },
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=transfersheet.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.getLowStockByLocation = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId } = req.params;
      const allLocations = +locationId === 0 || locationId === null;

      conn.query(
        queries.getLowStockByLocation,
        [ locationId || 0 ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {

              const dataHeader = result[0][0];
              const dataDetail = result[1];

              const printer = new PdfPrinter(fonts);

              const tableData = [];
              if (allLocations) {
                tableData.push([
                  'SUCURSAL',
                  'CODIGO',
                  'DESCRIPCION',
                  { text: 'EXISTENCIA ACTUAL' || '', bold: false, alignment: 'right' },
                  { text: 'MINIMO' || '', bold: false, alignment: 'right' }
                ]);
                
                for(const det of (dataDetail || [])) {
                  tableData.push([
                    { text: det?.locationName || '', bold: false },
                    { text: det?.productCode || '', bold: false },
                    { text: det?.productName || '', bold: false },
                    { text: det?.productStock || '', bold: false, alignment: 'right' },
                    { text: det?.minStockAlert || '', bold: false, alignment: 'right' }
                  ]);
                }
              } else {
                tableData.push([
                  'CODIGO',
                  'DESCRIPCION',
                  { text: 'EXISTENCIA ACTUAL' || '', bold: false, alignment: 'right' },
                  { text: 'MINIMO' || '', bold: false, alignment: 'right' }
                ]);
                
                for(const det of (dataDetail || [])) {
                  tableData.push([
                    { text: det?.productCode || '', bold: false },
                    { text: det?.productName || '', bold: false },
                    { text: det?.productStock || '', bold: false, alignment: 'right' },
                    { text: det?.minStockAlert || '', bold: false, alignment: 'right' }
                  ]);
                }
              }

              const docDefinition = {
                pageOrientation: 'portrait',
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    // { text: 'HOJA DE TRASLADO', fontSize: 16, alignment: 'left', margin: [40, 30, 40, 0] },
                    // { text: 'Todo Para Cake', alignment: 'left', margin: [40, 0, 40, 0] }
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                    // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                  ]
                },
                // footer: function(currentPage, pageCount) {
                //   // Podemos tener hasta cuatro líneas de pie de página
                //   return [
                //     { text: `Sistema de Información Gerencial SigProCOM`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                //     // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                //   ]
                // },
                content: [
                  {
                    text: `REPORTE DE EXISTENCIAS BAJAS`,
                    fontSize: 12
                  },
                  {
                    text: `${dataHeader?.locationName}`,
                    fontSize: 10
                  },
                  {
                    text: ``,
                    fontSize: 10,
                    margin: [ 0, 5, 0, 0 ]
                  },
                  {
                    layout: 'headerLineOnly', // optional
                    table: {
                      headerRows: 1,
                      widths: allLocations ? ['15%', '10%', '45%', '15%', '15%'] : ['10%', '50%', '20%', '20%'],
                      body: tableData
                    }
                  },
                  // { text: 'Resumen de ventas', fontSize: 13 },
                  // {
                  //   layout: 'headerLineOnly', // optional
                  //   table: {
                  //     headerRows: 1,
                  //     widths: ['10%', '10%', '30%', '40%', '10%'],
                  //     body: salesReportBodyData
                  //   }
                  // },
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=transfersheet.pdf');

              pdfDoc.pipe(res);
              pdfDoc.end();
            } catch(error) {
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.excelDocs.getLowStockByLocation = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId } = req.params;
      const allLocations = +locationId === 0 || locationId === null;

      conn.query(
        queries.getLowStockByLocation,
        [ locationId || 0 ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              const dataHeader = result[0][0];
              const dataDetail = result[1];

              let colCodeWidth = 0;
              let colNameWidth = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              const tableData = [];
              if (allLocations) {
                ws.cell(1, 1, 1, 5, true).string(`${dataHeader?.locationName}`).style({ ...headerStyle, alignment: { horizontal: 'center' } });
                ws.cell(2, 1, 2, 5, true).string(`REPORTE EXISTENCIAS BAJAS`).style({ ...headerStyle, alignment: { horizontal: 'center' } });
                ws.cell(3, 1).string('SUCURSAL').style({ ...headerStyle, alignment: { horizontal: 'left' } });
                ws.cell(3, 2).string('CODIGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
                ws.cell(3, 3).string('DESCRIPCION').style({ ...headerStyle, alignment: { horizontal: 'left' } });
                ws.cell(3, 4).string('ACTUAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
                ws.cell(3, 5).string('MINIMO').style({ ...headerStyle, alignment: { horizontal: 'right' } });

                for(const [index, value] of (dataDetail || []).entries()) {
                  ws.cell(4 + index, 1).string(value?.locationName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                  ws.cell(4 + index, 2).string(value?.productCode || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                  ws.cell(4 + index, 3).string(value?.productName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                  ws.cell(4 + index, 4).number(+value?.productStock || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                  ws.cell(4 + index, 5).number(+value?.minStockAlert || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

                  if (String(value?.productCode).length > colCodeWidth) colCodeWidth = String(value?.productCode).length;
                  if (String(value?.productName).length > colNameWidth) colNameWidth = String(value?.productName).length;
                }

                ws.column(2).setWidth(+colCodeWidth);
                ws.column(3).setWidth(+colNameWidth);
              } else {
                ws.cell(1, 1, 1, 4, true).string(`${dataHeader?.locationName}`).style({ ...headerStyle, alignment: { horizontal: 'center' } });
                ws.cell(2, 1, 2, 4, true).string(`REPORTE EXISTENCIAS BAJAS`).style({ ...headerStyle, alignment: { horizontal: 'center' } });
                ws.cell(3, 1).string('CODIGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
                ws.cell(3, 2).string('DESCRIPCION').style({ ...headerStyle, alignment: { horizontal: 'left' } });
                ws.cell(3, 3).string('ACTUAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
                ws.cell(3, 4).string('MINIMO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
                
                for(const [index, value] of (dataDetail || []).entries()) {
                  ws.cell(4 + index, 1).string(value?.productCode || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                  ws.cell(4 + index, 2).string(value?.productName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                  ws.cell(4 + index, 3).number(+value?.productStock || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                  ws.cell(4 + index, 4).number(+value?.minStockAlert || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

                  if (String(value?.productCode).length > colCodeWidth) colCodeWidth = String(value?.productCode).length;
                  if (String(value?.productName).length > colNameWidth) colNameWidth = String(value?.productName).length;
                }

                ws.column(1).setWidth(+colCodeWidth);
                ws.column(2).setWidth(+colNameWidth);
              }

              wb.write('ReporteExistenciasBajas.xlsx', res);
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.excelDocs.getProfitReportByLocationDateRange = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { locationId, startDate, endDate } = req.params;

      conn.query(
        queries.getProfitReportByLocationDateRange,
        [ locationId, locationId, startDate, endDate ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let headResult = queryRows[0];
          let result = queryRows[1];

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granTotalSale = 0;
              let granTotalCost = 0;
              let granTotalProfit = 0;

              let colNameWidth = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 12, true).string(`REPORTE DE UTILIDADES`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 12, true).string(`${headResult[0]?.name || ''}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 12, true).string(`PERIODO: ${stringHelpers.capitalizeWord(dayjs(startDate).format('DD MMMM YYYY'))} AL ${stringHelpers.capitalizeWord(dayjs(endDate).format('DD MMMM YYYY'))}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('TIPO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('DOCUMENTO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('CATEGORIA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 5).string('COD. PROD.').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 6).string('PRODUCTO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 7).string('CANTIDAD').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 8).string('PRECIO VENTA').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('VENTA TOTAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 10).string('COSTO VENTA').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 11).string('COSTO TOTAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 12).string('UTILIDAD').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (result || []).entries()) {
                ws.cell(nextRow, 1).string(value?.docDatetimeFormat || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 2).string(value?.documentTypeName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 3).string(value?.docNumber || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).string(value?.categoryName || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 5).string(value?.productCode || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 6).string(value?.productName || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 7).number(+value?.quantity || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 8).number(+value?.unitPrice || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+value?.taxableSubTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 10).number(+value?.unitCost || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 11).number(+value?.totalCost || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 12).number(+value?.profit || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                nextRow++;

                granTotalSale += +value?.taxableSubTotal || 0;
                granTotalCost += +value?.totalCost || 0;
                granTotalProfit += +value?.profit || 0;

                if (String(value?.productName).length > colNameWidth) colNameWidth = String(value?.productName).length;
              }

              ws.cell(nextRow, 1).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 2).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 3).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 5).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 6).string('TOTAL').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 7).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 8).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 9).number(granTotalCost || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 10).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 11).number(granTotalCost || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 12).number(granTotalProfit || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              nextRow++;

              ws.column(6).setWidth(+colNameWidth);
              
              wb.write('ReporteUtilidades.xlsx', res);
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.excelDocs.getPendingSales = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      conn.query(
        queries.getPendingSales,
        [],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let headResult = queryRows[0];
          let result = queryRows[1];

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granSaleTotal = 0;
              let granSaleTotalPaid = 0;
              let granSalePendingAmount = 0;
              let granCurrentDebt = 0;
              let granDebt30 = 0;
              let granDebt60 = 0;
              let granDebt90 = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 10, true).string(`REPORTE DE SALDOS PENDIENTES`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 10, true).string(`CLIENTES DEUDORES`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 10, true).string(`A LA FECHA: ${stringHelpers.capitalizeWord(dayjs().format('DD MMMM YYYY'))}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('TIPO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('DOCUMENTO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('VALOR').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 5).string('ABONOS').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 6).string('SALDO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 7).string('CORRIENTE').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 8).string('MORA 30').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('MORA 60').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 10).string('MORA 90').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (headResult || []).entries()) {
                ws.cell(nextRow, 1, nextRow, 10, true).string(`${value?.customerCode} ${value?.customerFullname}`).style({ ...contentStyle, alignment: { horizontal: 'left' } });
                nextRow++;

                let customerSaleTotal = 0;
                let customerSaleTotalPaid = 0;
                let customerSalePendingAmount = 0;
                let customerCurrentDebt = 0;
                let customerDebt30 = 0;
                let customerDebt60 = 0;
                let customerDebt90 = 0;

                for(const [innerIndex, innerValue] of (result || []).entries()) {
                  if (innerValue?.customerId === value?.customerId) {
                    ws.cell(nextRow, 1).string(innerValue?.docDatetimeFormatted || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 2).string(innerValue?.documentTypeName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 3).string(innerValue?.docNumber || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 4).number(+innerValue?.saleTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 5).number(+innerValue?.saleTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 6).number(+innerValue?.salePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 7).number(+innerValue?.currentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 8).number(+innerValue?.debt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 9).number(+innerValue?.debt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 10).number(+innerValue?.debt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

                    customerSaleTotal += +innerValue?.saleTotal;
                    customerSaleTotalPaid += +innerValue?.saleTotalPaid;
                    customerSalePendingAmount += +innerValue?.salePendingAmount;
                    customerCurrentDebt += +innerValue?.currentDebt;
                    customerDebt30 += +innerValue?.debt30;
                    customerDebt60 += +innerValue?.debt60;
                    customerDebt90 += +innerValue?.debt90;

                    granSaleTotal += +customerSaleTotal;
                    granSaleTotalPaid += +customerSaleTotalPaid;
                    granSalePendingAmount += +customerSalePendingAmount;
                    granCurrentDebt += +customerCurrentDebt;
                    granDebt30 += +customerDebt30;
                    granDebt60 += +customerDebt60;
                    granDebt90 += +customerDebt90;

                    nextRow++;
                  }
                }

                ws.cell(nextRow, 1, nextRow, 3, true).string('TOTAL' || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).number(+customerSaleTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 5).number(+customerSaleTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 6).number(+customerSalePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 7).number(+customerCurrentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 8).number(+customerDebt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+customerDebt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 10).number(+customerDebt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                
                nextRow++;
              }

              ws.cell(nextRow, 1, nextRow, 3, true).string('GRAN TOTAL' || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).number(+granSaleTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 5).number(+granSaleTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 6).number(+granSalePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 7).number(+granCurrentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 8).number(+granDebt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 9).number(+granDebt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 10).number(+granDebt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              nextRow++;

              ws.row(4).freeze();

              wb.write('ReporteSaldosPendientes.xlsx', res);
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

controller.excelDocs.getPendingProductPurchases = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      conn.query(
        queries.getPendingProductPurchases,
        [],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let headResult = queryRows[0];
          let result = queryRows[1];

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granProductPurchaseTotal = 0;
              let granProductPurchaseTotalPaid = 0;
              let granProductPurchasePendingAmount = 0;
              let granCurrentDebt = 0;
              let granDebt30 = 0;
              let granDebt60 = 0;
              let granDebt90 = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 10, true).string(`REPORTE DE SALDOS PENDIENTES`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 10, true).string(`PROVEEDORES PENDIENTES DE PAGO`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 10, true).string(`A LA FECHA: ${stringHelpers.capitalizeWord(dayjs().format('DD MMMM YYYY'))}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('TIPO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('DOCUMENTO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('VALOR').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 5).string('ABONOS').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 6).string('SALDO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 7).string('CORRIENTE').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 8).string('MORA 30').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('MORA 60').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 10).string('MORA 90').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (headResult || []).entries()) {
                ws.cell(nextRow, 1, nextRow, 10, true).string(`Id: ${value?.supplierId} - ${value?.supplierName}`).style({ ...contentStyle, alignment: { horizontal: 'left' } });
                nextRow++;

                let supplierProductPurchaseTotal = 0;
                let supplierProductPurchaseTotalPaid = 0;
                let supplierProductPurchasePendingAmount = 0;
                let supplierCurrentDebt = 0;
                let supplierDebt30 = 0;
                let supplierDebt60 = 0;
                let supplierDebt90 = 0;

                for(const [innerIndex, innerValue] of (result || []).entries()) {
                  if (innerValue?.supplierId === value?.supplierId) {
                    ws.cell(nextRow, 1).string(innerValue?.documentDatetimeFormatted || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 2).string(innerValue?.documentTypeName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 3).string(innerValue?.documentNumber || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                    ws.cell(nextRow, 4).number(+innerValue?.productPurchaseTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 5).number(+innerValue?.productPurchaseTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 6).number(+innerValue?.productPurchasePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 7).number(+innerValue?.currentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 8).number(+innerValue?.debt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 9).number(+innerValue?.debt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                    ws.cell(nextRow, 10).number(+innerValue?.debt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

                    supplierProductPurchaseTotal += +innerValue?.productPurchaseTotal;
                    supplierProductPurchaseTotalPaid += +innerValue?.productPurchaseTotalPaid;
                    supplierProductPurchasePendingAmount += +innerValue?.productPurchasePendingAmount;
                    supplierCurrentDebt += +innerValue?.currentDebt;
                    supplierDebt30 += +innerValue?.debt30;
                    supplierDebt60 += +innerValue?.debt60;
                    supplierDebt90 += +innerValue?.debt90;

                    granProductPurchaseTotal += +supplierProductPurchaseTotal;
                    granProductPurchaseTotalPaid += +supplierProductPurchaseTotalPaid;
                    granProductPurchasePendingAmount += +supplierProductPurchasePendingAmount;
                    granCurrentDebt += +supplierCurrentDebt;
                    granDebt30 += +supplierDebt30;
                    granDebt60 += +supplierDebt60;
                    granDebt90 += +supplierDebt90;

                    nextRow++;
                  }
                }

                ws.cell(nextRow, 1, nextRow, 3, true).string('TOTAL' || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).number(+supplierProductPurchaseTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 5).number(+supplierProductPurchaseTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 6).number(+supplierProductPurchasePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 7).number(+supplierCurrentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 8).number(+supplierDebt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+supplierDebt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 10).number(+supplierDebt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                
                nextRow++;
              }

              ws.cell(nextRow, 1, nextRow, 3, true).string('GRAN TOTAL' || '0').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).number(+granProductPurchaseTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 5).number(+granProductPurchaseTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 6).number(+granProductPurchasePendingAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 7).number(+granCurrentDebt || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 8).number(+granDebt30 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 9).number(+granDebt60 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 10).number(+granDebt90 || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              nextRow++;

              ws.row(4).freeze();

              wb.write('ReporteProveedoresSaldosPendientes.xlsx', res);
            } catch(error) {
              console.log(error);
              res.json({ status: 400, message: 'error', errorContent: error });
            }
          });
        }
      );
    });
  });
}

export default controller;
