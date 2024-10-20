import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT 
      id,
      \`name\`,
      address,
      phone,
      email,
      dui,
      nit,
      nrc,
      businessLine,
      occupation
    FROM 
      suppliers
    WHERE
      isActive = 1
    ORDER BY name;
  `,
  findPendingPurchases: `
    SELECT * FROM vw_supplierpendingproductpurchases WHERE supplierId = ?;
  `,
  add: `
    INSERT INTO suppliers
      (\`name\`, address, phone, email, dui, nit, nrc, businessLine, occupation)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  update: `
    UPDATE 
      suppliers
    SET
      \`name\` = IFNULL(?, \`name\`),
      address = IFNULL(?, address),
      phone = IFNULL(?, phone),
      email = IFNULL(?, email),
      dui = IFNULL(?, dui),
      nit = IFNULL(?, nit),
      nrc = IFNULL(?, nrc),
      businessLine = IFNULL(?, businessLine),
      occupation = IFNULL(?, occupation)
    WHERE 
      id = ?;
  `,
  remove: `
    UPDATE 
      suppliers
    SET
      isActive = 0
    WHERE
      id = ?;
  `
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}
controller.findPendingPurchases = (req, res) => {
  const { supplierId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findPendingPurchases, [ supplierId ], res));
}

controller.add = (req, res) => {
  const { name, address, phone, email, dui, nit, nrc, businessLine, occupation } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ name, address, phone, email, dui, nit, nrc, businessLine, occupation ], res));
}

controller.update = (req, res) => {
  const { name, address, phone, email, dui, nit, nrc, businessLine, occupation, supplierId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ name, address, phone, email, dui, nit, nrc, businessLine, occupation, supplierId || 0 ], res));
}

controller.remove = (req, res) => {
  const { supplierId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ supplierId || 0 ], res));
}

export default controller;
