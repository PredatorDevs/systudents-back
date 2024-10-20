import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name, ROUND(cost, 2) AS cost FROM furnishings WHERE isActive = 1;`,
  findByLocationStockData: `
    SELECT furnishings.id, furnishings.name, ROUND(furnishings.cost, 2) AS cost,
    ROUND((SELECT stock FROM furnishingstocks WHERE furnishingId = furnishings.id AND locationId = ?), 2) AS currentLocationStock
    FROM furnishings WHERE isActive = 1;  
  `,
  findCurrentStock: `
    SELECT * FROM vw_furnishingcurrentstocks
    ORDER BY furnishingName;
  `,
  add: `INSERT INTO furnishings (name, cost) VALUES (?, ?);`,
  update: `UPDATE furnishings SET name = IFNULL(?, name), cost = IFNULL(?, cost) WHERE id = ?;`,
  remove: `UPDATE furnishings SET isActive = 0 WHERE id = ?;`,
  stocks: {
    findByFurnishingId: `SELECT * FROM vw_furnishingstocks WHERE furnishingId = ?;`,
    updateById: `UPDATE furnishingstocks SET initialStock = ?, stock = ? WHERE id = ?;`
  },
}

controller.find = (req, res) => req.getConnection(connUtil.connFunc(queries.find, [], res));

controller.findByLocationStockData = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationStockData, [ locationId || 0 ], res));
}

controller.findCurrentStock = (req, res) => req.getConnection(connUtil.connFunc(queries.findCurrentStock, [], res));

controller.add = (req, res) => {
  const { name, cost } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name, cost ], res));
}

controller.update = (req, res) => {
  const { name, cost, furnishingId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, cost, furnishingId || 0 ], res));
}

controller.remove = (req, res) => {
  const { furnishingId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ furnishingId || 0, furnishingId || 0 ], res));
}

// RAW MATERIAL STOCKS

controller.stocks = {};

controller.stocks.findByFurnishingId = (req, res) => {
  const { furnishingId } = req.params;
  req.getConnection(connUtil.connFunc(queries.stocks.findByFurnishingId, [ furnishingId || 0 ], res));
}

controller.stocks.updateById = (req, res) => {
  const { initialStock, stock, furnishingstockId } = req.body;
  req.getConnection(connUtil.connFunc(queries.stocks.updateById, [ initialStock || 0, stock || 0, furnishingstockId || 0 ], res));
}

export default controller;
