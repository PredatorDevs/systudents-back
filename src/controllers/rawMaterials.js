import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  find: `SELECT * FROM vw_rawmaterials;`,
  findByLocationStockData: `
    SELECT
      rm.*,
      ROUND(rms.initialStock, 2) AS currentLocationInitialStock,
      ROUND(rms.stock, 2) AS currentLocationStock,
      ROUND(rms.minStockAlert, 2) AS currentLocationMinStockAlert,
      l.name AS locationName
    FROM
      vw_rawmaterials rm
      INNER JOIN rawmaterialstocks rms ON rm.rawMaterialId = rms.rawMaterialId
      INNER JOIN locations l ON rms.locationId = l.id
    WHERE
      rms.locationId = ?;
  `,
  findDeactivated: `
    SELECT
        ms.*
      FROM
        vw_rawmaterialsdeactivated ms
  `,
  findTaxesByRawMaterialId: `SELECT taxesData FROM vw_rawmaterials WHERE rawMaterialId = ?`,
  findByMultipleParams: `
    SELECT
      rawm.*,
      (
        SELECT ROUND(stock, 2) AS stock
        FROM vw_rawmaterialstocks
        WHERE locationId = ?
        AND rawMaterialId = rawm.rawMaterialId
      ) AS currentStock
    FROM
      vw_rawmaterials rawm
    WHERE
      (
        rawMaterialId LIKE ?
        OR rawMaterialName LIKE ?
        OR rawMaterialBarcode = ?
        OR rawMaterialCode = ?
      ) AND (
        (? = 0)
        OR
        (? = 1 AND rawMaterialIsService != 1)
      ) AND (
        (? = 0)
        OR
        ((? != 0) AND (rawm.rawMaterialDistributionsId = ? OR rawm.rawMaterialDistributionsId IS NULL))
      );
  `,
  findLocationStockCheck: `
    SELECT
      vw_rms.rawMaterialStockId,
      vw_rms.rawMaterialName,
      ROUND(vw_rms.stock, 2) AS stock,
      ROUND(vw_rms.minStockAlert, 2) AS minStockAlert,
      vp.rawMaterialCost AS rawMaterialCost,
      vp.rawMaterialTotalCost AS rawMaterialTotalCost
    FROM
      vw_rawmaterialstocks vw_rms
      INNER JOIN vw_rawmaterials vp ON vw_rms.rawMaterialId = vp.rawMaterialId
    WHERE
      vw_rms.locationId = ?
      AND (SELECT rm.isActive FROM rawmaterials rm WHERE rm.id = vw_rms.rawMaterialId) = 1
    ORDER BY
      vw_rms.rawMaterialName;
  `,
  add: `
    INSERT INTO rawmaterials (
      code,
      name,
      brandId,
      categoryId,
      ubicationId,
      measurementUnitId,
      barcode,
      cost,
      isService,
      isTaxable,
      enabledForProduction,
      packageContent,
      rawMaterialTypeId
    ) 
    VALUES (
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
  update: `
    UPDATE
      rawmaterials
    SET
      code = IFNULL(?, code),
      name = IFNULL(?, name),
      brandId = IFNULL(?, brandId),
      categoryId = IFNULL(?, categoryId),
      ubicationId = IFNULL(?, ubicationId),
      measurementUnitId = IFNULL(?, measurementUnitId),
      barcode = IFNULL(?, barcode),
      cost = IFNULL(?, cost),
      isService = IFNULL(?, isService),
      isTaxable = IFNULL(?, isTaxable),
      enabledForProduction = IFNULL(?, enabledForProduction),
      packageContent = IFNULL(?, packageContent),
      rawMaterialTypeId = IFNULL(?, rawMaterialTypeId),
      rawMaterialDistributionsId = IFNULL(?, rawMaterialDistributionsId)
    WHERE
      id = ?;
  `,
  remove: `
    CALL usp_RemoveRawMaterial(?);
  `,
  reactivate: `
    UPDATE rawmaterials SET isActive = 1 WHERE id = ?;
  `,
  stocks: {
    findByRawMaterialId: `
      SELECT 
        *
      FROM
        vw_rawmaterialstocks
      WHERE
        rawMaterialId = ?;
    `,
    updateById: `
      UPDATE
        rawmaterialstocks
      SET
        initialStock = ?,
        stock = ?,
        minStockAlert = ?
      WHERE
        id = ?;
    `,
    adjustments: {
      find: `
        SELECT * FROM vw_rawmaterialstocksadjustments ORDER BY rawMaterialStockAdjustmentId DESC;
      `,
      findById: `
        SELECT * FROM vw_rawmaterialstocksadjustments WHERE rawMaterialStockAdjustmentId = ?;
      `,
      findDetailByAdjustmentId: `
        SELECT * FROM vw_rawmaterialstockadjustmentdetails WHERE rawMaterialStockAdjustmentId = ?;
      `,
      add: `
        INSERT INTO rawmaterialstockadjustments (adjustmentDatetime, comments, adjustmentBy, authorizedBy)
        VALUES((SELECT CONVERT_TZ(NOW(), '+00:00', '-06:00')), ?, ?, ?);
      `,
      addDetail: `
        INSERT INTO rawmaterialstockadjustmentdetails (rawMaterialStockAdjustmentId, rawMaterialId, locationId, quantity, adjustmentType, comments)
        VALUES ?;
      `
    }
  }
}

controller.find = (req, res) => {
  req.getConnection(
    connUtil.connFunc(queries.find, [], res)
  );
}

controller.findTaxesByRawMaterialId = (req, res) => {
  const { rawMaterialId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findTaxesByRawMaterialId, [ rawMaterialId || 0 ], res));
}

controller.findByLocationStockData = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationStockData, [ locationId || 0 ], res));
}

controller.findDeactivated = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findDeactivated, [], res));
}

controller.findByMultipleParams = (req, res) => {
  const { locationId, rawMaterialFilterParam, excludeServices, rawMaterialDistributionsId } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.findByMultipleParams,
      [
        locationId || 0,
        `%${String(rawMaterialFilterParam).trim()}%` || '',
        `%${String(rawMaterialFilterParam).trim()}%` || '',
        String(rawMaterialFilterParam).trim() || '',
        String(rawMaterialFilterParam).trim() || '',
        excludeServices || 0,
        excludeServices || 0,
        rawMaterialDistributionsId || 0,
        rawMaterialDistributionsId || 0,
        rawMaterialDistributionsId || 0
      ],
      res
    ));
}

controller.findLocationStockCheck = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findLocationStockCheck, [ locationId || 0 ], res));
}

controller.add = (req, res) => {
  const {
    code,
    name,
    brandId,
    categoryId,
    ubicationId,
    measurementUnitId,
    barcode,
    cost,
    isService,
    isTaxable,
    enabledForProduction,
    packageContent,
    rawMaterialTypeId
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.add,
      [
        code,
        name,
        brandId,
        categoryId,
        ubicationId,
        measurementUnitId,
        barcode || null,
        cost,
        isService,
        isTaxable,
        enabledForProduction,
        packageContent || 1,
        rawMaterialTypeId || 1
      ],
      res
    )
  );
}

controller.update = (req, res) => {
  const {
    code,
    name,
    brandId,
    categoryId,
    ubicationId,
    measurementUnitId,
    barcode,
    cost,
    isService,
    isTaxable,
    enabledForProduction,
    packageContent,
    rawMaterialTypeId,
    rawMaterialDistributionsId,
    rawMaterialId
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.update, 
      [
        code,
        name,
        brandId,
        categoryId,
        ubicationId,
        measurementUnitId,
        barcode,
        cost,
        isService,
        isTaxable,
        enabledForProduction,
        packageContent || 1,
        rawMaterialTypeId || 1,
        rawMaterialDistributionsId || 1,
        rawMaterialId || 0
      ],
      res
    )
  );
}

controller.remove = (req, res) => {
  const { rawMaterialId } = req.params;
  req.getConnection(connUtil.connSPFunc(queries.remove, [ rawMaterialId || 0 ], res));
}

controller.reactivate = (req, res) => {
  const { rawMaterialId } = req.params;
  req.getConnection(connUtil.connSPFunc(queries.reactivate, [ rawMaterialId || 0 ], res));
}

controller.checkAvailability = (req, res) => {
  const { locationId, rawMaterialId, quantity } = req.params;
  req.getConnection(connUtil.connFunc(queries.checkAvailability, [ locationId || 0, rawMaterialId || 0, quantity || 0, locationId || 0, rawMaterialId || 0 ], res));
}

// RAW MATERIAL LOCATION STOCKS

controller.stocks = {};
controller.stocks.adjustments = {};

controller.stocks.findByRawMaterialId = (req, res) => {
  const { rawMaterialId } = req.params;
  req.getConnection(connUtil.connFunc(queries.stocks.findByRawMaterialId, [ rawMaterialId || 0 ], res));
}

controller.stocks.updateById = (req, res) => {
  const { initialStock, stock, minStockAlert, rawMaterialStockId } = req.body;
  req.getConnection(connUtil.connFunc(queries.stocks.updateById, [ initialStock || 0, stock || 0, minStockAlert || 1, rawMaterialStockId || 0 ], res));
}

controller.stocks.adjustments.find = (req, res) => {
  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.find,
      [],
      res
    )
  );
}

controller.stocks.adjustments.findById = (req, res) => {
  const { rawMaterialStockAdjustmentId } = req.params;

  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.findById,
      [ rawMaterialStockAdjustmentId ],
      res
    )
  );
}

controller.stocks.adjustments.findDetailByAdjustmentId = (req, res) => {
  const { rawMaterialStockAdjustmentId } = req.params;
  
  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.findDetailByAdjustmentId,
      [ rawMaterialStockAdjustmentId ],
      res
    )
  );
}

controller.stocks.adjustments.add = (req, res) => {
  const { idtoauth } = req.headers;
  const {
    comments, authorizedBy
  } = req.body;

  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.add,
      [
        comments,
        idtoauth,
        authorizedBy
      ],
      res
    )
  );
}

// EXPECTED req.body => bulkData = [[rawMaterialStockAdjustmentId, rawMaterialId, locationId, quantity, adjustmentType, comments]]
controller.stocks.adjustments.addDetails = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.stocks.adjustments.addDetail, [ bulkData ], res));
}

export default controller;
