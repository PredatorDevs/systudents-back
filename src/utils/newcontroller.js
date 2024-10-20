import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT * FROM table WHERE isActive = 1;`,
  add: `INSERT INTO table (name) VALUES (?);`,
  update: `UPDATE table SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE table SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, entityId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, entityId || 0 ], res));
}

controller.remove = (req, res) => {
  const { entityId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ entityId || 0 ], res));
}

export default controller;
