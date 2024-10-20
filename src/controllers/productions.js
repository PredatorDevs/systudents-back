import connUtil from "../helpers/connectionUtil.js";
import errorResponses from "../helpers/errorResponses.js";
import generalQueries from "../helpers/generalQueries.js";
import fileExtVerifications from "../helpers/fileExtVerifications.js";
import clearTempFiles from "../helpers/clearTempFiles.js";
import s3Methods from "../utils/s3.js";

const controller = {};

const queries = {
  find: `SELECT * FROM vw_productions;`,
  findById: `SELECT * FROM vw_productions WHERE productionId = ?;`,
  findByLocationCurrentActiveShiftcut: `SELECT * FROM vw_productions WHERE shiftcutId = fn_getlocationcurrentactiveshiftcut(?);`,
  findRecents: `SELECT * FROM vw_productions ORDER BY productionId DESC LIMIT 25;`,
  findByRangeDate: `SELECT * FROM vw_productions WHERE DATE_FORMAT(docDatetime, "%Y-%m-%d") BETWEEN ? AND ?;`,
  findByLocationRangeDate: `SELECT * FROM vw_productions WHERE locationId = ? AND DATE_FORMAT(docDatetime, "%Y-%m-%d") BETWEEN ? AND ?;`,
  summaryByShiftcut: `SELECT * FROM vw_productionsummarybyshiftcut WHERE shiftcutId = ?;`,
  add: `CALL usp_CreateNewProduction(?, ?, ?, ?);`,
  addv2: `CALL usp_CreateNewProduction(?, ?, ?, ?);`,
  addAttachment: `
    INSERT INTO productionattachments (
      productionId,
      attachmentId
    ) VALUES (?, ?);
  `,
  getAttachmentsById: `
    SELECT * FROM vw_productionattachments WHERE productionId = ?;
  `,
  update: `
    UPDATE 
    productions 
    SET 
      docDatetime = IFNULL(?, docDatetime), 
      docNumber = IFNULL(?, docNumber),
      createdBy = IFNULL(?, createdBy)
    WHERE 
      id = ?;
  `,
  remove: `
    UPDATE productions SET isActive = 0 WHERE id = ?;
    UPDATE productiondetails SET isActive = 0 WHERE productionId = ?;
  `,
  voidProduction: `CALL usp_VoidProduction(?, ?);`,
  details: {
    findByProductionId: `
      SELECT 
        productiondetails.id AS productionDetailId, 
        productiondetails.productionId, 
        productiondetails.productId, 
        productiondetails.quantity,
        products.name AS productName
      FROM 
        productiondetails
        JOIN products ON productiondetails.productId = products.id
      WHERE 
        productiondetails.productionId = ?
        AND productiondetails.isActive = 1;
    `,
    add: `INSERT INTO productiondetails (productionId, productId, quantity, cost) VALUES ?;`,
    update: `
      UPDATE 
        productiondetails 
      SET 
        productionId = IFNULL(?, productionId), 
        productId = IFNULL(?, productId),
        quantity = IFNULL(?, quantity)
      WHERE 
        id = ?;
    `,
    remove: `UPDATE productiondetails SET isActive = 0 WHERE id = ?;`
  }
}

controller.find = (req, res) => req.getConnection(connUtil.connFunc(queries.find, [], res));

controller.findById = (req, res) => {
  const { productionId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findById, [ productionId ], res));
}

controller.findByLocationCurrentActiveShiftcut = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationCurrentActiveShiftcut, [ locationId ], res));
}

controller.findRecents = (req, res) => req.getConnection(connUtil.connFunc(queries.findRecents, [], res));

controller.findByRangeDate = (req, res) => {
  const { initialDate, finalDate } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByRangeDate, [ initialDate, finalDate ], res));
}

controller.findByLocationRangeDate = (req, res) => {
  const { locationId, initialDate, finalDate } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationRangeDate, [ locationId, initialDate, finalDate ], res));
}

controller.getAttachmentsById = (req, res) => {
  const { productionId } = req.params;
  req.getConnection(connUtil.connFunc(queries.getAttachmentsById, [ productionId ], res));
}

controller.summaryByShiftcut = (req, res) => {
  const { shiftcutId } = req.params;
  req.getConnection(connUtil.connFunc(queries.summaryByShiftcut, [ shiftcutId ], res));
}

controller.add = (req, res) => {
  const { idtoauth } = req.headers;
  const { locationId, docDatetime, docNumber } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.add, [ locationId, docDatetime, docNumber, idtoauth ], res));
}

controller.addv2 = (controllerRequest, controllerResponse) => {
  // req.getConnection(connUtil.connSPFunc(queries.add, [ locationId, docDatetime, docNumber, idtoauth ], res));
  controllerRequest.getConnection((connectionError, connection) => {
    if (connectionError)
      controllerResponse.status(500).json(errorResponses.status500(connectionError));

    connection.beginTransaction((transactionError) => {
      if (transactionError)
        controllerResponse.status(500).json(errorResponses.status500(connectionError));
      
      const { idtoauth } = controllerRequest.headers;
      const { locationId, docDatetime, docNumber } = controllerRequest.body;

      connection.query(
        queries.add,
        [ locationId, docDatetime, docNumber, idtoauth ],
        (queryError, queryRows) => {
          if (queryError)
            return connection.rollback(() => { 
              controllerResponse.status(500).json(errorResponses.status500(queryError));
            });
  
          const productionInsertedId = queryRows[0][0].insertId;
  
          if (controllerRequest.files !== null) {
            const { fileAttachment } = controllerRequest.files;
  
            const fileExt = fileExtVerifications.getFileExtension(fileAttachment.name);
            // const newName = `produccion-${new Date().toLocaleDateString('en-CA')}-${Date.now()}.${fileExt}`;
            const newName = `produccion-${Date.now()}.${fileExt}`;
            const fileKey = `nuevaguinea/productions/${newName}`;
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
                    [ productionInsertedId, attachmentInsertedId ],
                    (queryError, queryRows) => {
                      if (queryError)
                        return connection.rollback(() => {
                          controllerResponse.status(500).json(errorResponses.status500(queryError));
                        });
                      
                      const { bulkProductionDetailData } = controllerRequest.body;
                      // [[productionId, productId, quantity, cost], [...]]
                      const bulkTransformedData = JSON.parse(bulkProductionDetailData).map((element) => ([ productionInsertedId, element[1], element[2], element[3] ]));
                      
                      connection.query(
                        queries.details.add,
                        [ bulkTransformedData ],
                        (queryError, queryRows) => {
                          if (queryError)
                            return connection.rollback(() => { 
                              controllerResponse.status(500).json(errorResponses.status500(queryError));
                            });

                          connection.commit((commitError) => {
                            if (commitError) {
                              return connection.rollback(() => {
                                controllerResponse.status(500).json(errorResponses.status500(commitError));
                              });
                            }
                
                            controllerResponse.json({message: `Success production added: id-${productionInsertedId} - Attachmend added: id-${attachmentInsertedId}`, productionInsertedId, attachmentInsertedId});
                          });
                        }
                      );
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
            const { bulkProductionDetailData } = controllerRequest.body;
            const bulkTransformedData = JSON.parse(bulkProductionDetailData).map((element) => ([ productionInsertedId, element[1], element[2], element[3] ]));
            
            connection.query(
              queries.details.add,
              [ bulkTransformedData ],
              (queryError, queryRows) => {
                if (queryError)
                  return connection.rollback(() => { 
                    controllerResponse.status(500).json(errorResponses.status500(queryError));
                  });
                connection.commit((commitError) => {
                  if (commitError) {
                    return connection.rollback(() => {
                      controllerResponse.status(500).json(errorResponses.status500(commitError));
                    });
                  }
      
                  controllerResponse.json({message: `Success production added: id-${productionInsertedId} - No attachment added`, productionInsertedId});
                });
              }
            );
          }
        }
      );
    });
  });
}

controller.update = (req, res) => {
  const { idtoauth } = req.headers;
  const { docDatetime, docNumber, productionId } = req.body;
  req.getConnection(connUtil.connFunc(queries.update, [ docDatetime, docNumber, idtoauth, productionId || 0 ], res));
}

controller.remove = (req, res) => {
  const { productionId } = req.params;
  req.getConnection(connUtil.connFunc(queries.remove, [ productionId || 0, productionId || 0 ], res));
}

controller.voidProduction = (req, res) => {
  const { userId, productionId } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.voidProduction, [ userId, productionId ], res));
}

// PRODUCT PRICES

controller.details = {};

controller.details.findByProductionId = (req, res) => {
  const { productionId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.findByProductionId, [ productionId || 0 ], res));
}

// EXPECTED req.body => details = [[productionId, productId, quantity, cost], [...]]
controller.details.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.add, [ bulkData ], res));
}

controller.details.update = (req, res) => {
  const { productionId, productId, quantity, productionDetailId } = req.body;
  req.getConnection(connUtil.connFunc(queries.details.update, [ productionId, productId, quantity, productionDetailId || 0 ], res));
}

controller.details.remove = (req, res) => {
  const { productionDetailId } = req.params;
  req.getConnection(connUtil.connFunc(queries.details.remove, [ productionDetailId || 0 ], res));
}

export default controller;
