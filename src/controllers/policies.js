import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT * FROM vw_policies ORDER BY docDatetime DESC LIMIT 200;`,
  findById: `
    SELECT * FROM vw_policies WHERE policyId = ?;
    SELECT * FROM vw_policydetails WHERE policyId = ?;
  `,
  add: `
    INSERT INTO policies (
      locationId,
      shiftcutId,
      docNumber,
      docDatetime,
      supplier,
      transactionValue,
      transportationCost,
      insuranceCost,
      customTotalValue,
      incoterm,
      exchangeRate,
      createdBy
    ) VALUES (?, fn_getlocationcurrentactiveshiftcut(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  update: `
    UPDATE policies
    SET
      locationId = IFNULL(?, locationId),
      shiftcutId = IFNULL(?, shiftcutId),
      docNumber = IFNULL(?, docNumber),
      docDatetime = IFNULL(?, docDatetime),
      supplier = IFNULL(?, supplier),
      transactionValue = IFNULL(?, transactionValue),
      transportationCost = IFNULL(?, transportationCost),
      insuranceCost = IFNULL(?, insuranceCost),
      customTotalValue = IFNULL(?, customTotalValue),
      incoterm = IFNULL(?, incoterm),
      exchangeRate = IFNULL(?, exchangeRate)
    WHERE id = ?;
  `,
  remove: `UPDATE policies SET isActive = 0 WHERE id = ?;`,
  voidPolicy: `CALL usp_VoidPolicy(?, ?);`,
  details: {
    find: `SELECT * FROM vw_policydetails;`,
    findByPolicyId: `SELECT * FROM vw_policydetails WHERE policyId = ?;`,
    add: `
      INSERT INTO policydetails (
        policyId,
        productId,
        measurementUnitId,
        quantity,
        unitCost
      ) VALUES (?, ?, ?, ?, ?);
    `,
    update: `
      UPDATE policydetails
      SET 
        policyId = IFNULL(?, policyId),
        productId = IFNULL(?, productId),
        measurementUnitId = IFNULL(?, measurementUnitId),
        quantity = IFNULL(?, quantity),
        unitCost = IFNULL(?, unitCost)
      WHERE id = ?;
    `,
    remove: `UPDATE policydetails SET isActive = 0 WHERE id = ?;`,
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { policyId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ policyId || 0, policyId || 0 ], res));
}

controller.add = (req, res) => {
  const { 
    locationId, docNumber, docDatetime, supplier, transactionValue, transportationCost, insuranceCost, customTotalValue, incoterm, exchangeRate, createdBy 
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.add, 
      [ locationId, locationId, docNumber, docDatetime, supplier, transactionValue, transportationCost, insuranceCost, customTotalValue, incoterm, exchangeRate, createdBy ], 
      res
    )
  );
}

controller.update = (req, res) => {
  const { 
    locationId, shiftcutId, docNumber, docDatetime, supplier, transactionValue, transportationCost, insuranceCost, customTotalValue, incoterm, exchangeRate, policyId 
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.update, 
      [ locationId, shiftcutId, docNumber, docDatetime, supplier, transactionValue, transportationCost, insuranceCost, customTotalValue, incoterm, exchangeRate, policyId || 0 ], 
      res
    )
  );
}

controller.remove = (req, res) => {
  const { policyId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ policyId || 0 ], res));
}

controller.voidPolicy = (req, res) => {
  const { voidedBy, policyId } = req.body;
  req.getConnection(connUtil.connFunc(queries.voidPolicy, [ voidedBy, policyId || 0 ], res));
}

controller.details = {};

controller.details.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.details.find, [], res));
}

controller.details.findByPolicyId = (req, res) => {
  const { policyId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findByPolicyId, [ policyId ], res));
}

controller.details.add = (req, res) => {
  const {
    policyId, productId, measurementUnitId, quantity, unitCost
  } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ policyId, productId, measurementUnitId, quantity, unitCost ], res));
}

controller.details.update = (req, res) => {
  const {
    policyId, productId, measurementUnitId, quantity, unitCost, policyDetailId
  } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.update, [ policyId, productId, measurementUnitId, quantity, unitCost, policyDetailId ], res));
}

controller.details.remove = (req, res) => {
  const { policyDetailId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.remove, [ policyDetailId ], res));
}

export default controller;
