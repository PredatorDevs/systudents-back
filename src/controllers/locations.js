import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT
      id,
      name
    FROM
      locations
    WHERE
      isActive = 1;
  `
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

export default controller;
