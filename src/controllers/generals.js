import connUtil from "../helpers/connectionUtil.js";
import dayjs from 'dayjs';
import locale from 'dayjs/locale/es-mx.js';

dayjs.locale(locale);

const controller = {};

const queries = {
  findBanks: `SELECT id, name FROM banks WHERE isActive = 1 ORDER BY name;`,
  findProductDistributions: `SELECT id, name, iconUrl FROM productdistributions ORDER BY name;`,
  findRawMaterialDistributions: `SELECT id, name, iconUrl FROM rawmaterialdistributions ORDER BY name;`,
  findDocumentTypes: `SELECT id, name, enableForSales, enableForPurchases, enabledForExpenses FROM documenttypes WHERE isActive = 1;`,
  findPaymentMethods: `SELECT id, name FROM paymentmethods WHERE isActive = 1;`,
  findPaymentTypes: `SELECT id, name FROM paymenttypes WHERE isActive = 1;`,
  findAccountingAccounts: `SELECT id, name, num, hierarchyLevel FROM accountingaccounts WHERE isActive = 1 ORDER BY num;`,
  validatePolicyDocNumber: `SELECT fn_validatepolicydocnumber(?) AS validated;`,
  findDepartments: `SELECT departmentId, departmentName, departmentZone FROM vw_cities GROUP BY departmentId, departmentName, departmentZone;`,
  findTaxes: `SELECT * FROM taxes;`,
  findCities: `SELECT departmentId, cityId, cityName FROM vw_cities;`,
  findPackageTypes: `SELECT id, name FROM packagetypes WHERE isActive = 1;`,
  findRelationships: `SELECT id, name FROM relationships WHERE isActive = 1;`,
  findProductTypes: `SELECT id, name FROM producttypes WHERE isActive = 1;`,
  findRawMaterialTypes: `SELECT id, name FROM rawmaterialtypes WHERE isActive = 1;`,
  findEconomicActivities: `SELECT id, name FROM economicactivities WHERE isActive = 1 ORDER BY name;`,
}

controller.findBanks = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findBanks, [], res));
}

controller.findProductDistributions = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findProductDistributions, [], res));
}

controller.findRawMaterialDistributions = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findRawMaterialDistributions, [], res));
}

controller.findDocumentTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findDocumentTypes, [], res));
}

controller.findPaymentMethods = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findPaymentMethods, [], res));
}

controller.findPaymentTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findPaymentTypes, [], res));
}

controller.findAccountingAccounts = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findAccountingAccounts, [], res));
}

controller.validatePolicyDocNumber = (req, res) => {
  const { docNumber } = req.body;
  req.getConnection(connUtil.connFunc(queries.validatePolicyDocNumber, [ docNumber ], res));
}

controller.findDepartments = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findDepartments, [], res));
}

controller.findTaxes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findTaxes, [], res));
}

controller.findCities = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findCities, [], res));
}

controller.findPackageTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findPackageTypes, [], res));
}

controller.findRelationships = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findRelationships, [], res));
}

controller.findProductTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findProductTypes, [], res));
}

controller.findRawMaterialTypes = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findRawMaterialTypes, [], res));
}

controller.findEconomicActivities = (req, res) => {
  req.getConnection(connUtil.connFunc(queries.findEconomicActivities, [], res));
}

controller.checkUniquenessValue = (req, res) => {
  const { table, field, value, updatingId } = req.query;
  if (updatingId !== null) {
    req.getConnection(connUtil.connFunc(`SELECT COUNT(*) AS totalFound FROM ${table} WHERE ${field} = ? AND id != ?;`, [ value, updatingId ], res));
  } else {
    req.getConnection(connUtil.connFunc(`SELECT COUNT(*) AS totalFound FROM ${table} WHERE ${field} = ?;`, [ value ], res));
  }
}

controller.getCurrentServerTime = (req, res) => {
  const fechaActual = dayjs();

  const fechaMenosSeisHoras = fechaActual.subtract(6, 'hour');

  const currentDate = dayjs().format('YYYY-MM-DD');
  const currentTime = dayjs().format('HH:mm:ss');

  const currentLocalDate = fechaMenosSeisHoras.format('YYYY-MM-DD');
  const currentLocalTime = fechaMenosSeisHoras.format('HH:mm:ss');

  res.status(200).json({ message: `En el servidor son las ${currentDate} ${currentTime} : En SV: ${currentLocalDate} ${currentLocalTime}` });
}

export default controller;
