import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  // find: `SELECT * FROM vw_productstocks;`,
  find: `SELECT * FROM vw_products;`,
  findByLocationStockData: `
    SELECT
      p.*,
      ROUND(ps.initialStock, 2) AS currentLocationInitialStock,
      ROUND(ps.stock, 2) AS currentLocationStock,
      ROUND(ps.minStockAlert, 2) AS currentLocationMinStockAlert,
      l.name AS locationName
    FROM
      vw_products p
      INNER JOIN productstocks ps ON p.productId = ps.productId
      INNER JOIN locations l ON ps.locationId = l.id
    WHERE
      ps.locationId = ?;
  `,
  findDeactivated: `
    SELECT
        p.*
      FROM
        vw_productsdeactivated p
  `,
  findTaxesByProductId: `SELECT taxesData FROM vw_products WHERE productId = ?`,
  findByMultipleParams: `
    SELECT
      prd.*,
      (
        SELECT ROUND(stock, 2) AS stock
        FROM vw_productstocks
        WHERE locationId = ?
        AND productId = prd.productId
      ) AS currentStock
    FROM
      vw_products prd
    WHERE
      (
        productId LIKE ?
        OR productName LIKE ?
        OR productBarcode = ?
        OR productCode = ?
      ) AND (
        (? = 0)
        OR
        (? = 1 AND productIsService != 1)
      ) AND (
        (? = 0)
        OR
        ((? != 0) AND (prd.productDistributionsId = ? OR prd.productDistributionsId IS NULL))
      );
  `,
  findLocationStockCheck: `
    SELECT
      vw_ps.productStockId,
      vw_ps.productName,
      (
        SELECT propri.price 
        FROM productprices propri
        WHERE propri.productId = vw_ps.productId
        ORDER BY propri.id
        LIMIT 1
      ) AS price1,
      (
        SELECT propri.price 
        FROM productprices propri
        WHERE propri.productId = vw_ps.productId
        ORDER BY propri.id
        LIMIT 1, 1
      ) AS price2,
      (
        SELECT propri.price 
        FROM productprices propri
        WHERE propri.productId = vw_ps.productId
        ORDER BY propri.id
        LIMIT 2, 1
      ) AS price3,
      ROUND(vw_ps.stock, 2) AS stock,
      ROUND(vw_ps.minStockAlert, 2) AS minStockAlert,
      vp.productCost AS productCost,
      vp.productTotalCost AS productTotalCost
    FROM
      vw_productstocks vw_ps
      INNER JOIN vw_products vp ON vw_ps.productId = vp.productId
    WHERE
      vw_ps.locationId = ?
      AND (SELECT prd.isActive FROM products prd WHERE prd.id = vw_ps.productId) = 1
    ORDER BY
      vw_ps.productName;
  `,
  add: `
    INSERT INTO products (
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
      productTypeId
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
      products
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
      productTypeId = IFNULL(?, productTypeId),
      productDistributionsId = IFNULL(?, productDistributionsId)
    WHERE
      id = ?;
  `,
  remove: `
    CALL usp_RemoveProduct(?);
  `,
  reactivate: `
    UPDATE products SET isActive = 1 WHERE id = ?;
  `,
  checkAvailability: `
    SELECT fn_checkifproductisavailable(?, ?, ?) AS isAvailable, fn_getproductcurrentstock(?, ?) AS currentStock;
  `,
  stocks: {
    findByProductId: `
      SELECT 
        *
      FROM
        vw_productstocks
      WHERE
        productId = ?;
    `,
    updateById: `
      UPDATE
        productstocks
      SET
        initialStock = ?,
        stock = ?,
        minStockAlert = ?
      WHERE
        id = ?;
    `,
    adjustments: {
      find: `
        SELECT * FROM vw_productstocksadjustments ORDER BY productStockAdjustmentId DESC;
      `,
      findById: `
        SELECT * FROM vw_productstocksadjustments WHERE productStockAdjustmentId = ?;
      `,
      findDetailByAdjustmentId: `
        SELECT * FROM vw_productstockadjustmentdetails WHERE productStockAdjustmentId = ?;
      `,
      add: `
        INSERT INTO productstockadjustments (adjustmentDatetime, comments, adjustmentBy, authorizedBy)
        VALUES((SELECT CONVERT_TZ(NOW(), '+00:00', '-06:00')), ?, ?, ?);
      `,
      addDetail: `
        INSERT INTO productstockadjustmentdetails (productStockAdjustmentId, productId, locationId, quantity, adjustmentType, comments)
        VALUES ?;
      `
    }
  },
  prices: {
    findByProductId: `
      SELECT
        id,
        productId,
        ROUND(price, 2) AS price,
        ROUND(profitRate, 2) AS profitRate,
        profitRateFixed,
        requireAuthToApply,
        isDefault 
      FROM
        productprices
      WHERE
        productId = ?
      AND
        isActive = 1;
    `,
    add: `
      INSERT INTO productprices (productId, price, profitRate, profitRateFixed, requireAuthToApply) VALUES ?;`,
    update: `
      UPDATE
        productprices
      SET
        price = IFNULL(?, price),
        profitRate = IFNULL(?, profitRate),
        profitRateFixed = IFNULL(?, profitRateFixed),
        requireAuthToApply = IFNULL(?, requireAuthToApply),
        updatedAt = NOW()
      WHERE
        id = ?;
    `,
    remove: `UPDATE productprices SET isActive = 0, updatedAt = NOW() WHERE id = ?;`
  },
  packageConfigs: {
    findByProductId: `
      SELECT * FROM vw_productpackageconfigs WHERE productId = ?;
    `,
    add: `
      INSERT INTO productpackageconfig (packageTypeId, productId, measurementUnitId, quantity, createAt, isActive)
      VALUES (?, ?, ?, ?, utc_timestamp(), 1);
    `,
    remove: `
      UPDATE productpackageconfig SET isActive = 0 WHERE id = ?;
    `
  },
}

controller.find = (req, res) => {
  req.getConnection(
    connUtil.connFunc(queries.find, [], res)
  );
}

controller.findTaxesByProductId = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findTaxesByProductId, [ productId || 0 ], res));
}

controller.findByLocationStockData = (req, res) => {
  const { locationId } = req.params;
  req.getConnection(connUtil.connFunc(queries.findByLocationStockData, [ locationId || 0 ], res));
}

controller.findDeactivated = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findDeactivated, [], res));
}

controller.findByMultipleParams = (req, res) => {
  const { locationId, productFilterParam, excludeServices, productDistributionsId } = req.params;
  req.getConnection(
    connUtil.connFunc(
      queries.findByMultipleParams,
      [
        locationId || 0,
        `%${String(productFilterParam).trim()}%` || '',
        `%${String(productFilterParam).trim()}%` || '',
        String(productFilterParam).trim() || '',
        String(productFilterParam).trim() || '',
        excludeServices || 0,
        excludeServices || 0,
        productDistributionsId || 0,
        productDistributionsId || 0,
        productDistributionsId || 0
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
    productTypeId
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
        productTypeId || 1
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
    productTypeId,
    productDistributionsId,
    productId
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
        productTypeId || 1,
        productDistributionsId || 1,
        productId || 0
      ],
      res
    )
  );
}

controller.remove = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connSPFunc(queries.remove, [ productId || 0 ], res));
}

controller.reactivate = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connSPFunc(queries.reactivate, [ productId || 0 ], res));
}

controller.checkAvailability = (req, res) => {
  const { locationId, productId, quantity } = req.params;
  req.getConnection(connUtil.connFunc(queries.checkAvailability, [ locationId || 0, productId || 0, quantity || 0, locationId || 0, productId || 0 ], res));
}

// PRODUCT LOCATION STOCKS

controller.stocks = {};
controller.stocks.adjustments = {};

controller.stocks.findByProductId = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connFunc(queries.stocks.findByProductId, [ productId || 0 ], res));
}

controller.stocks.updateById = (req, res) => {
  const { initialStock, stock, minStockAlert, productStockId } = req.body;
  req.getConnection(connUtil.connFunc(queries.stocks.updateById, [ initialStock || 0, stock || 0, minStockAlert || 1, productStockId || 0 ], res));
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
  const { productStockAdjustmentId } = req.params;

  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.findById,
      [ productStockAdjustmentId ],
      res
    )
  );
}

controller.stocks.adjustments.findDetailByAdjustmentId = (req, res) => {
  const { productStockAdjustmentId } = req.params;
  
  req.getConnection(
    connUtil.connFunc(
      queries.stocks.adjustments.findDetailByAdjustmentId,
      [ productStockAdjustmentId ],
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

// EXPECTED req.body => bulkData = [[productStockAdjustmentId, productId, locationId, quantity, adjustmentType, comments]]
controller.stocks.adjustments.addDetails = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.stocks.adjustments.addDetail, [ bulkData ], res));
}

// PRODUCT PRICES

controller.prices = {};

controller.prices.findByProductId = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connFunc(queries.prices.findByProductId, [ productId || 0 ], res));
}

// EXPECTED req.body => prices = [[productId, price, profitRate, profitRateFixed, requireAuthToApply], [...]]
controller.prices.add = (req, res) => {
  const { bulkData } = req.body;
  req.getConnection(connUtil.connFunc(queries.prices.add, [ bulkData ], res));
}

controller.prices.update = (req, res) => {
  const { price, profitRate, profitRateFixed, requireAuthToApply, productPriceId } = req.body;
  req.getConnection(connUtil.connFunc(queries.prices.update, [ price, profitRate, profitRateFixed, requireAuthToApply, productPriceId || 0 ], res));
}

controller.prices.remove = (req, res) => {
  const { productPriceId } = req.params;
  req.getConnection(connUtil.connFunc(queries.prices.remove, [ productPriceId || 0 ], res));
}

controller.packageConfigs = {};

controller.packageConfigs.findByProductId = (req, res) => {
  const { productId } = req.params;
  req.getConnection(connUtil.connFunc(queries.packageConfigs.findByProductId, [ productId || 0 ], res));
}

controller.packageConfigs.add = (req, res) => {
  const { packageTypeId, productId, measurementUnitId, quantity } = req.body;
  req.getConnection(connUtil.connFunc(queries.packageConfigs.add, [ packageTypeId, productId, measurementUnitId, quantity ], res));
}

controller.packageConfigs.remove = (req, res) => {
  const { productPackageConfigId } = req.params;
  req.getConnection(connUtil.connFunc(queries.packageConfigs.remove, [ productPackageConfigId || 0 ], res));
}

export default controller;
