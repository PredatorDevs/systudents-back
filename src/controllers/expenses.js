import connUtil from "../helpers/connectionUtil.js";
import errorResponses from "../helpers/errorResponses.js";
import generalQueries from "../helpers/generalQueries.js";
import fileExtVerifications from "../helpers/fileExtVerifications.js";
import clearTempFiles from "../helpers/clearTempFiles.js";
import s3Methods from "../utils/s3.js";

const controller = {};

const queries = {
  find: `
    SELECT * FROM vw_expenses 
    -- WHERE isActive = 1 
    -- AND isVoided = 0 
    ORDER BY documentDatetime DESC LIMIT 200;`,
  findById: `
    SELECT * FROM vw_expenses WHERE expenseId = ?;
  `,
  findTypes: `SELECT id, name FROM expensetypes WHERE isActive = 1 ORDER BY name;`,
  add: `
    INSERT INTO expenses (
      locationId,
      documentTypeId,
      expenseTypeId,
      paymentMethodId,
      documentNumber,
      documentDatetime,
      accountCode,
      concept,
      description,
      amount,
      taxedAmount,
      noTaxedAmount,
      discounts,
      bonus,
      iva,
      fovial,
      cotrans,
      ivaRetention,
      ivaPerception,
      createdBy,
      accountingAccountId
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
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
  addAttachment: `
    INSERT INTO expenseattachments (
      expenseId,
      attachmentId
    ) VALUES (?, ?);
  `,
  getAttachmentsById: `
    SELECT * FROM vw_expenseattachments WHERE expenseId = ?;
  `,
  update: `
    UPDATE expenses
    SET
      locationId = IFNULL(?, locationId),
      shiftcutId = IFNULL(?, shiftcutId),
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
  remove: `UPDATE expenses SET isActive = 0 WHERE id = ?;`,
  voidById: `CALL usp_VoidExpense(?, ?);`
}

controller.find = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.find, [], res));
}

controller.findById = (req, res) => {
  const { expenseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ expenseId || 0 ], res));
}

controller.findTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findTypes, [], res));
}

controller.getAttachmentsById = (req, res) => {
  const { expenseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.getAttachmentsById, [ expenseId ], res));
}

controller.add = (req, res) => {
  const { 
    locationId, expenseTypeId, paymentMethodId, documentNumber, documentDatetime, accountCode, concept, description, amount, createdBy
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.add, 
      [ locationId, locationId, expenseTypeId, paymentMethodId, documentNumber, documentDatetime, accountCode, concept, description, amount, createdBy ], 
      res
    )
  );
}

controller.addv2 = (controllerRequest, controllerResponse) => {
  controllerRequest.getConnection((connectionError, connection) => {
    if (connectionError) 
      controllerResponse.status(500).json(errorResponses.status500(connectionError));

    connection.beginTransaction((transactionError) => {
      if (transactionError)
        controllerResponse.status(500).json(errorResponses.status500(connectionError));

      const { 
        locationId,
        documentTypeId,
        expenseTypeId,
        paymentMethodId,
        documentNumber,
        documentDatetime,
        accountCode,
        concept,
        description,
        amount,
        taxedAmount,
        noTaxedAmount,
        discounts,
        bonus,
        iva,
        fovial,
        cotrans,
        ivaRetention,
        ivaPerception,
        createdBy,
        accountingAccountId
      } = controllerRequest.body;

      connection.query(
        queries.add,
        [ 
          locationId,
          documentTypeId,
          expenseTypeId,
          paymentMethodId,
          documentNumber,
          documentDatetime,
          accountCode,
          concept,
          description,
          amount,
          taxedAmount,
          noTaxedAmount,
          discounts,
          bonus,
          iva,
          fovial,
          cotrans,
          ivaRetention,
          ivaPerception,
          createdBy,        
          accountingAccountId
        ],
        (queryError, queryRows) => {
          if (queryError)
            return connection.rollback(() => { 
              controllerResponse.status(500).json(errorResponses.status500(queryError));
            });

          const expenseInsertedId = queryRows.insertId;

          if (controllerRequest.files !== null) {
            const { fileAttachment } = controllerRequest.files;

            const fileExt = fileExtVerifications.getFileExtension(fileAttachment.name);
            // const newName = `gasto-${new Date().toLocaleDateString('en-CA')}-${Date.now()}.${fileExt}`;
            const newName = `gasto-${Date.now()}.${fileExt}`;
            const fileKey = `nuevaguinea/expenses/${newName}`;
            const fileUrl = `https://sigpromainbucket.s3.amazonaws.com/${fileKey}`;

            s3Methods.uploadFile(fileAttachment.tempFilePath, fileKey, fileExt)
            .then((uploadResult) => {
              // clearTempFiles.clearUploads();
              connection.query(
                generalQueries.createAttachment,
                [ newName, fileExt, fileKey, fileUrl ],
                (queryError, queryRows) => {
                  if (queryError)
                    return connection.rollback(() => {
                      controllerResponse.status(500).json(errorResponses.status500(queryError));
                    });

                  const attachmentInsertedId = queryRows.insertId;

                  connection.query(
                    queries.addAttachment,
                    [ expenseInsertedId, attachmentInsertedId ],
                    (queryError, queryRows) => {
                      if (queryError)
                        return connection.rollback(() => {
                          controllerResponse.status(500).json(errorResponses.status500(queryError));
                        });

                      connection.commit((commitError) => {
                        if (commitError)
                          return connection.rollback(() => {
                            controllerResponse.status(500).json(errorResponses.status500(queryError));
                          });
    
                        controllerResponse.json({message: `Success expense added: id-${expenseInsertedId} - Attachmend added: id-${attachmentInsertedId}`, expenseInsertedId, attachmentInsertedId});
                      });
                    }
                  );
                }
              );
            }).catch((uploadError) => {
              return connection.rollback(() => {
                controllerResponse.status(500).json(errorResponses.status500(uploadError));
              });
            });
          } else {
            connection.commit((commitError) => {
              if (commitError) {
                return connection.rollback(() => {
                  controllerResponse.status(500).json(errorResponses.status500(commitError));
                });
              }

              controllerResponse.json({message: `Success expense added: id-${expenseInsertedId} - No attachment added`, expenseInsertedId});
            });
          }
        }
      );
    });
  });
}

controller.update = (req, res) => {
  const { 
    locationId, shiftcutId, expenseTypeId, paymentMethodId, documentNumber, documentDatetime, accountCode, concept, description, amount, createdBy, expenseId
  } = req.body;
  req.getConnection(
    connUtil.connFunc(
      queries.update, 
      [ locationId, shiftcutId, expenseTypeId, paymentMethodId, documentNumber, documentDatetime, accountCode, concept, description, amount, createdBy, expenseId || 0 ], 
      res
    )
  );
}

controller.remove = (req, res) => {
  const { expenseId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ expenseId || 0 ], res));
}

controller.voidById = (req, res) => {
  const { voidedBy, expenseId } = req.body;
  req.getConnection(connUtil.connFunc(queries.voidById, [ voidedBy || 0, expenseId || 0 ], res));
}

export default controller;
