import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name FROM ubications WHERE isActive = 1;`,
  add: `INSERT INTO ubications (name) VALUES (?);`,
  update: `UPDATE ubications SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE ubications SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, ubicationId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, ubicationId || 0 ], res));
}

controller.remove = (req, res) => {
  const { ubicationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ ubicationId || 0 ], res));
}

export default controller;
