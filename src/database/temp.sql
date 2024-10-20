CREATE TABLE cportal.ShippingLabelAttachments (
	Id int IDENTITY(1,1) NOT NULL,
	ShippingLabelId int NOT NULL,
	FileTypeId int NOT NULL,
	Name varchar(256) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	FileExtension varchar(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	Description varchar(512) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	Url varchar(2048) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	IsActive bit DEFAULT 1 NOT NULL,
	CreatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	UpdatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	FileFor tinyint DEFAULT 1 NOT NULL,
	CONSTRAINT PK__ShippingLabelAttachments__3214EC07 PRIMARY KEY (Id)
);


-- cportal.ShippingLabelAttachments foreign keys

ALTER TABLE cportal.ShippingLabelAttachments ADD CONSTRAINT FK__ShippingL__FileT__4E2FDF30 FOREIGN KEY (FileTypeId) REFERENCES dbo.Types(Id);
ALTER TABLE cportal.ShippingLabelAttachments ADD CONSTRAINT FK__ShippingL__Shipp__4D3BBAF7 FOREIGN KEY (ShippingLabelId) REFERENCES cportal.ShippingLabels(Id);

-- cportal.ShippingLabelReturnDocumentation definition

-- Drop table

-- DROP TABLE cportal.ShippingLabelReturnDocumentation;

CREATE TABLE cportal.ShippingLabelReturnDocumentation (
	Id int IDENTITY(1,1) NOT NULL,
	ShippingLabelId int NOT NULL,
	IncludePackagingInstructions bit DEFAULT 0 NOT NULL,
	EstimatedDays decimal(10,2) DEFAULT 0 NOT NULL,
	Prices decimal(18,2) DEFAULT 0 NOT NULL,
	TrackingInformation varchar(128) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	IsActive bit DEFAULT 1 NOT NULL,
	CreatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	UpdatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	CreatedBy nvarchar(450) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	UpdatedBy nvarchar(450) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	CONSTRAINT PK__Shipping__3214EC07F0011281 PRIMARY KEY (Id)
);


-- cportal.ShippingLabelReturnDocumentation foreign keys

ALTER TABLE cportal.ShippingLabelReturnDocumentation ADD CONSTRAINT FK__ShippingL__Creat__5EB12B13 FOREIGN KEY (CreatedBy) REFERENCES dbo.AspNetUsers(Id);
ALTER TABLE cportal.ShippingLabelReturnDocumentation ADD CONSTRAINT FK__ShippingL__Shipp__5DBD06DA FOREIGN KEY (ShippingLabelId) REFERENCES cportal.ShippingLabels(Id);
ALTER TABLE cportal.ShippingLabelReturnDocumentation ADD CONSTRAINT FK__ShippingL__Updat__5FA54F4C FOREIGN KEY (UpdatedBy) REFERENCES dbo.AspNetUsers(Id);

-- cportal.ShippingReturnTrackingInformation definition

-- Drop table

-- DROP TABLE cportal.ShippingReturnTrackingInformation;

CREATE TABLE cportal.ShippingReturnTrackingInformation (
	Id int IDENTITY(1,1) NOT NULL,
	ShippingLabelId int NOT NULL,
	TrackingInfo varchar(128) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	IsActive bit DEFAULT 1 NOT NULL,
	CreatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	UpdatedAt datetime2 DEFAULT getutcdate() NOT NULL,
	CreatedBy nvarchar(450) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	UpdatedBy nvarchar(450) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	CONSTRAINT PK__Shipping__3214EC07DED95824 PRIMARY KEY (Id)
);


-- cportal.ShippingReturnTrackingInformation foreign keys

ALTER TABLE cportal.ShippingReturnTrackingInformation ADD CONSTRAINT FK__ShippingR__Creat__54339CA0 FOREIGN KEY (CreatedBy) REFERENCES dbo.AspNetUsers(Id);
ALTER TABLE cportal.ShippingReturnTrackingInformation ADD CONSTRAINT FK__ShippingR__Shipp__533F7867 FOREIGN KEY (ShippingLabelId) REFERENCES cportal.ShippingLabels(Id);
ALTER TABLE cportal.ShippingReturnTrackingInformation ADD CONSTRAINT FK__ShippingR__Updat__5527C0D9 FOREIGN KEY (UpdatedBy) REFERENCES dbo.AspNetUsers(Id);
