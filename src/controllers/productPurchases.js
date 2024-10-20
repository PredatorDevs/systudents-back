import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_productpurchases ORDER BY productPurchaseId DESC;
  `,
  findById: `
    SELECT * FROM vw_productpurchases WHERE productPurchaseId = ?;
  `,
  /*
    prmt_location 
    prmt_supplierid
    prmt_documenttype
    prmt_paymenttype
    prmt_paymentmethod
    prmt_docdatetime
    prmt_docnumber
    prmt_total
    prmt_registeredby
  */

  findPendings: `SELECT * FROM vw_pendingproductpurchasesuppliers;`,
  findPendingsByLocation: `SELECT * FROM vw_pendingproductpurchasesuppliers WHERE productPurchaseLocationId = ?;`,
  findPendingAmountToPay: `SELECT ROUND((IFNULL(total, 0) - fn_getproductpurchasetotalpaid(id)), 2) AS pendingAmount FROM productpurchases WHERE id = ?;`,
  add: `
    CALL usp_CreateNewProductPurchase(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  voidProductPurchase: `CALL usp_VoidProductPurchase(?, ?);`,
  findByLocationMonth: `
    SELECT
      UUID() AS identifier,
      ROW_NUMBER() OVER(ORDER BY pp.documentDatetime) AS rowNum,
      'pp' AS purchaseType,
      pp.id,
      pp.documentTypeId,
      d.name AS documentTypeName,
      pp.documentNumber,
      pp.documentDatetime,
      s.name AS supplierName,
      p.name AS paymentTypeName,
      pp.isVoided,
      pp.total,
      fn_getproductpurchasetotalpaid(pp.id) AS purchaseTotalPaid,
      pp.productDistributionId AS itemDistributionId
    FROM
      productpurchases pp
      INNER JOIN documenttypes d ON pp.documentTypeId = d.id
      INNER JOIN paymenttypes p ON pp.paymentTypeId = p.id
      INNER JOIN suppliers s ON pp.supplierId = s.id
    WHERE
      pp.locationId = ?
      AND DATE_FORMAT(pp.documentDatetime, '%Y-%m') = ?
      AND pp.isActive = 1
    ORDER BY rowNum;
  `,
  details: {
    findByProductPurchaseId: `
      SELECT 
        *
      FROM
        vw_productpurchasedetails
      WHERE
        productPurchaseId = ?;
    `,
    add: `
      INSERT INTO productpurchasedetails (productPurchaseId, productId, unitCost, quantity, isBonus) VALUES ?;
    `
  },
  payments: {
    add: `
      CALL usp_CreateNewProductPurchasePayment (?, ?, ?, UTC_TIMESTAMP(), ?, ?);
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { productPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ productPurchaseId || 0 ], res));
}

controller.findByLocationCurrentActiveShiftcut = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationCurrentActiveShiftcut, [ locationId || 0 ], res));
}

controller.findPendings = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findPendings, [], res));
}

controller.findPendingsByLocation = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingsByLocation, [ locationId ], res));
}

controller.findPendingAmountToPay = (req, res) => {
  const { productPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingAmountToPay, [ productPurchaseId ], res));
}

controller.add = (req, res) => {
  /*
    prmt_location 
    prmt_supplierid
    prmt_documenttype+
    prmt_paymenttype
    prmt_paymentmethod
    prmt_docdatetime
    prmt_docnumber
    prmt_docorderpurnumber
    prmt_total
    prmt_registeredby,
    prmt_IVAretention,
    prmt_IVAperception
  */
  const { idtoauth } = req.headers;
  
  const {
    locationId,
    supplierId,
    documentTypeId,
    paymentTypeId,
    paymentMethodId,
    docDatetime,
    docNumber,
    docOrderPurchaseNumber,
    total,
    IVAretention,
    IVAperception,
    expirationDays,
    userPINCode,
    productDistributionId,
    notes
  } = req.body;
  
  req.getConnection(
    connUtil.connSPFunc(
      queries.add,
      [
        locationId || 1,
        supplierId,
        documentTypeId || 1,
        paymentTypeId || 1,
        paymentMethodId || 1,
        docDatetime,
        docNumber,
        docOrderPurchaseNumber,
        total,
        idtoauth,
        IVAretention || 0,
        IVAperception || 0,
        expirationDays || 8,
        userPINCode,
        productDistributionId,
        notes
      ],
      res
    )
  );
}

controller.voidProductPurchase = (req, res) => {
  const { userId, productPurchaseId } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.voidProductPurchase, [ userId, productPurchaseId ], res));
}

controller.findByLocationMonth = (req, res) => {
  const { locationId, dateToSearch } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationMonth, [ locationId, dateToSearch ], res));
}


// SALE DETAILS

controller.details = {};

controller.details.findByProductPurchaseId = (req, res) => {
  const { productPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findByProductPurchaseId, [ productPurchaseId || 0 ], res));
}

// EXPECTED req.body => details = [[productPurchaseId, productId, unitCost, quantity], [...]]
controller.details.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ bulkData ], res));
}

controller.payments = {};

controller.payments.add = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, cashierId, productPurchaseId, paymentAmount } = req.body;
  req.getConnection(connUtil.connFunc(queries.payments.add, [ locationId, cashierId, idtoauth, productPurchaseId, paymentAmount ], res));
}

export default controller;
