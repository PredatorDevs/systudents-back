import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT * FROM vw_shitfcuts;`,
  findById: `SELECT * FROM vw_shitfcuts WHERE shiftcutId = ?;`,
  settlements: `
    SELECT shiftcutId, shiftcutNumber, openedAt, closedAt, initialAmount, finalAmount, remittedAmount, shiftcutDatetime FROM vw_shitfcuts
    WHERE shiftcutStatus = 2
    ORDER BY shiftcutId DESC;
  `,
  settlementsById: `
    CALL usp_SettlementByShiftcut(?);
  `,
  settlementsByLocation: `
    SELECT 
      cashierName, shiftcutId, shiftcutNumber, openedAt, closedAt, 
      initialAmount, finalAmount, remittedAmount, shiftcutDatetime,
      locationName
    FROM 
      vw_shitfcuts
    WHERE 
      locationId = ?
      AND shiftcutStatus = 2
    ORDER BY
      shiftcutId DESC;
  `,
  settlementsByLocationCashierDate: `
    SELECT 
      shiftcut.cashierName,
      shiftcut.shiftcutId,
      shiftcut.shiftcutNumber,
      shiftcut.openedAt,
      shiftcut.closedAt, 
      shiftcut.initialAmount,
      shiftcut.finalAmount,
      shiftcut.remittedAmount,
      shiftcut.shiftcutDatetime,
      shiftcut.locationName,
      (SELECT SUM(vs.total) FROM vw_sales vs WHERE vs.shiftcutId = shiftcut.shiftcutId) AS totalSale
    FROM 
      vw_shitfcuts shiftcut
    WHERE 
      shiftcut.locationId = ?
      AND shiftcut.cashierId = ?
      AND shiftcut.shiftcutStatus = 2
      AND date_format(shiftcut.closedAt, '%Y-%m-%d') = ?
    ORDER BY
      shiftcut.shiftcutId DESC;
  `,
  settlementsByLocationCashierMonthDate: `
    SELECT
      shiftcut.locationId,
      shiftcut.locationName,
      shiftcut.cashierId,
      shiftcut.cashierName,
      -- shiftcutId,
      -- shiftcutNumber,
      date_format(shiftcut.closedAt, '%Y-%m-%d') AS closedAtFormatted,
      MIN(shiftcut.openedAt) AS openedAt,
      MAX(shiftcut.closedAt) AS closedAt,
        MIN(shiftcut.shiftcutId) AS prevShiftcutId,
        MAX(shiftcut.shiftcutId) AS lastShiftcutId,
      MIN(shiftcut.shiftcutNumber) AS prevShiftcutNumber,
      MAX(shiftcut.shiftcutNumber) AS lastShiftcutNumber,
      SUM(shiftcut.initialAmount) AS initialAmount,
      SUM(shiftcut.finalAmount) AS finalAmount,
      SUM(shiftcut.remittedAmount) AS remittedAmount,
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
      shiftcut.locationId = ?
      AND shiftcut.cashierId = ?
      AND shiftcut.shiftcutStatus = 2
      AND date_format(shiftcut.closedAt, '%Y-%m') = ?
    GROUP BY
      shiftcut.locationId,
      shiftcut.locationName,
      shiftcut.cashierId,
      shiftcut.cashierName,
      date_format(shiftcut.closedAt, '%Y-%m-%d');
  `,
  settlementsOrderSaleById: `
    CALL usp_SettlementOrderSaleByShiftcut(?);
  `,
}

controller.find = (req, res) => req.getConnection(connUtil.connFunc(queries.find, [], res));

controller.findById = (req, res) => {
  const { shiftcutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ shiftcutId ], res));
}

controller.settlements = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.settlements, [ ], res));
}

controller.settlementsById = (req, res) => {
  const { shiftcutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.settlementsById, [ shiftcutId ], res));
}

controller.settlementsByLocation = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.settlementsByLocation, [ locationId ], res));
}

controller.settlementsByLocationCashierDate = (req, res) => {
  const {
    locationId,
    cashierId,
    dateFilter
  } = req.params;
  
  req.getConnection(connUtil.connFunc(queries.settlementsByLocationCashierDate, [ locationId, cashierId, dateFilter ], res));
}

controller.settlementsByLocationCashierMonthDate = (req, res) => {
  const {
    locationId,
    cashierId,
    monthDateFilter
  } = req.params;

  req.getConnection(connUtil.connFunc(queries.settlementsByLocationCashierMonthDate, [ locationId, cashierId, monthDateFilter ], res));
}

controller.settlementsOrderSaleById = (req, res) => {
  const { shiftcutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.settlementsOrderSaleById, [ shiftcutId ], res));
}

export default controller;
