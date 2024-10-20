import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT 
      id AS measurementUnitId,
      name AS measurementUnitName
    FROM
      measurementunits
    WHERE
      isActive = 1
    ORDER BY
      name;
  `,
  add: `INSERT INTO measurementunits (name) VALUES (?);`,
  update: `UPDATE measurementunits SET name = IFNULL(?, name) WHERE id = ?;`,
  remove: `UPDATE measurementunits SET isActive = 0 WHERE id = ?;`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.add = (req, res) => {
  const { name } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name ], res));
}

controller.update = (req, res) => {
  const { name, measurementUnitId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, measurementUnitId || 0 ], res));
}

controller.remove = (req, res) => {
  const { measurementUnitId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ measurementUnitId || 0 ], res));
}

export default controller;
