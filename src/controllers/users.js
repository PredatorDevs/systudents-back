import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT
      us.id,
      us.fullName,
      us.username,
      us.roleId,
      rol.\`name\` AS roleName,
      us.isActive
    FROM
      users us
      JOIN roles rol 
        ON us.roleId = rol.id
    WHERE
      us.isActive = 1
    ORDER BY
      us.fullName;
  `,
  findById: `
    SELECT
      us.id,
      us.fullName,
      us.username,
      us.roleId,
      rol.\`name\` AS roleName,
      us.isActive
    FROM
      users us
      JOIN roles rol 
        ON us.roleId = rol.id
    WHERE
      us.id = ?
    ORDER BY
      us.fullName;
  `,
  add: `
    INSERT INTO users 
      (fullName, username, \`password\`, roleId)
    VALUES 
      (?, ?, SHA2(?, 512), ?);  
  `,
  update: `
    UPDATE
      users
    SET
      fullName = IFNULL(?, fullName),
      username = IFNULL(?, username),
      roleId = IFNULL(?, roleId)
    WHERE
      id = ?;
  `,
  remove: `
    UPDATE 
      users
    SET
      isActive = 0
    WHERE
      id = ?;
  `
}


controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { userId } = req.body;
  req.getConnection(connUtil.connFunc(queries.findById, [ userId ], res));
}

controller.add = (req, res) => {
  const {
    fullName,
    username,
    password,
    roleId
  } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ fullName, username, password, roleId ], res));
}

controller.update = (req, res) => {
  const { fullName, username, roleId, userId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ fullName, username, roleId, userId || 0 ], res));
}

controller.remove = (req, res) => {
  const { userId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ userId || 0 ], res));
}

export default controller;
