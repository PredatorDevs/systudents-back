import express, { json, urlencoded, static as staticserve } from 'express';
import { createServer } from 'node:http';
import cron from 'node-cron';
import axios from 'axios';

import path from 'path';
import morgan from 'morgan';
import mysql2, { createPool } from 'mysql2';
import expMyConn from 'express-myconnection';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fileUpload from 'express-fileupload';

import dayjs from 'dayjs';
import locale from 'dayjs/locale/es-mx.js';

dayjs.locale(locale);

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

import ip from 'ip';
const { address } = ip;

import authRoutes from '../src/routes/authorizations.js';
import brandsRoutes from '../src/routes/brands.js';
import cashiersRoutes from '../src/routes/cashiers.js';
import categoriesRoutes from '../src/routes/categories.js';
import contractsRoutes from '../src/routes/contracts.js';
import customersRoutes from '../src/routes/customers.js';
import deliveryRoutesRoutes from '../src/routes/deliveryRoutes.js';
import dteRoutes from '../src/routes/dte.js';
import expensesRoutes from '../src/routes/expenses.js';
import furnishingsRoutes from '../src/routes/furnishings.js';
import generalsRoutes from '../src/routes/generals.js';
import locationsRoutes from '../src/routes/locations.js';
import mailsRoutes from '../src/routes/mails.js';
import measurementUnitsRoutes from '../src/routes/measurementUnits.js';
import orderSalesRoutes from '../src/routes/orderSales.js';
import parkingCheckoutsRoutes from '../src/routes/parkingCheckouts.js';
import parkingExpensesRoutes from '../src/routes/parkingExpenses.js';
import parkingReportsRoutes from '../src/routes/parkingReports.js';
import policiesRoutes from '../src/routes/policies.js';
import productionsRoutes from '../src/routes/productions.js';
import productPurchasesRoutes from '../src/routes/productPurchases.js';
import productsRoutes from '../src/routes/products.js';
import rawMaterialsRoutes from '../src/routes/rawMaterials.js';
import rawMaterialPurchasesRoutes from '../src/routes/rawMaterialPurchases.js';
import reportsRoutes from '../src/routes/reports.js';
import rolesRoutes from '../src/routes/roles.js';
import salesRoutes from '../src/routes/sales.js';
import sellersRoutes from '../src/routes/sellers.js';
import shiftcutsRoutes from '../src/routes/shiftcuts.js';
import suppliersRoutes from '../src/routes/suppliers.js';
import transfersRoutes from '../src/routes/transfers.js';
import ubicationsRoutes from '../src/routes/ubications.js';
import usersRoutes from '../src/routes/users.js';

// const app = express();

const server = express();

server.set('port', process.env.PORT || 5001);

config();

const bdInfo = {
  host: process.env.PDEV_DBHOST,
  user: process.env.PDEV_DBUSER,
  password: process.env.PDEV_DBPASSWORD,
  port: process.env.PDEV_DBPORT,
  database: process.env.PDEV_DBNAME,
  dateStrings: true,
  multipleStatements: true,
  ssl: {
    rejectUnauthorized: false
  }
};

const corsConfig = {
  origin: '*',
  credentials: true,
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Comercial La Nueva API and Swagger",
      version: "1.0.0",
      description:
        "Documentation about Comercial La Nueva App API",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "SigPro COM",
        // url: "https://logrocket.com",
        email: "gusigpro@gmail.com"
      },
    },
    servers: [
      {
        url: "http://localhost:5001",
      },
    ],
  },
  apis: ["src/routes/*.js"],
};

const specs = swaggerJsdoc(options);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(morgan('dev'));
server.use(json({ limit: '20mb' }));
server.use(urlencoded({ extended: true }));
server.use(expMyConn(mysql2, bdInfo, 'pool'));
server.use(cors(corsConfig));
server.use(staticserve(__dirname + '/public'));
server.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp' }));

server.use('/api/auth', authRoutes);
server.use('/api/brands', brandsRoutes);
server.use('/api/cashiers', cashiersRoutes);
server.use('/api/categories', categoriesRoutes);
server.use('/api/contracts', contractsRoutes);
server.use('/api/customers', customersRoutes);
server.use('/api/deliveryroutes', deliveryRoutesRoutes);
server.use('/api/dte', dteRoutes);
server.use('/api/expenses', expensesRoutes);
server.use('/api/furnishings', furnishingsRoutes);
server.use('/api/generals', generalsRoutes);
server.use('/api/locations', locationsRoutes);
server.use('/api/mails', mailsRoutes);
server.use('/api/measurement-units', measurementUnitsRoutes);
server.use('/api/ordersales', orderSalesRoutes);
server.use('/api/parking-checkouts', parkingCheckoutsRoutes);
server.use('/api/parking-expenses', parkingExpensesRoutes);
server.use('/api/parking-reports', parkingReportsRoutes);
server.use('/api/policies', policiesRoutes);
server.use('/api/productions', productionsRoutes);
server.use('/api/products', productsRoutes);
server.use('/api/product-purchases', productPurchasesRoutes);
server.use('/api/rawmaterials', rawMaterialsRoutes);
server.use('/api/rawmaterialspurchases', rawMaterialPurchasesRoutes);
server.use('/api/reports', reportsRoutes);
server.use('/api/roles', rolesRoutes);
server.use('/api/sales', salesRoutes);
server.use('/api/sellers', sellersRoutes);
server.use('/api/shiftcuts', shiftcutsRoutes);
server.use('/api/suppliers', suppliersRoutes);
server.use('/api/transfers', transfersRoutes);
server.use('/api/ubications', ubicationsRoutes);
server.use('/api/users', usersRoutes);

server.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, { explorer: true })
);

server.get('/', (req, res) => {
  res.sendFile(join(__dirname + '/public/index.html'));
});

server.get('/api/test-signature', async (req, res) => {
  // try {
  //   // Realiza la llamada a la API externa utilizando Axios
  //   const response = await axios.get('http://45.55.198.84:444/firmardocumento/status');

  //   // Procesa los datos de la respuesta según sea necesario
  //   const data = response.data;

  //   // Envía los datos de vuelta como respuesta al cliente
  //   res.json(data);
  // } catch (error) {
  //   // Maneja cualquier error que pueda ocurrir durante la llamada a la API externa
  //   console.error('Error al llamar a la API externa:', error);
  //   res.status(500).json({ error, errorMsg: 'Error al llamar a la API externa' });
  // }
  try {
    const formData = new FormData();

    formData.append('user', process.env.PDEV_MHUSER);
    formData.append('pwd', process.env.PDEV_MHPASS);

    const response = await axios.post('https://apitest.dtes.mh.gob.sv/seguridad/auth', formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      },
    })

    const data = response.data;

    res.json(data);
  } catch (error) {
    console.error('Error al llamar a la API externa:', error);
    res.status(500).json({ error, errorMsg: 'Error al llamar a la API externa' });
  }
});

server.get('*', (req, res) => {
  res.redirect('/');
});

// cron.schedule('0 17 * * 0', function() {
//   console.log('Process running every minute');
// });

const serverInstance = server.listen(server.get('port'), () => {
  console.log('\u001b[1;36mServer on port: ' + address() + ':' + server.get('port'));
  const pool = createPool(bdInfo);
  pool.query('SELECT 1 + 1 AS test;', (error, results, fields) => {
    if (error) {
      console.log(`\u001b[1;31m${error.message}`);
      return;
    };
    console.log(`\u001b[1;32m√ ¡Conexión a la Base de Datos ${bdInfo.database} establecida! √\u001b[1;0m`);
  });
});
