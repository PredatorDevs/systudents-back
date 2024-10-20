CREATE DEFINER=`predator`@`%` PROCEDURE `usp_ReportShiftcutSales`(
  prmt_shiftcut INT
)
BEGIN
	CREATE TEMPORARY TABLE tmp_SalesByShiftcut (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT NOT NULL
	);

	INSERT INTO tmp_SalesByShiftcut (saleId) 
	SELECT id 
	FROM sales
	WHERE shiftcutId = prmt_shiftcut
    AND isActive = 1;

	SET @iterator = 1;
	SET @limit = (SELECT IFNULL(MAX(id), 0) FROM tmp_SalesByShiftcut);
	
	CREATE TEMPORARY TABLE tmp_ResultReportShiftcutSales (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT,
        customerId INT,
        productId INT,
        customerFullname VARCHAR(256),
        productName VARCHAR(64),
        cashSale DECIMAL(18, 2),
        creditSale DECIMAL(18, 2)
	);
    
	WHILE @iterator <= @limit DO
		SET @currentSaleId = (SELECT saleId FROM tmp_SalesByShiftcut WHERE id = @iterator LIMIT 1);
        
        -- =================================================================================================

		CREATE TEMPORARY TABLE tmp_SaleDetailPaymentInfo (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			saleId INT,
			customerId INT,
			saleDetailId INT,
			productId INT,
			customerFullname VARCHAR(256),
			productName VARCHAR(64),
			subtotal DECIMAL(18, 2),
			cashSale DECIMAL(18, 2),
			creditSale DECIMAL(18, 2)
		);
		
		-- INSERT INTO tmp_SaleDetailPaymentInfo (saleId, saleDetailId, productId, subtotal, cashSale, creditSale) 
		INSERT INTO tmp_SaleDetailPaymentInfo (saleId, customerId, saleDetailId, productId, customerFullname, productName, subtotal, cashSale, creditSale) 
		SELECT saledetails.saleId, sales.customerId, saledetails.id, saledetails.productId, customers.fullName, products.`name`, (unitCost * quantity), 0, 0 
		FROM saledetails
		INNER JOIN products ON saledetails.productId = products.id
		INNER JOIN sales ON saledetails.saleId = sales.id
		INNER JOIN customers ON sales.customerId = customers.id
		WHERE saledetails.saleId = @currentSaleId AND saledetails.isActive = 1;
		
		SET @iterator1 = 1;
		SET @limit1 = (SELECT IFNULL(MAX(id), 0) FROM tmp_SaleDetailPaymentInfo);
		
		SET @saleTotalPaid = (SELECT fn_getsaletotalpaid(prmt_sale));
		
		WHILE (@iterator1 <= @limit) DO
			SET @currentSaleDetailSubTotal = (SELECT subtotal FROM tmp_SaleDetailPaymentInfo WHERE id = @iterator);
			IF (@saleTotalPaid >= @currentSaleDetailSubTotal)
			THEN
				UPDATE tmp_SaleDetailPaymentInfo SET cashSale = subtotal WHERE id = @iterator;
				SET @saleTotalPaid = @saleTotalPaid - @currentSaleDetailSubTotal;        
			ELSE
				UPDATE tmp_SaleDetailPaymentInfo SET cashSale = @saleTotalPaid, creditSale = subtotal - @saleTotalPaid WHERE id = @iterator;
				SET @saleTotalPaid = 0;
			END IF;
			SET @iterator1 = @iterator1 + 1;
		END WHILE;
		
		SELECT * FROM tmp_SaleDetailPaymentInfo;
		DROP TABLE tmp_SaleDetailPaymentInfo;
        
        -- =================================================================================================
        
		INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
		SELECT 
			sales.id AS saleId,
			sales.customerId,
			saledetails.productId,
			customers.fullName AS customerFullname,
			products.`name` AS productName,
			SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
			SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
		FROM 
			saledetails
			INNER JOIN products ON saledetails.productId = products.id
			INNER JOIN sales ON saledetails.saleId = sales.id
			INNER JOIN customers ON sales.customerId = customers.id
		WHERE 
			sales.id = @currentSaleId
		GROUP BY
			sales.id,
			sales.customerId,
			sales.total,
			saledetails.productId,
			products.`name`,
			customers.fullName
		UNION
		SELECT 
			NULL AS saleId,
			NULL AS customerId,
			NULL AS productId,
			"" AS customerFullname,
			"Total" AS productName,
			SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
			SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
		FROM 
			saledetails
			INNER JOIN sales ON saledetails.saleId = sales.id
		WHERE 
			sales.id = @currentSaleId
		GROUP BY
			sales.id,
			sales.customerId,
			sales.total;

		SET @iterator = @iterator + 1;
	END WHILE;
    
    INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
	SELECT 
		NULL AS saleId,
		NULL AS customerId,
		NULL AS productId,
		"" AS customerFullname,
		"TOTAL REGISTRADO" AS productName,
		SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
		SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
	FROM 
		saledetails
		INNER JOIN sales ON saledetails.saleId = sales.id
	WHERE 
		sales.shiftcutId = prmt_shiftcut;
	
    SELECT * FROM tmp_ResultReportShiftcutSales;
    
	DROP TABLE tmp_ResultReportShiftcutSales;
	DROP TABLE tmp_SalesByShiftcut;
END











CREATE DEFINER=`predator`@`%` PROCEDURE `usp_ReportShiftcutSales`(
  prmt_shiftcut INT
)
BEGIN
	CREATE TEMPORARY TABLE tmp_SalesByShiftcut (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT NOT NULL
	);

	INSERT INTO tmp_SalesByShiftcut (saleId) 
	SELECT id 
	FROM sales
	WHERE shiftcutId = prmt_shiftcut
    AND isActive = 1;

	SET @iterator = 1;
	SET @limit = (SELECT IFNULL(MAX(id), 0) FROM tmp_SalesByShiftcut);
	
	CREATE TEMPORARY TABLE tmp_ResultReportShiftcutSales (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT,
        customerId INT,
        productId INT,
        customerFullname VARCHAR(256),
        productName VARCHAR(64),
        cashSale DECIMAL(18, 2),
        creditSale DECIMAL(18, 2)
	);
    
    
	WHILE @iterator <= @limit DO
		SET @currentSaleId = (SELECT saleId FROM tmp_SalesByShiftcut WHERE id = @iterator LIMIT 1);
        
        -- =================================================================================================
		
         CREATE TEMPORARY TABLE tmp_SaleDetailPaymentInfo (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			saleId INT,
			customerId INT,
			saleDetailId INT,
			productId INT,
			customerFullname VARCHAR(256),
			productName VARCHAR(64),
			subtotal DECIMAL(18, 2),
			cashSale DECIMAL(18, 2),
			creditSale DECIMAL(18, 2)
		);
        
		-- INSERT INTO tmp_SaleDetailPaymentInfo (saleId, saleDetailId, productId, subtotal, cashSale, creditSale) 
		INSERT INTO tmp_SaleDetailPaymentInfo (saleId, customerId, saleDetailId, productId, customerFullname, productName, subtotal, cashSale, creditSale) 
		SELECT saledetails.saleId, sales.customerId, saledetails.id, saledetails.productId, customers.fullName, products.`name`, (unitCost * quantity), 0, 0 
		FROM saledetails
		INNER JOIN products ON saledetails.productId = products.id
		INNER JOIN sales ON saledetails.saleId = sales.id
		INNER JOIN customers ON sales.customerId = customers.id
		WHERE saledetails.saleId = @currentSaleId AND saledetails.isActive = 1;
		
		SET @iterator1 = 1;
		SET @limit1 = (SELECT IFNULL(MAX(id), 0) FROM tmp_SaleDetailPaymentInfo);
		
		SET @saleTotalPaid = (SELECT fn_getsaletotalpaid(@currentSaleId));
		
		WHILE (@iterator1 <= @limit1) DO
			SET @currentSaleDetailSubTotal = (SELECT subtotal FROM tmp_SaleDetailPaymentInfo WHERE id = @iterator);
			IF (@saleTotalPaid >= @currentSaleDetailSubTotal)
			THEN
				UPDATE tmp_SaleDetailPaymentInfo SET cashSale = subtotal WHERE id = @iterator;
				SET @saleTotalPaid = @saleTotalPaid - @currentSaleDetailSubTotal;        
			ELSE
				UPDATE tmp_SaleDetailPaymentInfo SET cashSale = @saleTotalPaid, creditSale = subtotal - @saleTotalPaid WHERE id = @iterator;
				SET @saleTotalPaid = 0;
			END IF;
			SET @iterator1 = @iterator1 + 1;
		END WHILE;
		        
        -- =================================================================================================
        
		INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
		SELECT saleId, customerId, productId, customerFullname, productName, cashSale, creditSale
        FROM tmp_SaleDetailPaymentInfo
		UNION
		SELECT 
			NULL AS saleId,
			NULL AS customerId,
			NULL AS productId,
			"" AS customerFullname,
			"Total" AS productName,
			SUM(cashSale) AS cashSale,
			SUM(creditSale) AS creditSale
		FROM tmp_SaleDetailPaymentInfo;
		
		DROP TABLE tmp_SaleDetailPaymentInfo;
    
		SET @iterator = @iterator + 1;
	END WHILE;
    
    INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
	SELECT 
		NULL AS saleId,
		NULL AS customerId,
		NULL AS productId,
		"" AS customerFullname,
		"TOTAL REGISTRADO" AS productName,
		SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
		SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
	FROM 
		saledetails
		INNER JOIN sales ON saledetails.saleId = sales.id
	WHERE 
		sales.shiftcutId = prmt_shiftcut;
	
    SELECT * FROM tmp_ResultReportShiftcutSales;
    
	DROP TABLE tmp_ResultReportShiftcutSales;
	DROP TABLE tmp_SalesByShiftcut;
END

























CREATE DEFINER=`predator`@`%` PROCEDURE `usp_ReportShiftcutSales`(
  prmt_shiftcut INT
)
BEGIN
	CREATE TEMPORARY TABLE tmp_SalesByShiftcut (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT NOT NULL
	);

	INSERT INTO tmp_SalesByShiftcut (saleId) 
	SELECT id 
	FROM sales
	WHERE shiftcutId = prmt_shiftcut
    AND isActive = 1;

	SET @iterator = 1;
	SET @limit = (SELECT IFNULL(MAX(id), 0) FROM tmp_SalesByShiftcut);
	
	CREATE TEMPORARY TABLE tmp_ResultReportShiftcutSales (
		id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
		saleId INT,
        customerId INT,
        productId INT,
        customerFullname VARCHAR(256),
        productName VARCHAR(64),
        cashSale DECIMAL(18, 2),
        creditSale DECIMAL(18, 2)
	);
    
	WHILE @iterator <= @limit DO
		SET @currentSaleId = (SELECT saleId FROM tmp_SalesByShiftcut WHERE id = @iterator LIMIT 1);
                
		INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
		SELECT 
			sales.id AS saleId,
			sales.customerId,
			saledetails.productId,
			customers.fullName AS customerFullname,
			products.`name` AS productName,
			SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
			SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
		FROM 
			saledetails
			INNER JOIN products ON saledetails.productId = products.id
			INNER JOIN sales ON saledetails.saleId = sales.id
			INNER JOIN customers ON sales.customerId = customers.id
		WHERE 
			sales.id = @currentSaleId
		GROUP BY
			sales.id,
			sales.customerId,
			sales.total,
			saledetails.productId,
			products.`name`,
			customers.fullName
		UNION
		SELECT 
			NULL AS saleId,
			NULL AS customerId,
			NULL AS productId,
			"" AS customerFullname,
			"Total" AS productName,
			SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
			SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
		FROM 
			saledetails
			INNER JOIN sales ON saledetails.saleId = sales.id
		WHERE 
			sales.id = @currentSaleId
		GROUP BY
			sales.id,
			sales.customerId,
			sales.total;

		SET @iterator = @iterator + 1;
	END WHILE;
    
    INSERT INTO tmp_ResultReportShiftcutSales (saleId, customerId, productId, customerFullname, productName, cashSale, creditSale)
	SELECT 
		NULL AS saleId,
		NULL AS customerId,
		NULL AS productId,
		"" AS customerFullname,
		"TOTAL REGISTRADO" AS productName,
		SUM(IF (sales.docType = 1, (saledetails.unitCost * saledetails.quantity), 0)) AS cashSale,
		SUM(IF (sales.docType = 2, (saledetails.unitCost * saledetails.quantity), 0)) AS creditSale
	FROM 
		saledetails
		INNER JOIN sales ON saledetails.saleId = sales.id
	WHERE 
		sales.shiftcutId = prmt_shiftcut;
	
    SELECT * FROM tmp_ResultReportShiftcutSales;
    
	DROP TABLE tmp_ResultReportShiftcutSales;
	DROP TABLE tmp_SalesByShiftcut;
END