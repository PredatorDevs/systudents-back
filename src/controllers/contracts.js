import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT * FROM vw_contracts WHERE isActive = 1;`,
  findById: `
    SELECT * FROM vw_contracts WHERE contractId = ?;
    SELECT * FROM vw_contractdetails WHERE contractId = ?;
    SELECT * FROM vw_contractpaymentplans WHERE contractId = ?;
    SELECT * FROM contractbeneficiaries WHERE contractId = ?;
  `,
  changeStatus: `
    UPDATE contracts SET status = ? WHERE id = ?;
  `,
  add: `
    INSERT INTO contracts (
      locationId,
      customerId,
      status,
      contractDatetime,
      total,
      downPayment,
      numberOfPayments,
      comments,
      createdBy,
      updatedBy
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    );  
  `,
  details: {
    add: `
      INSERT INTO contractdetails (
        contractId,
        productId,
        unitPrice,
        quantity,
        createdBy,
        updatedBy
      ) VALUES ?;
    `
  },
  beneficiaries: {
    add: `
      INSERT INTO contractbeneficiaries (
        contractId,
        relationshipId,
        fullname,
        age,
        gender,
        address,
        createdBy,
        updatedBy
      ) VALUES ?;    
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { contractId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ contractId || 0, contractId || 0, contractId || 0, contractId || 0 ], res));
}

controller.changeStatus = (req, res) => {
  const { contractId, newStatus } = req.params;
  req.getConnection(connUtil.connFunc(queries.changeStatus, [ newStatus || 1, contractId || 0 ], res));
}

controller.add = (req, res) => {
  const { idtoauth } = req.headers;

  const {
    locationId,
    customerId,
    status,
    contractDatetime,
    total,
    downPayment,
    numberOfPayments,
    comments
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.add,
      [
        locationId,
        customerId,
        status,
        contractDatetime,
        total,
        downPayment,
        numberOfPayments,
        comments,
        idtoauth, // createdBy,
        idtoauth // updatedBy
      ],
      res
    )
  );
}

controller.details = {};

controller.details.add = (req, res) => {
  // EXPECTED: [[ contractId, productId, unitPrice, quantity, createdBy, updatedBy ], [...]]
  const { bulkData } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.details.add,
      [ bulkData ],
      res
    )
  );
}

controller.beneficiaries = {};

controller.beneficiaries.add = (req, res) => {
  // EXPECTED: [[ contractId, relationshipId, fullname, age, gender, address, createdBy, updatedBy ], [...]]
  const { bulkData } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.beneficiaries.add,
      [ bulkData ],
      res
    )
  );
}

export default controller;
