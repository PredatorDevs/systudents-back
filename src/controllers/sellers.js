import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name FROM sellers WHERE isActive = 1;`,
  add: `INSERT INTO sellers (name) VALUES (?);`,
  update: `UPDATE sellers SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE sellers SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, sellerId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, sellerId || 0 ], res));
}

controller.remove = (req, res) => {
  const { sellerId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ sellerId || 0 ], res));
}

export default controller;
