import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name FROM brands WHERE isActive = 1;`,
  add: `INSERT INTO brands (name) VALUES (?);`,
  update: `UPDATE brands SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE brands SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, brandId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, brandId || 0 ], res));
}

controller.remove = (req, res) => {
  const { brandId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ brandId || 0 ], res));
}

export default controller;
