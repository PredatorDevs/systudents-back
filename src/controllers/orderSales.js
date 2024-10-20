import connUtil from "../helpers/connectionUtil.js";
import errorResponses from "../helpers/errorResponses.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_ordersales;
  `,
  findById: `
    SELECT * FROM vw_ordersales WHERE id = ?;
  `,
  add: `
    CALL usp_CreateNewOrderSale(?, ?, ?, ?, ?, ?, ?, ?);
  `,
  update: `
    UPDATE ordersales
    SET
      locationId = IFNULL(?, locationId),
      customerId = IFNULL(?, customerId),
      documentDatetime = IFNULL(?, documentDatetime),
      documentTypeId = IFNULL(?, documentTypeId),
      paymentTypeId = IFNULL(?, paymentTypeId),
      status = IFNULL(?, status),
      total = IFNULL(?, total),
      createdBy = IFNULL(?, createdBy),
      userPINCode = IFNULL(?, userPINCode)
    WHERE
      id = ?;
  `,
  changeStatus: `
    UPDATE ordersales SET status = ? WHERE id = ?;
  `,
  remove: `
    UPDATE ordersales SET isActive = 0 WHERE id = ?;
    UPDATE ordersaledetails SET isActive = 0 WHERE orderSaleId = ?;
  `,
  consolidate: `
    UPDATE ordersales SET status = 2, saleId = ? WHERE id = ?;
  `,
  details: {
    findByOrderSaleId: `
      SELECT 
        detail.id, 
        detail.orderSaleId, 
        detail.productId, 
        detail.unitPrice,
        ROUND(detail.quantity, 2) AS quantity,
        (detail.unitPrice * detail.quantity) AS subTotal,
        fn_getproducttaxes(detail.productId) AS productTaxesData,
        prod.\`name\` as productName,
        prod.isTaxable AS productIsTaxable
      FROM
        ordersaledetails detail
        INNER JOIN products prod ON detail.productId = prod.id
      WHERE 
        detail.orderSaleId = ? AND detail.isActive = 1;
    `,
    add: `
      INSERT INTO ordersaledetails (orderSaleId, productId, unitPrice, quantity) VALUES ?;
    `,
    update: `
      UPDATE ordersaledetails
      SET
        orderSaleId = IFNULL(?, orderSaleId),
        productId = IFNULL(?, productId),
        unitPrice = IFNULL(?, unitPrice),
        quantity = IFNULL(?, quantity)
      WHERE
        id = ?;
    `,
    remove: `
      UPDATE ordersaledetails SET isActive = 0 WHERE id = ?;
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { orderSaleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ orderSaleId || 0 ], res));
}

controller.add = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, customerId, documentDatetime, documentType, paymentType, total, userPINCode } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.add, [ locationId || 1, customerId, documentDatetime, documentType || 1, paymentType || 1, total, idtoauth, userPINCode ], res));
}

controller.update = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, customerId, docDatetime, documentType, paymentType, status, total, userPINCode, orderSaleId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ locationId, customerId, docDatetime, documentType, paymentType, status, total, idtoauth, userPINCode, orderSaleId || 0 ], res));
}

controller.changeStatus = (req, res) => {
  // const { idtoauth } = req.headers;
  const { newStatus, orderSaleId } = req.body;
  req.getConnection(connUtil.connFunc(queries.changeStatus, [ newStatus, orderSaleId || 0 ], res));
}

controller.consolidate = (req, res) => {
  // const { idtoauth } = req.headers;
  const { saleId, orderSaleId } = req.body;
  req.getConnection(connUtil.connFunc(queries.consolidate, [ saleId || 0, orderSaleId || 0 ], res));
}

controller.remove = (req, res) => {
  const { orderSaleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ orderSaleId || 0, orderSaleId || 0 ], res));
}

// SALE DETAILS

controller.details = {};

controller.details.findByOrderSaleId = (req, res) => {
  const { orderSaleId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findByOrderSaleId, [ orderSaleId || 0 ], res));
}

// EXPECTED req.body => details = [[orderSaleId, productId, unitPrice, quantity], [...]]
controller.details.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ bulkData ], res));
}

controller.details.update = (req, res) => {
  const { orderSaleId, productId, unitPrice, quantity, orderSaleDetailId } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.update, [ orderSaleId, productId, unitPrice, quantity, orderSaleDetailId ], res));
}

controller.details.remove = (req, res) => {
  const { orderSaleDetailId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.remove, [ orderSaleDetailId || 0 ], res));
}

export default controller;
