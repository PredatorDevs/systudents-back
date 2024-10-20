import express, { json, urlencoded, static as staticserve } from 'express';

import path from 'path';
import morgan from 'morgan';
import mysql2, { createPool } from 'mysql2';
import expMyConn from 'express-myconnection';
import cors from 'cors';
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
import reportsRoutes from '../src/routes/reports.js';
import rolesRoutes from '../src/routes/roles.js';
import salesRoutes from '../src/routes/sales.js';
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
server.use('/api/reports', reportsRoutes);
server.use('/api/roles', rolesRoutes);
server.use('/api/sales', salesRoutes);
server.use('/api/users', usersRoutes);

server.get('/', (req, res) => {
  res.sendFile(join(__dirname + '/public/index.html'));
});

server.get('*', (req, res) => {
  res.redirect('/');
});

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
