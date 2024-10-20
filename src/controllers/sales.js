import PdfPrinter from 'pdfmake';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xl from 'excel4node';
import connUtil from "../helpers/connectionUtil.js";
import dayjs from 'dayjs';

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

const controller = {};

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
  find: `
    SELECT * FROM vw_sales;
  `,
  findById: `
    SELECT * FROM vw_sales WHERE id = ?;
  `,
  findByDocNumber: `
    SELECT
      id,
      documentTypeName,
      docNumber,
      docDatetime,
      customerFullname,
      paymentTypeName,
      total,
      saleTotalPaid
    FROM
      vw_sales vs
    WHERE
      vs.docNumber = ?
      AND (vs.documentTypeId = ? OR ? = 0)
    ORDER BY
      vs.docNumber;
  `,
  findByCustomerIdentifier: `
    SELECT
      id,
      documentTypeId,
      documentTypeName,
      docNumber,
      docDatetime,
      customerFullname,
      paymentTypeName,
      saleTotalPaid,
      controlNumber,
      generationCode,
      receptionStamp,
      ROUND(taxableSubTotalWithoutTaxes, 2) AS taxableSubTotalWithoutTaxes,
      ROUND(noTaxableSubTotal, 2) AS noTaxableSubTotal,
      ROUND(ivaTaxAmount, 2) AS ivaTaxAmount,
      ROUND(fovialTaxAmount, 2) AS fovialTaxAmount,
      ROUND(cotransTaxAmount, 2) AS cotransTaxAmount,  
      ROUND(IVAperception, 2) AS IVAperception,
      ROUND(IVAretention, 2) AS IVAretention,
      ROUND(total, 2) AS total
    FROM
      vw_sales vs
    WHERE
      (vs.customerId = ?
      OR vs.customerCode = ?
      OR vs.customerFullname LIKE ?)
      AND vs.docDate BETWEEN ? AND ?
    ORDER BY
      vs.docDatetime DESC;
  `,
  findByProductIdentifier: `
    SELECT
      id,
      documentTypeName,
      docNumber,
      docDatetime,
      customerFullname,
      paymentTypeName,
      total,
      saleTotalPaid
    FROM
      vw_sales vs
    WHERE
      vs.id IN (
        SELECT saleId FROM vw_saledetails vs2
        WHERE productId = ?
        OR productCode = ?
        -- OR productName LIKE ?
      )
    ORDER BY
      vs.docDatetime DESC;
  `,
  findByCashierDate: `
    SELECT
      sale.id,
      sale.documentTypeId,
      d.name AS documentTypeName,
      sale.docNumber,
      sale.docDatetime,
      c.fullName AS customerFullname,
      p.name AS paymentTypeName,
      sale.total,
      fn_getsaletotalpaid(sale.id) AS saleTotalPaid,
      sale.dteTransmitionStatus,
      sale.generationCode
    FROM
      sales sale
      INNER JOIN documenttypes d ON sale.documentTypeId = d.id
      INNER JOIN paymenttypes p ON sale.paymentTypeId = p.id
      INNER JOIN customers c ON sale.customerId = c.id
      INNER JOIN shiftcuts s ON sale.shiftcutId = s.id
    WHERE
      s.cashierId = ?
      AND DATE_FORMAT(sale.docDatetime, '%Y-%m-%d') = ?
      AND sale.isActive = 1
    ORDER BY id DESC;
  `,
  findByLocationCurrentActiveShiftcut: `
    SELECT * FROM vw_sales WHERE shiftcutId = fn_getlocationcurrentactiveshiftcut(?);
  `,
  findByMyCashier: `
    SET @shiftcutId = (SELECT id FROM shiftcuts WHERE cashierId = ? AND status = 1 LIMIT 1);

    SELECT
      sale.id,
      sale.documentTypeId,
      d.name AS documentTypeName,
      sale.docNumber,
      sale.docDatetime,
      c.fullName AS customerFullname,
      p.name AS paymentTypeName,
      sale.total,
      fn_getsaletotalpaid(sale.id) AS saleTotalPaid,
      sale.generationCode,
      sale.dteTransmitionStatus
    FROM
      sales sale
      INNER JOIN documenttypes d ON sale.documentTypeId = d.id
      INNER JOIN paymenttypes p ON sale.paymentTypeId = p.id
      INNER JOIN customers c ON sale.customerId = c.id
    WHERE
      sale.shiftcutId = (@shiftcutId)
      AND sale.isActive = 1
    ORDER BY id DESC;
  `,
  findPendings: `SELECT * FROM vw_pendingsalecustomers;`,
  findPendingsByLocation: `SELECT * FROM vw_pendingsalecustomers WHERE customerLocationId = ? OR customerLocationId IS NULL;`,
  findPendingAmountToPay: `SELECT (IFNULL(total, 0) - fn_getsaletotalpaid(id)) AS pendingAmount FROM sales WHERE id = ?;`,
  add: `
    CALL usp_CreateNewSale(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  update: `
    UPDATE sales
    SET
      locationId = IFNULL(?, locationId),
      customerId = IFNULL(?, customerId),
      docType = IFNULL(?, docType),
      docDatetime = IFNULL(?, docDatetime),
      docNumber = IFNULL(?, docNumber),
      total = IFNULL(?, total),
      createdBy = IFNULL(?, createdBy)
    WHERE
      id = ?;
  `,
  remove: `
    UPDATE sales SET isActive = 0 WHERE id = ?;
    UPDATE saledetails SET isActive = 0 WHERE saleId = ?;
  `,
  validateDocNumber: `
    SELECT fn_validatedocnumber(?, ?, ?) AS validated;
  `,
  voidSale: `CALL usp_VoidSale(?, ?);`,
  details: {
    findBySaleId: `
      SELECT *
      FROM vw_saledetails
      WHERE saleId = ? AND isActive = 1;
    `,
    add: `INSERT INTO saledetails (saleId, productId, unitPrice, quantity) VALUES ?;`,
    update: `
      UPDATE saledetails
      SET
        saleId = IFNULL(?, saleId),
        productId = IFNULL(?, productId),
        unitPrice = IFNULL(?, unitPrice),
        quantity = IFNULL(?, quantity)
      WHERE
        id = ?;
    `,
    remove: `UPDATE saledetails SET isActive = 0 WHERE id = ?;`
  },
  payments: {
    add: `
      CALL usp_CreateNewSalePayment (?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?);
    `,
    addGeneral: `
      CALL usp_NewGeneralPayment(?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?);    
    `,
    getRecords: `
      SELECT name FROM locations WHERE id = ?;

      SELECT * FROM vw_salepayments pay
      WHERE
        pay.locationId = ?
        AND pay.docDatetimeFormatted BETWEEN ? AND ?
      ORDER BY
        pay.docDatetime ASC;
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { saleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ saleId || 0 ], res));
}

controller.findByDocNumber = (req, res) => {
  const { docNumber, documentTypeId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByDocNumber, [ docNumber || '', documentTypeId || 0, documentTypeId || 0 ], res));
}

controller.findByCustomerIdentifier = (req, res) => {
  const { customerIdentifier, startDate, endDate } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByCustomerIdentifier, [ customerIdentifier || 0, customerIdentifier || 0, `%${customerIdentifier || ''}%`, startDate, endDate ], res));
}

controller.findByProductIdentifier = (req, res) => {
  const { productIdentifier } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByProductIdentifier, [ productIdentifier || 0, productIdentifier || '' ], res));
}

controller.findByCashierDate = (req, res) => {
  const { cashierId, dateToSearch } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByCashierDate, [ cashierId, dateToSearch ], res));
}

controller.findByLocationCurrentActiveShiftcut = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationCurrentActiveShiftcut, [ locationId || 0 ], res));
}

controller.findByMyCashier = (req, res) => {
  const { cashierId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByMyCashier, [ cashierId || 0 ], res, 1));
}

controller.findPendings = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findPendings, [], res));
}

controller.findPendingsByLocation = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingsByLocation, [ locationId ], res));
}

controller.findPendingAmountToPay = (req, res) => {
  const { saleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingAmountToPay, [ saleId ], res));
}

controller.add = (req, res) => {
  const { idtoauth } = req.headers;
  const {
    locationId,
    customerId,
    documentTypeId,
    paymentTypeId,
    paymentMethodId,
    docDatetime,
    docNumber,
    total,
    cashierId,
    IVAretention,
    IVAperception,
    expirationDays,
    bankId,
    referenceNumber,
    accountNumber,
    userPINCode,
    totalInLetters,
    isNoTaxableOperation,
    salesNotes,
    customerComplementaryName
  } = req.body;

  req.getConnection(
    connUtil.connSPFunc(
      queries.add,
      [
        locationId || 1,
        customerId,
        documentTypeId,
        paymentTypeId,
        paymentMethodId || 1,
        docDatetime,
        docNumber,
        total,
        cashierId,
        idtoauth,
        IVAretention || 0,
        IVAperception || 0,
        expirationDays || null,
        bankId || null,
        referenceNumber || '',
        accountNumber || '',
        userPINCode,
        totalInLetters || '',
        isNoTaxableOperation || 0,
        salesNotes || null,
        customerComplementaryName || null
      ],
      res
    )
  );
}

controller.validateDocNumber = (req, res) => {
  const { documentType, docNumber, cashierId } = req.body;
  req.getConnection(connUtil.connFunc(queries.validateDocNumber, [ documentType, docNumber, cashierId ], res));
}

controller.update = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, customerId, docType, docDatetime, docNumber, total, saleId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ locationId, customerId, docType, docDatetime, docNumber, total, idtoauth, saleId || 0 ], res));
}

controller.remove = (req, res) => {
  const { saleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ saleId || 0, saleId || 0 ], res));
}

controller.voidSale = (req, res) => {
  const { userId, saleId } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.voidSale, [ userId, saleId ], res));
}

// SALE DETAILS

controller.details = {};

controller.details.findBySaleId = (req, res) => {
  const { saleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findBySaleId, [ saleId || 0 ], res));
}

// EXPECTED req.body => details = [[saleId, productId, unitPrice, quantity], [...]]
controller.details.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ bulkData ], res));
}

controller.details.update = (req, res) => {
  const { saleId, productId, unitPrice, quantity, saleDetailId } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.update, [ saleId, productId, unitPrice, quantity, saleDetailId ], res));
}

controller.details.remove = (req, res) => {
  const { saleDetailId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.remove, [ saleDetailId || 0 ], res));
}

controller.payments = {};

controller.payments.add = (req, res) => {
  const { idtoauth } = req.headers;
  const {
    locationId,
    cashierId,
    saleId,
    paymentAmount,
    paymentMethodId,
    bankId,
    referenceNumber,
    accountNumber
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.payments.add,
      [
        locationId,
        cashierId,
        idtoauth,
        saleId ,
        paymentAmount,
        paymentMethodId,
        bankId || null,
        referenceNumber || '',
        accountNumber || ''
      ],
      res
    )
  );
}

controller.payments.addGeneral = (req, res) => {
  const { idtoauth } = req.headers;
  const {
    customerId,
    paymentAmount,
    locationId,
    cashierId,
    paymentMethodId,
    bankId,
    referenceNumber,
    accountNumber
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.payments.addGeneral,
      [
        customerId,
        paymentAmount,
        locationId,
        cashierId,
        idtoauth,
        paymentMethodId,
        bankId,
        referenceNumber,
        accountNumber
      ],
      res
    )
  );
}

controller.payments.getRecords = (req, res) => {
  const { locationId, startDate, endDate } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.payments.getRecords, 
      [ locationId, locationId, startDate, endDate ], 
      res,
      1
    )
  );
}

controller.pdfDocs = {};

controller.pdfDocs.findByDocNumber = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { docNumber, documentTypeId } = req.params;

      conn.query(
        queries.findByDocNumber,
        [ docNumber || '', documentTypeId || 0, documentTypeId || 0 ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

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
          
              const bodyData = [];
              bodyData.push([
                'CODIGO',
                'TIPO',
                'CORRELATIVO',
                'FECHA',
                'CLIENTE',
                'PAGO',
                'ANULADA',
                'TOTAL',
                'PAGADO'
              ]);
          
              for(const element of (result || [])) {
                bodyData.push([
                  { text: element?.id || '', bold: false },
                  { text: element?.documentTypeName || '', bold: false },
                  { text: element?.docNumber || '', bold: false },
                  { text: element?.docDatetime || '', bold: false },
                  { text: element?.customerFullname || '', bold: false },
                  { text: element?.paymentTypeName || '', bold: false },
                  { text: !!+element?.isVoided ? 'Anulada' : '' || '', bold: false },
                  { text: +element?.total || '', bold: false, alignment: 'right' },
                  { text: +element?.saleTotalPaid || '', bold: false, alignment: 'right' }
                ]);
              }

              bodyData.push([
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: 'TOTAL', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('saleTotalPaid'), bold: false, alignment: 'right' }
              ]);
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'REPORTE FACTURAS EMITIDAS - RESULTADOS POR CORRELATIVO', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: `PARAMETRO DE BUSQUEDA: ${docNumber}`, alignment: 'left', margin: [40, 0, 40, 0] }
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
                      widths: ['10%', '10%', '10%', '10%', '20%', '10%', '10%', '10%', '10%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageOrientation: 'landscape',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=ReporteVentasEmitidasPorCorrelativo.pdf');

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

controller.pdfDocs.findByCustomerIdentifier = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { customerIdentifier, startDate, endDate } = req.params;

      conn.query(
        queries.findByCustomerIdentifier,
        [ customerIdentifier || 0, customerIdentifier || 0, `%${customerIdentifier || ''}%`, startDate, endDate ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

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
          
              const bodyData = [];
              // bodyData.push([
              //   'CODIGO',
              //   'TIPO',
              //   'CORRELATIVO',
              //   'FECHA',
              //   'CLIENTE',
              //   'PAGO',
              //   'ANULADA',
              //   'TOTAL',
              //   'PAGADO'
              // ]);

              bodyData.push([
                { text: 'CODIGO GENERACION', bold: true,  alignment: 'left' },
                { text: 'NUMERO DE CONTROL', bold: true,  alignment: 'left' },
                { text: 'SELLO DE RECEPCION', bold: true,  alignment: 'left' },
                // { text: 'TIPO', bold: true,  alignment: 'left' },
                { text: 'FECHA', bold: true,  alignment: 'left' },
                { text: 'CLIENTE', bold: true,  alignment: 'left' },
                // { text: 'PAGO', bold: true,  alignment: 'left' },
                { text: '', bold: true,  alignment: 'left' },
                { text: 'GRAVADO', bold: true,  alignment: 'right' },
                { text: 'EXENTO', bold: true,  alignment: 'right' },
                { text: 'IVA', bold: true,  alignment: 'right', fillColor: '#d9f7be' },
                { text: 'FOVIAL', bold: true,  alignment: 'right', fillColor: '#efdbff' },
                { text: 'COTRANS', bold: true,  alignment: 'right', fillColor: '#ffd6e7' },
                { text: 'IVAPERC', bold: true,  alignment: 'right' },
                { text: 'IVARETE', bold: true,  alignment: 'right' },
                { text: 'TOTAL', bold: true,  alignment: 'right' },
                // { text: 'PAGADO', bold: true,  alignment: 'right' }
              ]);
          
              for(const element of (result || [])) {
                bodyData.push([
                  { text: element?.generationCode || '', bold: false },
                  { text: element?.controlNumber || '', bold: false },
                  { text: element?.receptionStamp || '', bold: false },
                  // { text: element?.documentTypeName || '', bold: false },
                  { text: dayjs(element?.docDatetime).format('DD-MM-YYYY') || '', bold: false },
                  { text: element?.customerFullname || '', bold: false },
                  // { text: element?.paymentTypeName || '', bold: false },
                  { text: !!+element?.isVoided ? 'Anulada' : '' || '', bold: false },
                  { text: Number(element?.taxableSubTotalWithoutTaxes).toFixed(2) || '0.00', bold: false, alignment: 'right' },
                  { text: Number(element?.noTaxableSubTotal).toFixed(2) || '0.00', bold: false, alignment: 'right' },
                  { text: Number(element?.ivaTaxAmount).toFixed(2) || '0.00', bold: false, alignment: 'right', fillColor: '#f6ffed' },
                  { text: Number(element?.fovialTaxAmount).toFixed(2) || '0.00', bold: false, alignment: 'right', fillColor: '#f9f0ff' },
                  { text: Number(element?.cotransTaxAmount).toFixed(2) || '0.00', bold: false, alignment: 'right', fillColor: '#fff0f6' },
                  { text: Number(element?.IVAperception).toFixed(2) || '0.00', bold: false, alignment: 'right' },
                  { text: Number(element?.IVAretention).toFixed(2) || '0.00', bold: false, alignment: 'right' },
                  { text: Number(element?.total).toFixed(2) || '0.00', bold: false, alignment: 'right' },
                  // { text: +element?.saleTotalPaid || '0.00', bold: false, alignment: 'right' }
                ]);
              }

              bodyData.push([
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                // { text: '', bold: false },
                { text: '', bold: false },
                { text: 'TOTAL', bold: false, fillColor: '#bae0ff' },
                // { text: '', bold: false },
                { text: '', bold: false, fillColor: '#bae0ff' },
                { text: getDataSumByProperty('taxableSubTotalWithoutTaxes'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('noTaxableSubTotal'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('ivaTaxAmount'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('fovialTaxAmount'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('cotransTaxAmount'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('IVAperception'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('IVAretention'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right', fillColor: '#bae0ff' },
                // { text: getDataSumByProperty('saleTotalPaid'), bold: false, alignment: 'right' }
              ]);
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'REPORTE FACTURAS EMITIDAS - RESULTADOS POR CLIENTE', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: `PARAMETRO DE BUSQUEDA: ${customerIdentifier}`, alignment: 'left', margin: [40, 0, 40, 0] }
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
                      widths: ['17%', '14%', '21%', '4.9%', '8.9%', '3.8%', '3.8%', '3.8%', '3.8%', '3.8%', '3.8%', '3.8%', '3.8%', '3.8%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LEGAL',
                pageOrientation: 'landscape',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=ReporteVentasEmitidasPorCorrelativo.pdf');

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

controller.pdfDocs.findByProductIdentifier = (req, res) => {
  let result = [];

  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { productIdentifier } = req.params;

      conn.query(
        queries.findByProductIdentifier,
        [ productIdentifier || 0, productIdentifier || '' ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          result = queryRows;

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
          
              const bodyData = [];
              bodyData.push([
                'CODIGO',
                'TIPO',
                'CORRELATIVO',
                'FECHA',
                'CLIENTE',
                'PAGO',
                'ANULADA',
                'TOTAL',
                'PAGADO'
              ]);
          
              for(const element of (result || [])) {
                bodyData.push([
                  { text: element?.id || '', bold: false },
                  { text: element?.documentTypeName || '', bold: false },
                  { text: element?.docNumber || '', bold: false },
                  { text: element?.docDatetime || '', bold: false },
                  { text: element?.customerFullname || '', bold: false },
                  { text: element?.paymentTypeName || '', bold: false },
                  { text: !!+element?.isVoided ? 'Anulada' : '' || '', bold: false },
                  { text: +element?.total || '', bold: false, alignment: 'right' },
                  { text: +element?.saleTotalPaid || '', bold: false, alignment: 'right' }
                ]);
              }

              bodyData.push([
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: 'TOTAL', bold: false },
                { text: '', bold: false },
                { text: '', bold: false },
                { text: getDataSumByProperty('total'), bold: false, alignment: 'right' },
                { text: getDataSumByProperty('saleTotalPaid'), bold: false, alignment: 'right' }
              ]);
          
              const docDefinition = {
                header: function(currentPage, pageCount, pageSize) {
                  // Podemos tener hasta cuatro líneas de encabezado de página
                  return [
                    { text: 'REPORTE FACTURAS EMITIDAS - RESULTADOS POR PRODUCTO', alignment: 'left', margin: [40, 30, 40, 0] },
                    { text: `PARAMETRO DE BUSQUEDA: ${productIdentifier}`, alignment: 'left', margin: [40, 0, 40, 0] }
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
                      widths: ['10%', '10%', '10%', '10%', '20%', '10%', '10%', '10%', '10%'],
                      body: bodyData
                    }
                  }
                ],
                defaultStyle: {
                  font: 'Roboto',
                  fontSize: 6
                },
                pageSize: 'LETTER',
                pageOrientation: 'landscape',
                pageMargins: [ 40, 60, 40, 60 ]
              };
              
              const options = {};

              const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename=ReporteVentasEmitidasPorCorrelativo.pdf');

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

controller.excelDocs = {};

controller.excelDocs.findByDocNumber = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { docNumber, documentTypeId } = req.params;

      conn.query(
        queries.findByDocNumber,
        [ docNumber || '', documentTypeId || 0, documentTypeId || 0 ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granTotalSale = 0;
              let granTotalSalePaid = 0;

              let colNameWidth = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 9, true).string(`REPORTE FACTURAS EMITIDAS - RESULTADOS POR CORRELATIVO`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 9, true).string(`PARAMETRO DE BUSQUEDA: ${docNumber}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('CODIGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('TIPO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('CORRELATIVO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 5).string('CLIENTE').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 6).string('PAGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 7).string('ANULADA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 8).string('TOTAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('PAGADO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (result || []).entries()) {
                ws.cell(nextRow, 1).number(+value?.id || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 2).string(value?.documentTypeName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 3).string(value?.docNumber || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).string(value?.docDatetime || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 5).string(value?.customerFullname || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 6).string(value?.paymentTypeName || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 7).string(!!+value?.isVoided ? 'Anulada' : '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 8).number(+value?.total || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+value?.saleTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                nextRow++;

                granTotalSale += +value?.total || 0;
                granTotalSalePaid += +value?.saleTotalPaid || 0;

                if (String(value?.customerFullname).length > colNameWidth) colNameWidth = String(value?.customerFullname).length;
              }

              ws.cell(nextRow, 1).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 2).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 3).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 5).string('TOTAL').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 6).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 7).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 8).number(granTotalSale || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 9).number(granTotalSalePaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              nextRow++;

              ws.column(5).setWidth(+colNameWidth);
              
              wb.write('ReporteVentasEmitidasPorCorrelativo.xlsx', res);
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

controller.excelDocs.findByCustomerIdentifier = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { customerIdentifier, startDate, endDate } = req.params;

      conn.query(
        queries.findByCustomerIdentifier,
        [ customerIdentifier || 0, customerIdentifier || 0, `%${customerIdentifier || ''}%`, startDate, endDate ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granTaxableSubTotalWithoutTaxes = 0;
              let granNoTaxableSubTotal = 0;
              let granIvaTaxAmount = 0;
              let granFovialTaxAmount = 0;
              let granCotransTaxAmount = 0;
              let granIVAperception = 0;
              let granIVAretention = 0;
              let granTotal = 0;

              let colNameWidth = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 14, true).string(`REPORTE FACTURAS EMITIDAS - RESULTADOS POR CLIENTE`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 14, true).string(`PARAMETRO DE BUSQUEDA: ${customerIdentifier}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('CODIGO GENERACION').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('NUMERO DE CONTROL').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('SELLO DE RECEPCION').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 5).string('CLIENTE').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 6).string('').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 7).string('GRAVADO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 8).string('EXENTO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('IVA').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 10).string('FOVIAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 11).string('COTRANS').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 12).string('IVAPERC').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 13).string('IVARETE').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 14).string('TOTAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (result || []).entries()) {
                ws.cell(nextRow, 1).string(value?.generationCode || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 2).string(value?.controlNumber || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 3).string(value?.receptionStamp || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).string(value?.docDatetime || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 5).string(value?.customerFullname || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 6).string(!!+value?.isVoided ? 'Anulada' : '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 7).number(+value?.taxableSubTotalWithoutTaxes || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 8).number(+value?.noTaxableSubTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+value?.ivaTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 10).number(+value?.fovialTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 11).number(+value?.cotransTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 12).number(+value?.IVAperception || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 13).number(+value?.IVAretention || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 14).number(+value?.total || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                nextRow++;
                
                granTaxableSubTotalWithoutTaxes += +value?.taxableSubTotalWithoutTaxes || 0;
                granNoTaxableSubTotal += +value?.noTaxableSubTotal || 0;
                granIvaTaxAmount += +value?.ivaTaxAmount || 0;
                granFovialTaxAmount += +value?.fovialTaxAmount || 0;
                granCotransTaxAmount += +value?.cotransTaxAmount || 0;
                granIVAperception += +value?.IVAperception || 0;
                granIVAretention += +value?.IVAretention || 0;
                granTotal += +value?.total || 0;

                if (String(value?.customerFullname).length > colNameWidth) colNameWidth = String(value?.customerFullname).length;
              }

              ws.cell(nextRow, 1).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 2).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 3).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 5).string('TOTAL').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 6).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 7).number(granTaxableSubTotalWithoutTaxes || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 8).number(granNoTaxableSubTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 9).number(granIvaTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 10).number(granFovialTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 11).number(granCotransTaxAmount || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 12).number(granIVAperception || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 13).number(granIVAretention || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 14).number(granTotal || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              ws.column(5).setWidth(+colNameWidth);
              
              wb.write('ReporteVentasEmitidasPorCliente.xlsx', res);
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

controller.excelDocs.findByProductIdentifier = (req, res) => {
  req.getConnection((error, conn) => {
    if (error) 
      res.status(500).json(errorResponses.status500(error));

    conn.beginTransaction((transactionError) => {
      if (transactionError) res.status(500).json(errorResponses.status500(error));

      const { productIdentifier } = req.params;

      conn.query(
        queries.findByProductIdentifier,
        [ productIdentifier || 0, productIdentifier || '' ],
        (queryError, queryRows) => {
          if (queryError)
            conn.rollback(() => res.status(500).json(errorResponses.status500(queryError)));

          let result = queryRows;

          conn.commit((commitError) => {
            if (commitError) conn.rollback(() => { res.status(500).json(errorResponses.status500(queryError)); });

            try {
              let nextRow = 1;

              let granTotalSale = 0;
              let granTotalSalePaid = 0;

              let colNameWidth = 0;

              let wb = new xl.Workbook();

              let headerStyle = wb.createStyle(excelHeaderStyle);
              let contentStyle = wb.createStyle(excelBodyStyle);

              // Add Worksheets to the workbook
              let ws = wb.addWorksheet('Sheet 1');

              ws.cell(nextRow, 1, nextRow, 9, true).string(`REPORTE FACTURAS EMITIDAS - RESULTADOS POR PRODUCTO`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1, nextRow, 9, true).string(`PARAMETRO DE BUSQUEDA: ${productIdentifier}`).style({ ...headerStyle, alignment: { horizontal: 'left' } });
              nextRow++;
              ws.cell(nextRow, 1).string('CODIGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 2).string('TIPO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 3).string('CORRELATIVO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 4).string('FECHA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 5).string('CLIENTE').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 6).string('PAGO').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 7).string('ANULADA').style({ ...headerStyle, alignment: { horizontal: 'left' } });
              ws.cell(nextRow, 8).string('TOTAL').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              ws.cell(nextRow, 9).string('PAGADO').style({ ...headerStyle, alignment: { horizontal: 'right' } });
              nextRow++;
              
              for(const [index, value] of (result || []).entries()) {
                ws.cell(nextRow, 1).number(+value?.id || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 2).string(value?.documentTypeName || '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 3).string(value?.docNumber || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 4).string(value?.docDatetime || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 5).string(value?.customerFullname || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 6).string(value?.paymentTypeName || 0).style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 7).string(!!+value?.isVoided ? 'Anulada' : '').style({ ...contentStyle, alignment: { horizontal: 'left' }});
                ws.cell(nextRow, 8).number(+value?.total || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                ws.cell(nextRow, 9).number(+value?.saleTotalPaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
                nextRow++;
                
                granTotalSale += +value?.total || 0;
                granTotalSalePaid += +value?.saleTotalPaid || 0;

                if (String(value?.customerFullname).length > colNameWidth) colNameWidth = String(value?.customerFullname).length;
              }

              ws.cell(nextRow, 1).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 2).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 3).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 4).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 5).string('TOTAL').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 6).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 7).string('').style({ ...contentStyle, alignment: { horizontal: 'left' }});
              ws.cell(nextRow, 8).number(granTotalSale || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});
              ws.cell(nextRow, 9).number(granTotalSalePaid || 0).style({ ...contentStyle, alignment: { horizontal: 'right' }});

              ws.column(5).setWidth(+colNameWidth);
              
              wb.write('ReporteVentasEmitidasPorProducto.xlsx', res);
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
