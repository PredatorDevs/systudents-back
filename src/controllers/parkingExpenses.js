import connUtil from "../helpers/connectionUtil.js";
import errorResponses from "../helpers/errorResponses.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_parkingexpenses
    WHERE isActive = 1 AND isVoided = 0;`,
  findById: `
    SELECT * FROM vw_parkingexpenses WHERE parkingExpenseId = ?;
  `,
  findTypes: `SELECT id, name FROM expensetypes WHERE isActive = 1 ORDER BY name;`,
  add: `
    INSERT INTO parkingexpenses (
      expenseTypeId,
      paymentMethodId,
      documentNumber,
      documentDatetime,
      accountCode,
      concept,
      description,
      amount,
      createdBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  update: `
    UPDATE parkingexpenses
    SET
      expenseTypeId = IFNULL(?, expenseTypeId),
      paymentMethodId = IFNULL(?, paymentMethodId),
      documentNumber = IFNULL(?, documentNumber),
      documentDatetime = IFNULL(?, documentDatetime),
      accountCode = IFNULL(?, accountCode),
      concept = IFNULL(?, concept),
      description = IFNULL(?, description),
      amount = IFNULL(?, amount),
      createdBy = IFNULL(?, createdBy)
    WHERE 
      id = ?;
  `,
  remove: `UPDATE parkingexpenses SET isActive = 0 WHERE id = ?;`,
  voidById: `CALL usp_VoidParkingExpense(?, ?);`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { parkingExpenseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ parkingExpenseId || 0 ], res));
}

controller.findTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findTypes, [], res));
}

controller.add = (controllerRequest, controllerResponse) => {
  controllerRequest.getConnection((connectionError, connection) => {
    if (connectionError) 
      controllerResponse.status(500).json(errorResponses.status500(connectionError));

    connection.beginTransaction((transactionError) => {
      if (transactionError)
        controllerResponse.status(500).json(errorResponses.status500(connectionError));

      const {
        expenseTypeId,
        paymentMethodId,
        documentNumber,
        documentDatetime,
        accountCode,
        concept,
        description,
        amount,
        createdBy
      } = controllerRequest.body;

      connection.query(
        queries.add,
        [
          expenseTypeId,
          paymentMethodId,
          documentNumber,
          documentDatetime,
          accountCode,
          concept,
          description,
          amount,
          createdBy
        ],
        (queryError, queryRows) => {
          if (queryError)
            return connection.rollback(() => { 
              controllerResponse.status(500).json(errorResponses.status500(queryError));
            });

          const expenseInsertedId = queryRows.insertId;

          connection.commit((commitError) => {
            if (commitError) {
              return connection.rollback(() => {
                controllerResponse.status(500).json(errorResponses.status500(commitError));
              });
            }

            controllerResponse.json({message: `Success expense added: id-${expenseInsertedId} - No attachment added`, expenseInsertedId});
          });
        }
      );
    });
  });
}

controller.update = (req, res) => {
  const { 
    expenseTypeId,
    paymentMethodId,
    documentNumber,
    documentDatetime,
    accountCode,
    concept,
    description,
    amount,
    createdBy,
    parkingExpenseId
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.update, 
      [ expenseTypeId, paymentMethodId, documentNumber, documentDatetime, accountCode, concept, description, amount, createdBy, parkingExpenseId || 0 ], 
      res
    )
  );
}

controller.remove = (req, res) => {
  const { parkingExpenseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ parkingExpenseId || 0 ], res));
}

controller.voidById = (req, res) => {
  const { voidedBy, parkingExpenseId } = req.body;
  req.getConnection(connUtil.connFunc(queries.voidById, [ voidedBy || 0, parkingExpenseId || 0 ], res));
}

export default controller;
