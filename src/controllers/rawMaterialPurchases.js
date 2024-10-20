import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_rawmaterialpurchases ORDER BY rawMaterialPurchaseId DESC;
  `,
  findById: `
    SELECT * FROM vw_rawmaterialpurchases WHERE rawMaterialPurchaseId = ?;
  `,
  findPendings: `SELECT * FROM vw_pendingrawmaterialpurchasesuppliers;`,
  findPendingsByLocation: `SELECT * FROM vw_pendingrawmaterialpurchasesuppliers WHERE rawMaterialPurchaseLocationId = ?;`,
  findPendingAmountToPay: `SELECT ROUND((IFNULL(total, 0) - fn_getrawmaterialpurchasetotalpaid(id)), 2) AS pendingAmount FROM rawmaterialpurchases WHERE id = ?;`,
  add: `
    CALL usp_CreateNewRawMaterialPurchase(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  voidRawMaterialPurchase: `CALL usp_VoidRawMaterialPurchase(?, ?);`,
  findByLocationMonth: `
    SELECT
      UUID() AS identifier,
      ROW_NUMBER() OVER(ORDER BY pp.documentDatetime) AS rowNum,
      'rmp' AS purchaseType,
      pp.id,
      pp.documentTypeId,
      d.name AS documentTypeName,
      pp.documentNumber,
      pp.documentDatetime,
      s.name AS supplierName,
      p.name AS paymentTypeName,
      pp.total,
      fn_getrawmaterialpurchasetotalpaid(pp.id) AS purchaseTotalPaid,
      pp.rawMaterialDistributionId AS itemDistributionId
    FROM
      rawmaterialpurchases pp
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
    findByRawMaterialPurchaseId: `
      SELECT 
        *
      FROM
        vw_rawmaterialpurchasedetails
      WHERE
        rawMaterialPurchaseId = ?;
    `,
    add: `
      INSERT INTO rawmaterialpurchasedetails (rawMaterialPurchaseId, rawMaterialId, unitCost, quantity, isBonus) VALUES ?;
    `
  },
  payments: {
    add: `
      CALL usp_CreateNewRawMaterialPurchasePayment (?, ?, ?, UTC_TIMESTAMP(), ?, ?);
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { rawMaterialPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ rawMaterialPurchaseId || 0 ], res));
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
  const { rawMaterialPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingAmountToPay, [ rawMaterialPurchaseId ], res));
}

controller.add = (req, res) => {
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
    rawMaterialDistributionId,
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
        rawMaterialDistributionId,
        notes
      ],
      res
    )
  );
}

controller.voidRawMaterialPurchase = (req, res) => {
  const { userId, rawMaterialPurchaseId } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.voidRawMaterialPurchase, [ userId, rawMaterialPurchaseId ], res));
}

controller.findByLocationMonth = (req, res) => {
  const { locationId, dateToSearch } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationMonth, [ locationId, dateToSearch ], res));
}

// SALE DETAILS

controller.details = {};

controller.details.findByRawMaterialPurchaseId = (req, res) => {
  const { rawMaterialPurchaseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findByRawMaterialPurchaseId, [ rawMaterialPurchaseId || 0 ], res));
}

// EXPECTED req.body => details = [[rawMaterialPurchaseId, rawMaterialId, unitCost, quantity], [...]]
controller.details.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ bulkData ], res));
}

controller.payments = {};

controller.payments.add = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, cashierId, rawMaterialPurchaseId, paymentAmount } = req.body;
  req.getConnection(connUtil.connFunc(queries.payments.add, [ locationId, cashierId, idtoauth, rawMaterialPurchaseId, paymentAmount ], res));
}

export default controller;
