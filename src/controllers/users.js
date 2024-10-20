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
      us.locationId,
      loc.\`name\` AS locationName,
      us.isActive,
      us.cashierId,
      us.isAdmin,
      us.canCloseCashier
    FROM
      users us
      JOIN roles rol 
        ON us.roleId = rol.id
      JOIN locations loc 
        ON us.locationId = loc.id
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
      us.locationId,
      loc.\`name\` AS locationName,
      us.isActive,
      us.cashierId,
      us.isAdmin,
      us.canCloseCashier
    FROM
      users us
      JOIN roles rol 
        ON us.roleId = rol.id
      JOIN locations loc 
        ON us.locationId = loc.id
    WHERE
      us.id = ?
    ORDER BY
      us.fullName;
  `,
  add: `
    INSERT INTO users 
      (fullName, username, \`password\`, PINCode, roleId, locationId, cashierId, isAdmin, canCloseCashier)
    VALUES 
      (?, ?, SHA2(?, 512), ?, ?, ?, ?, ?, ?);  
  `,
  update: `
    UPDATE
      users
    SET
      fullName = IFNULL(?, fullName),
      username = IFNULL(?, username),
      roleId = IFNULL(?, roleId),
      locationId = IFNULL(?, locationId),
      cashierId = IFNULL(?, cashierId),
      isAdmin = IFNULL(?, isAdmin),
      canCloseCashier = IFNULL(?, canCloseCashier)
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
  `,
  getActionLogs: `SELECT * FROM vw_useractionlogs WHERE actionDatetimeFormatted = ? ORDER BY actionId DESC;`
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
    PINCode,
    roleId,
    locationId,
    cashierId,
    isAdmin,
    canCloseCashier
  } = req.body;
  req.getConnection(connUtil.connFunc(queries.add, [ fullName, username, password, PINCode, roleId, locationId, cashierId, isAdmin, canCloseCashier ], res));
}

controller.update = (req, res) => {
  const { fullName, username, roleId, locationId, cashierId, isAdmin, canCloseCashier, userId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ fullName, username, roleId, locationId, cashierId, isAdmin, canCloseCashier, userId || 0 ], res));
}

controller.remove = (req, res) => {
  const { userId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ userId || 0 ], res));
}

controller.getActionLogs = (req, res) => {
  const { month } = req.params;
  req.getConnection(connUtil.connFunc(queries.getActionLogs, [ month || '2000-01' ], res));
}

export default controller;
