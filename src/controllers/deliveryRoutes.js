import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name FROM deliveryroutes WHERE isActive = 1;`,
  add: `INSERT INTO deliveryroutes (name) VALUES (?);`,
  update: `UPDATE deliveryroutes SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE deliveryroutes SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, deliveryRouteId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, deliveryRouteId || 0 ], res));
}

controller.remove = (req, res) => {
  const { deliveryRouteId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ deliveryRouteId || 0 ], res));
}

export default controller;
