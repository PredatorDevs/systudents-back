import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT id, name FROM categories WHERE isActive = 1;`,
  add: `INSERT INTO categories (name) VALUES (?);`,
  update: `UPDATE categories SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE categories SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, categoryId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, categoryId || 0 ], res));
}

controller.remove = (req, res) => {
  const { categoryId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ categoryId || 0 ], res));
}

export default controller;
