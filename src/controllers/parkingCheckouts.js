import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_parkingcheckouts
    ORDER BY parkingCheckoutId DESC;
  `,
  findById: `
    SELECT * FROM vw_parkingcheckouts
    WHERE parkingCheckoutId = ?;
  `,
  add: `
    INSERT INTO parkingcheckouts (
      checkoutDatetime,
      parkingGuardId,
      checkoutTotal,
      ticketNumberFrom,
      ticketNumberTo,
      numberOfParkings,
      notes,
      checkoutBy
    )
    VALUES(
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    );  
  `,
  update: `
    UPDATE
      parkingcheckouts
    SET
      checkoutDatetime = IFNULL(?, checkoutDatetime),
      parkingGuardId = IFNULL(?, parkingGuardId),
      checkoutTotal = IFNULL(?, checkoutTotal),
      ticketNumberFrom = IFNULL(?, ticketNumberFrom),
      ticketNumberTo = IFNULL(?, ticketNumberTo),
      numberOfParkings = IFNULL(?, numberOfParkings),
      notes = IFNULL(?, notes),
      checkoutBy  = IFNULL(?, checkoutBy)
    WHERE
      id = ?;
  `,
  remove: `UPDATE parkingcheckouts SET isActive = 0 WHERE id = ?;`,
  voidById: `CALL usp_VoidParkingCheckout(?, ?);`,
  pendingTickets: {
    findByParkingCheckoutId: `
      SELECT * FROM parkingcheckoutpendingtickets WHERE parkingCheckoutId = ?
      ORDER BY ticketNumber;
    `,
    add: `
      INSERT INTO parkingcheckoutpendingtickets
        (parkingCheckoutId, ticketNumber, status)
      VALUES ?;
    `,
    update: `
      UPDATE
        parkingcheckoutpendingtickets
      SET
        parkingCheckoutId = IFNULL(?, parkingCheckoutId),
        ticketNumber = IFNULL(?, ticketNumber),
        status = IFNULL(?, status),
        checkoutDatetime = IFNULL(?, checkoutDatetime)
      WHERE
        id = ?;
    `,
    checkoutPendingById: `
      UPDATE parkingcheckoutpendingtickets
      SET status = 2,
      checkoutDatetime = CONVERT_TZ(NOW(), '+00:00', '-06:00')
      WHERE id = ?;
    `
  },
  parkingGuards: {
    find: `
      SELECT * FROM parkingguards WHERE isActive = 1;
    `,
    add: `
      INSERT INTO parkingguards (fullname, schedule, chartColor) VALUES (?, ?, ?);
    `,
    update: `
      UPDATE parkingguards
      SET fullname = IFNULL(?, fullname),
      schedule = IFNULL(?, schedule),
      chartColor = IFNULL(?, chartColor)
      WHERE id = ?;
    `,
    delete: `
      UPDATE parkingguards SET isActive = 0 WHERE id = ?;
    `
  }
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { parkingCheckoutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ parkingCheckoutId ], res));
}

controller.add = (req, res) => {
  const {
    checkoutDatetime,
    parkingGuardId,
    checkoutTotal,
    ticketNumberFrom,
    ticketNumberTo,
    numberOfParkings,
    notes,
    checkoutBy
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.add,
      [
        checkoutDatetime,
        parkingGuardId,
        checkoutTotal,
        ticketNumberFrom,
        ticketNumberTo,
        numberOfParkings,
        notes,
        checkoutBy
      ],
      res
    )
  );
}

controller.update = (req, res) => {
  const { 
    checkoutDatetime,
    parkingGuardId,
    checkoutTotal,
    ticketNumberFrom,
    ticketNumberTo,
    numberOfParkings,
    notes,
    checkoutBy,
    parkingCheckoutId
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.update, [
        checkoutDatetime,
        parkingGuardId,
        checkoutTotal,
        ticketNumberFrom,
        ticketNumberTo,
        numberOfParkings,
        notes,
        checkoutBy,
        parkingCheckoutId || 0
      ],
      res
    )
  );
}

controller.remove = (req, res) => {
  const { parkingCheckoutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ parkingCheckoutId || 0 ], res));
}

controller.voidById = (req, res) => {
  const { voidedBy, parkingExpenseId } = req.body;
  req.getConnection(connUtil.connFunc(queries.voidById, [ voidedBy || 0, parkingExpenseId || 0 ], res));
}

controller.pendingTickets = {};

controller.pendingTickets.findByParkingCheckoutId = (req, res) => {
  const { parkingCheckoutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.pendingTickets.findByParkingCheckoutId, [ parkingCheckoutId || 0 ], res));
}

controller.pendingTickets.add = (req, res) => {
  // Expeceted = [[parkingCheckoutId, ticketNumber, status], ...]
  const {
    pendingTicketBulk
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.pendingTickets.add,
      [ pendingTicketBulk ],
      res
    )
  );
}

controller.pendingTickets.update = (req, res) => { 
  const {
    parkingCheckoutId,
    ticketNumber,
    status,
    checkoutDatetime,
    parkingCheckoutPendingTicketId
  } = req.params;

  req.getConnection(
    connUtil.connFunc(
      queries.pendingTickets.update,
      [
        parkingCheckoutId,
        ticketNumber,
        status,
        checkoutDatetime,
        parkingCheckoutPendingTicketId
      ],
      res
    )
  );
}

controller.pendingTickets.checkoutPendingById = (req, res) => {
  const { parkingCheckoutPendingTicketId } = req.params;
  req.getConnection(connUtil.connFunc(queries.pendingTickets.checkoutPendingById, [ parkingCheckoutPendingTicketId || 0 ], res));
}

controller.parkingGuards = {};

controller.parkingGuards.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.parkingGuards.find, [], res));
}
controller.parkingGuards.add = (req, res) => {
  const { fullname, schedule, chartColor } = req.body;
  req.getConnection(connUtil.connFunc(queries.parkingGuards.add, [ fullname, schedule, chartColor ], res));
}

controller.parkingGuards.update = (req, res) => {
  const { fullname, schedule, chartColor, parkingGuardId } = req.body;
  req.getConnection(connUtil.connFunc(queries.parkingGuards.update, [ fullname, schedule, chartColor, parkingGuardId || 0 ], res));
}

controller.parkingGuards.delete = (req, res) => {
  const { parkingGuardId } = req.params;
  req.getConnection(connUtil.connFunc(queries.parkingGuards.delete, [ parkingGuardId || 0 ], res));
}

export default controller;
