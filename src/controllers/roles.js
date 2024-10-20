import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT
      id,
      name
    FROM
      roles
    WHERE
      isActive = 1;
  `
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

export default controller;
