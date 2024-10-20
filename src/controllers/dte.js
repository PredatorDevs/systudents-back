import * as fs from 'fs';
import PdfPrinter from 'pdfmake';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import locale from 'dayjs/locale/es-mx.js';
import generateDTEHTML from '../helpers/generateDTEHTML.js';
import { pumalogo } from '../assets/svgstrings.js';
import { firmadorPort, mhAmbient, mhEndpoint } from '../configs/mhsettings.js';
import { dteSettings } from '../configs/dtesettings.js';

dayjs.locale(locale);
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fonts = {
  Roboto: {
    normal: path.resolve(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.resolve(__dirname, '../fonts/Roboto-Medium.ttf'),
    italics: path.resolve(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.resolve(__dirname, '../fonts/Roboto-MediumItalic.ttf')
  }
};

const controller = {};

controller.check = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT
            (SELECT ownerNit FROM locations l WHERE sale.locationId = l.id) AS ownerNit,
            sale.dteType,
            sale.generationCode
          FROM
            sales sale
          WHERE
            sale.id = ?;
        `,
        [ saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const { ownerNit, dteType, generationCode } = rows[0];

              try {
                const { mhauth } = req.headers;

                const mhRes = await axios.post(`${mhEndpoint}/fesv/recepcion/consultadte/`, {
                  nitEmisor: ownerNit,
                  tdte: dteType,
                  codigoGeneracion: generationCode
                }, {
                  headers: {
                    'Authorization': `${mhauth}`
                  }
                });

                const mhData = mhRes.data;
                const { estado, selloRecibido, codigoMsg, observaciones } = mhData;

                if (estado === "PROCESADO" && selloRecibido !== null && (codigoMsg === "001" || codigoMsg === "002")) {
                  conn.query(
                    `
                      UPDATE sales
                      SET dteTransmitionStatus = 2,
                      receptionStamp = ?
                      WHERE id = ?;
                    `,
                    [ selloRecibido, saleId ],
                    async (err, rows) => {
                      if (err) res.status(400).json(err);
                      else {
                        res.status(200).json({message: "Documento consultado de manera exitosa", rows});
                      }
                    }
                  );
                } else {
                  res.status(500).json({
                    error: 'Documento no encontrado en MH',
                    errorMsg: 'El servicio MH no hay podido validar el documento',
                    errorContent: {
                      estado,
                      selloRecibido,
                      codigoMsg,
                      observaciones
                    }
                  });
                }
              } catch (error) {
                console.log(error.response.data);
                res.status(500).json({
                  message: error.message,
                  name: error.name,
                  response: error.response.data,
                  errorMsg: 'Error al consultar el documento. Consulte estado del servicio MH'
                });
              }
            } else {
              res.status(500).json({ error: 'No document found to transmit', errorMsg: 'Error al consultar el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.signCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT generationCode, fn_gendtecf(sale.id) AS DTE
          FROM sales sale
          WHERE sale.id = ?
          AND sale.documentTypeId = 2;
        `,
        [ saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const { generationCode, DTE } = rows[0];
              // console.log("DTE: ", DTE);

              let signedDTE = '';

              try {
                const response = await axios.post(`http://45.55.198.84:${firmadorPort}/firmardocumento/`, {
                  nit: "14162110721024",
                  activo: true,
                  passwordPri: process.env.PDEV_MHPRIVKEY,
                  dteJson: DTE
                });

                const signedData = response.data;
                const { status, body } = signedData;

                if (status === "OK") {
                  signedDTE = body;

                  const { mhauth } = req.headers;

                  try {
                    const mhRes = await axios.post(`${mhEndpoint}/fesv/recepciondte`, {
                      ambiente: mhAmbient,
                      idEnvio: +saleId,
                      version: 1,
                      tipoDte: "01",
                      documento: signedDTE,
                      codigoGeneracion: generationCode
                    }, {
                      headers: {
                        'Authorization': `${mhauth}`
                      }
                    });

                    const mhData = mhRes.data;
                    const { estado, selloRecibido, codigoMsg, descripcionMsg, observaciones } = mhData;

                    if (estado === "PROCESADO" && selloRecibido !== null && (codigoMsg === "001" || codigoMsg === "002")) {
                      conn.query(
                        `
                          UPDATE sales
                          SET dteTransmitionStatus = 2,
                          receptionStamp = ?
                          WHERE id = ?;

                          INSERT INTO dtetransmissionlogs (dteJson, dteAmbient, dteType, dteGenerationCode, dteVersion, dteReceptionStamp)
                          VALUES (?, ?, ?, ?, ?, ?);
                        `,
                        [
                          selloRecibido,
                          saleId,
                          JSON.stringify(DTE),
                          mhAmbient,
                          "01",
                          generationCode,
                          1,
                          selloRecibido
                        ],
                        async (err, rows) => {
                          if (err) {
                            console.log(err);
                            res.status(400).json(err);
                          }
                          else {
                            res.status(200).json({message: "Documento emitido de manera exitosa", rows});
                          }
                        }
                      );
                    } else {
                      conn.query(
                        `
                          UPDATE sales SET transmissionAttemps = transmissionAttemps + 1 WHERE id = ?;
                        `,
                        [ saleId ],
                        async (err, rows) => {
                          if (err) {
                            res.status(500).json({
                              error: 'MH Transmision DTE Rechazada',
                              errorMsg: 'El servicio de recepcion ha rechazado el documento',
                              errorContent: {
                                estado,
                                selloRecibido,
                                codigoMsg,
                                descripcionMsg,
                                observaciones,
                                databaseError: err
                              }
                            });
                          }
                          else {
                            res.status(500).json({
                              error: 'MH Transmision DTE Rechazada',
                              errorMsg: 'El servicio de recepcion ha rechazado el documento',
                              errorContent: {
                                estado,
                                selloRecibido,
                                codigoMsg,
                                descripcionMsg,
                                observaciones
                              }
                            });
                          }
                        }
                      );
                    }
                  } catch(mhSerErr) {
                    // console.log("OBSERVACIONES: ", mhSerErr?.response);
                    console.log("OBSERVACIONES: ", mhSerErr?.response?.data);
                    conn.query(
                      `
                        UPDATE sales SET transmissionAttemps = transmissionAttemps + 1 WHERE id = ?;
                      `,
                      [ saleId ],
                      async (err, rows) => {
                        if (err) {
                          res.status(500).json({
                            error: 'MH Transmision DTE no ha sido exitoso',
                            errorMsg: 'No ha sido posible la comunicacion con el servidor',
                            errorContent: {
                              mhError: mhSerErr,
                              databaseError: err
                            }
                          });
                        }
                        else {
                          res.status(500).json({
                            error: 'MH Transmision DTE no ha sido exitoso',
                            errorMsg: 'No ha sido posible la comunicacion con el servidor',
                            errorContent: {
                              mhError: mhSerErr
                            }
                          });
                        }
                      }
                    );
                  }
                } else {
                  res.status(500).json({ error: 'No signature services success response', errorMsg: 'No hay un documento válido firmado para transmitir. Consulte estado del servicio de firmado' });
                }
              } catch (error) {
                console.log(error);
                // Maneja cualquier error que pueda ocurrir durante la llamada a la API externa
                res.status(500).json({
                  message: error.message,
                  name: error.name,
                  response: error.response?.data,
                  errorMsg: 'Error al transmitir el documento. Consulte estado del servicio de firmado'
                });
              }
            } else {
              res.status(500).json({ error: 'No document found to transmit', errorMsg: 'Error al transmitir el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.signCCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT generationCode, fn_gendteccf_test(sale.id) AS DTE
          FROM sales sale
          WHERE sale.id = ?
          AND sale.documentTypeId = 3;
        `,
        [ saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const { generationCode, DTE } = rows[0];

              let signedDTE = '';

              try {
                const response = await axios.post(`http://45.55.198.84:${firmadorPort}/firmardocumento/`, {
                  nit: "14162110721024",
                  activo: true,
                  passwordPri: process.env.PDEV_MHPRIVKEY,
                  dteJson: DTE
                });

                const signedData = response.data;
                const { status, body } = signedData;

                if (status === "OK") {
                  signedDTE = body;

                  const { mhauth } = req.headers;

                  const mhRes = await axios.post(`${mhEndpoint}/fesv/recepciondte`, {
                    ambiente: mhAmbient,
                    idEnvio: +saleId,
                    version: 3,
                    tipoDte: "03",
                    documento: signedDTE,
                    codigoGeneracion: generationCode
                  }, {
                    headers: {
                      'Authorization': `${mhauth}`
                    }
                  });

                  const mhData = mhRes.data;
                  const { estado, selloRecibido, codigoMsg } = mhData;

                  if (estado === "PROCESADO" && selloRecibido !== null && (codigoMsg === "001" || codigoMsg === "002")) {
                    conn.query(
                      `
                        UPDATE sales
                        SET dteTransmitionStatus = 2,
                        receptionStamp = ?
                        WHERE id = ?;
                      `,
                      [ selloRecibido, saleId ],
                      async (err, rows) => {
                        if (err) res.status(400).json(err);
                        else {
                          res.status(200).json({message: "Documento emitido de manera exitosa", rows});
                        }
                      }
                    );
                  } else {
                    conn.query(
                      `
                        UPDATE sales SET transmissionAttemps = transmissionAttemps + 1 WHERE id = ?;
                      `,
                      [ saleId ],
                      async (err, rows) => {
                        if (err) {
                          res.status(500).json({
                            error: 'MH Transmision DTE Rechazada',
                            errorMsg: 'El servicio de recepcion ha rechazado el documento',
                            errorContent: {
                              estado,
                              selloRecibido,
                              codigoMsg,
                              databaseError: err
                            }
                          });
                        }
                        else {
                          res.status(500).json({
                            error: 'MH Transmision DTE Rechazada',
                            errorMsg: 'El servicio de recepcion ha rechazado el documento',
                            errorContent: {
                              estado,
                              selloRecibido,
                              codigoMsg
                            }
                          });
                        }
                      }
                    );
                  }
                } else {
                  res.status(500).json({ error: 'No signature services success response', errorMsg: 'No hay un documento válido firmado para transmitir. Consulte estado del servicio de firmado' });
                }
              } catch (error) {
                res.status(500).json({
                  message: error.message,
                  name: error.name,
                  response: error.response.data,
                  errorMsg: 'Error al transmitir el documento. Consulte estado del servicio de firmado'
                });
              }
            } else {
              res.status(500).json({ error: 'No document found to transmit', errorMsg: 'Error al transmitir el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.voidCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId, generationCode, dteType, authBy } = req.params;
      
      conn.query(
        `
          SELECT
            generationCode,
            receptionStamp,
            controlNumber,
            dteType,
            docDate,
            ownerNit,
            ownerNrc,
            ownerName,
            establishmentType,
            locationName,
            locationPhone,
            locationEmail,
            estCodeInternal,
            estCodeMH,
            posCodeInternal,
            posCodeMH,
            customerDui,
            customerFullname,
            customerDefPhoneNumber,
            customerEmail,
            totalTaxes
          FROM
            vw_sales sale
          WHERE
            sale.id = ?
            AND sale.documentTypeId = 2
            AND sale.dteTransmitionStatus IN (2, 4);
        `,
        [ saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                generationCode,
                receptionStamp,
                controlNumber,
                dteType,
                docDate,
                ownerNit,
                ownerNrc,
                ownerName,
                establishmentType,
                locationName,
                locationPhone,
                locationEmail,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                customerDui,
                customerFullname,
                customerDefPhoneNumber,
                customerEmail,
                totalTaxes
              } = rows[0];

              let signedDTE = '';

              let myGenerationCode = uuidv4().toUpperCase();

              const fechaActual = dayjs();

              const fechaMenosSeisHoras = fechaActual.subtract(6, 'hour');
              // const fechaMenosSeisHoras = fechaActual;

              // const currentDate = dayjs().format('YYYY-MM-DD');
              // const currentTime = dayjs().format('HH:mm:ss');

              // const currentLocalDate = fechaMenosSeisHoras.format('YYYY-MM-DD');
              // const currentLocalTime = fechaMenosSeisHoras.format('HH:mm:ss');

              const currentDate = fechaMenosSeisHoras.format('YYYY-MM-DD');
              const currentTime = fechaMenosSeisHoras.format('HH:mm:ss');

              try {
                let myInvalidationDoc = {
                  "identificacion": {
                    "version": dteSettings.docs.invalidation.version,
                    "ambiente": mhAmbient,
                    "codigoGeneracion": myGenerationCode,
                    "fecAnula": currentDate,
                    "horAnula": currentTime
                  },
                  "emisor": {
                    "nit": ownerNit,
                    "nombre": ownerName,
                    "tipoEstablecimiento": establishmentType,
                    "nomEstablecimiento": locationName,
                    "codEstableMH": estCodeMH,
                    "codEstable": estCodeInternal,
                    "codPuntoVentaMH": posCodeMH,
                    "codPuntoVenta": posCodeInternal,
                    "telefono": locationPhone,
                    "correo": locationEmail
                  },
                  "documento": {
                    "tipoDte": dteType,
                    "codigoGeneracion": generationCode,
                    "selloRecibido": receptionStamp,
                    "numeroControl": controlNumber,
                    "fecEmi": docDate,
                    "montoIva": +totalTaxes || 0.01,
                    "codigoGeneracionR": null,
                    "tipoDocumento": "13",
                    "numDocumento": customerDui,
                    "nombre": customerFullname,
                    "telefono": customerDefPhoneNumber,
                    "correo": customerEmail
                  },
                  "motivo": {
                    "tipoAnulacion": 2,
                    "motivoAnulacion": null,
                    "nombreResponsable": ownerName,
                    "tipDocResponsable": "36",
                    "numDocResponsable": ownerNit,
                    "nombreSolicita": ownerName,
                    "tipDocSolicita": "36",
                    "numDocSolicita": ownerNit
                  }
                }

                const response = await axios.post(`http://45.55.198.84:${firmadorPort}/firmardocumento/`, {
                  nit: "14162110721024",
                  activo: true,
                  passwordPri: process.env.PDEV_MHPRIVKEY,
                  dteJson: myInvalidationDoc
                });

                const signedData = response.data;
                const { status, body } = signedData;

                if (status === "OK") {
                  signedDTE = body;

                  const { mhauth } = req.headers;

                  const mhRes = await axios.post(`${mhEndpoint}/fesv/anulardte`, {
                    ambiente: mhAmbient,
                    idEnvio: saleId,
                    version: 2,
                    documento: signedDTE
                  }, {
                    headers: {
                      'Authorization': `${mhauth}`
                    }
                  });

                  const mhData = mhRes.data;
                  const { estado, selloRecibido, codigoMsg, fhProcesamiento, observaciones } = mhData;

                  let obs = '';
                  for (item of (observaciones || [])) {
                    obs += String(` ${item}`);
                  }

                  if (estado === "PROCESADO" && selloRecibido !== null && (codigoMsg === "001" || codigoMsg === "002")) {
                    conn.query(
                      `
                        UPDATE sales SET dteTransmitionStatus = 5 WHERE id = ?;
                        
                        CALL usp_VoidSale(?, ?);

                        INSERT INTO dteinvalidationlogs (generationCode, invalidationJson, dteType, dteGenerationCode, dteControlNumber, status, dteReceptionStamp, messageCode, comments, processedAt, dteAmbient, dteVersion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                      `,
                      [
                        saleId,
                        authBy,
                        saleId,
                        myGenerationCode,
                        JSON.stringify(myInvalidationDoc),
                        dteType,
                        generationCode,
                        controlNumber,
                        estado,
                        selloRecibido,
                        codigoMsg,
                        obs,
                        String(fhProcesamiento),
                        mhAmbient,
                        2
                      ],
                      async (err, rows) => {
                        if (err) {
                          res.status(400).json({
                            message: `Documento ${generationCode} invalidado de manera erronea - BASE DE DATOS NO ACTUALIZADA`,
                            bdError: err,
                            rows
                          });
                        }
                        else {
                          res.status(200).json({message: `Documento ${generationCode} invalidado de manera exitosa a las ${currentDate} ${currentTime}`, rows});
                        }
                      }
                    );
                  } else {
                    res.status(500).json({
                      error: 'MH Transmision de Invalidacion DTE Rechazada',
                      errorMsg: 'El servicio de recepcion ha rechazado la invalidacion documento',
                      errorContent: {
                        estado,
                        selloRecibido,
                        codigoMsg,
                        observaciones
                      }
                    });
                  }
                } else {
                  res.status(500).json({ error: 'No signature services success response', errorMsg: 'No hay un documento válido firmado para transmitir. Consulte estado del servicio de firmado' });
                }
              } catch (error) {
                res.status(500).json({
                  message: error.message,
                  name: error.name,
                  response: error.response.data,
                  errorMsg: 'Error al transmitir el documento. Consulte estado del servicio de firmado'
                });
              }
            } else {
              res.status(500).json({ error: 'No document found to transmit', errorMsg: 'Error al transmitir el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.voidCCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId, authBy } = req.params;
      conn.query(
        `
          SELECT
            generationCode,
            receptionStamp,
            controlNumber,
            dteType,
            docDate,
            ownerNit,
            ownerNrc,
            ownerName,
            establishmentType,
            locationName,
            locationPhone,
            locationEmail,
            estCodeInternal,
            estCodeMH,
            posCodeInternal,
            posCodeMH,
            customerDui,
            customerNit,
            customerFullname,
            customerDefPhoneNumber,
            customerEmail,
            totalTaxes
          FROM
            vw_sales sale
          WHERE
            sale.id = ?
            AND sale.documentTypeId = 3
            AND sale.dteTransmitionStatus IN (2, 4);
        `,
        [ saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                generationCode,
                receptionStamp,
                controlNumber,
                dteType,
                docDate,
                ownerNit,
                ownerNrc,
                ownerName,
                establishmentType,
                locationName,
                locationPhone,
                locationEmail,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                customerDui,
                customerNit,
                customerFullname,
                customerDefPhoneNumber,
                customerEmail,
                totalTaxes
              } = rows[0];

              let signedDTE = '';

              let myGenerationCode = uuidv4().toUpperCase();

              const fechaActual = dayjs();

              const fechaMenosSeisHoras = fechaActual.subtract(6, 'hour');

              // const currentDate = dayjs().format('YYYY-MM-DD');
              // const currentTime = dayjs().format('HH:mm:ss');

              // const currentLocalDate = fechaMenosSeisHoras.format('YYYY-MM-DD');
              // const currentLocalTime = fechaMenosSeisHoras.format('HH:mm:ss');

              const currentDate = fechaMenosSeisHoras.format('YYYY-MM-DD');
              const currentTime = fechaMenosSeisHoras.format('HH:mm:ss');

              try {
                let myInvalidationDoc = {
                  "identificacion": {
                    "version": 2,
                    "ambiente": mhAmbient,
                    "codigoGeneracion": myGenerationCode,
                    "fecAnula": currentDate,
                    "horAnula": currentTime
                  },
                  "emisor": {
                    "nit": ownerNit,
                    "nombre": ownerName,
                    "tipoEstablecimiento": establishmentType,
                    "nomEstablecimiento": locationName,
                    "codEstableMH": estCodeMH,
                    "codEstable": estCodeInternal,
                    "codPuntoVentaMH": posCodeMH,
                    "codPuntoVenta": posCodeInternal,
                    "telefono": locationPhone,
                    "correo": locationEmail
                  },
                  "documento": {
                    "tipoDte": dteType,
                    "codigoGeneracion": generationCode,
                    "selloRecibido": receptionStamp,
                    "numeroControl": controlNumber,
                    "fecEmi": docDate,
                    "montoIva": +totalTaxes || 0.01,
                    "codigoGeneracionR": null,
                    "tipoDocumento": "36",
                    "numDocumento": customerNit,
                    "nombre": customerFullname,
                    "telefono": customerDefPhoneNumber,
                    "correo": customerEmail
                  },
                  "motivo": {
                    "tipoAnulacion": 2,
                    "motivoAnulacion": null,
                    "nombreResponsable": ownerName,
                    "tipDocResponsable": "36",
                    "numDocResponsable": ownerNit,
                    "nombreSolicita": ownerName,
                    "tipDocSolicita": "36",
                    "numDocSolicita": ownerNit
                  }
                }

                const response = await axios.post(`http://45.55.198.84:${firmadorPort}/firmardocumento/`, {
                  nit: "14162110721024",
                  activo: true,
                  passwordPri: process.env.PDEV_MHPRIVKEY,
                  dteJson: myInvalidationDoc
                });

                const signedData = response.data;
                const { status, body } = signedData;

                if (status === "OK") {
                  signedDTE = body;

                  const { mhauth } = req.headers;

                  const mhRes = await axios.post(`${mhEndpoint}/fesv/anulardte`, {
                    ambiente: mhAmbient,
                    idEnvio: saleId,
                    version: 2,
                    documento: signedDTE
                  }, {
                    headers: {
                      'Authorization': `${mhauth}`
                    }
                  });

                  const mhData = mhRes.data;
                  const { estado, selloRecibido, codigoMsg, fhProcesamiento, observaciones } = mhData;

                  let obs = '';
                  for (item of (observaciones || [])) {
                    obs += String(` ${item}`);
                  }

                  if (estado === "PROCESADO" && selloRecibido !== null && (codigoMsg === "001" || codigoMsg === "002")) {
                    conn.query(
                      `
                        UPDATE sales SET dteTransmitionStatus = 5 WHERE id = ?;
                        
                        CALL usp_VoidSale(?, ?);

                        INSERT INTO dteinvalidationlogs (generationCode, dteType, dteGenerationCode, dteControlNumber, status, dteReceptionStamp, messageCode, comments, processedAt, dteAmbient, dteVersion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                      `,
                      [
                        saleId,
                        authBy,
                        saleId,
                        myGenerationCode,
                        dteType,
                        generationCode,
                        controlNumber,
                        estado,
                        selloRecibido,
                        codigoMsg,
                        obs,
                        String(fhProcesamiento),
                        mhAmbient,
                        2
                      ],
                      async (err, rows) => {
                        if (err) {
                          res.status(400).json({
                            message: `Documento ${generationCode} invalidado de manera exitosa - BASE DE DATOS NO ACTUALIZADA`,
                            bdError: err,
                            rows
                          });
                        }
                        else {
                          res.status(200).json({message: `Documento ${generationCode} invalidado de manera exitosa`, rows});
                        }
                      }
                    );
                  } else {
                    res.status(500).json({
                      error: 'MH Transmision de Invalidacion DTE Rechazada',
                      errorMsg: 'El servicio de recepcion ha rechazado la invalidacion documento',
                      errorContent: {
                        estado,
                        selloRecibido,
                        codigoMsg,
                        observaciones
                      }
                    });
                  }
                } else {
                  res.status(500).json({ error: 'No signature services success response', errorMsg: 'No hay un documento válido firmado para transmitir. Consulte estado del servicio de firmado' });
                }
              } catch (error) {
                res.status(500).json({
                  message: error.message,
                  name: error.name,
                  response: error.response.data,
                  errorMsg: 'Error al transmitir el documento. Consulte estado del servicio de firmado'
                });
              }
            } else {
              res.status(500).json({ error: 'No document found to transmit', errorMsg: 'Error al transmitir el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.getCFPDF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT * FROM vw_sales vs WHERE vs.id = ?;
          SELECT ROW_NUMBER() OVER() AS itemNum, vsd.* FROM vw_saledetails vsd WHERE vsd.saleId = ?;
        `,
        [ saleId, saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                id,
                controlNumber,
                generationCode,
                dteType,
                receptionStamp,
                dteTransmitionStatus,
                dteTransmitionStatusName,
                transmissionType,
                transmissionTypeName,
                transmissionModel,
                transmissionModelName,
                currencyType,
                shiftcutId,
                cashierId,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                locationId,
                locationName,
                locationPhone,
                locationAddress,
                locationDepartmentName,
                locationCityName,
                locationDepartmentMhCode,
                locationCityMhCode,
                locationEmail,
                ownerNit,
                ownerNrc,
                ownerName,
                ownerActivityCode,
                ownerActivityDescription,
                ownerTradename,
                establishmentType,
                customerId,
                documentTypeId,
                documentTypeName,
                paymentTypeId,
                paymentTypeName,
                createdBy,
                createdByFullname,
                userPINCodeFullName,
                docDatetime,
                docDatetimeFormatted,
                docDate,
                docTime,
                docDatetimeLabel,
                docNumber,
                serie,
                paymentStatus,
                expirationDays,
                expirationInformation,
                expiresIn,
                expired,
                IVAretention,
                IVAperception,
                paymentStatusName,
                isVoided,
                voidedByFullname,
                total,
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                totalInLetters,
                saleTotalPaid,
                customerCode,
                customerFullname,
                customerAddress,
                customerDefPhoneNumber,
                customerEmail,
                customerDui,
                customerNit,
                customerNrc,
                customerBusinessLine,
                customerOccupation,
                customerDepartmentName,
                customerCityName,
                customerDepartmentMhCode,
                customerCityMhCode,
                customerEconomicActivityCode,
                customerEconomicActivityName,
                isNoTaxableOperation,
                customerComplementaryName,
                notes
              } = rows[0][0];

              const dteDocumentBody = rows[1];

              try {
                const printer = new PdfPrinter(fonts);
            
                const bodyData = [];
                bodyData.push([
                  { text: `N°`, bold: false, alignment: 'center' },
                  { text: `Cantidad`, bold: false, alignment: 'center' },
                  { text: `Unidad`, bold: false, alignment: 'center' },
                  { text: `Descripción`, bold: false, alignment: 'center' },
                  { text: `Precio Uni.`, bold: false, alignment: 'center' },
                  { text: `Desc P/Item`, bold: false, alignment: 'center' },
                  { text: `Otros Montos No Afectos`, bold: false, alignment: 'center' },
                  { text: `Ventas No Sujetas`, bold: false, alignment: 'center', fontSize: 6 },
                  { text: `Ventas Exentas`, bold: false, alignment: 'center' },
                  { text: `Ventas Gravadas`, bold: false, alignment: 'center' },
                ]);

                /* itemNum,
                 saleDetailId,
                 saleId,
                 productId,
                 productTypeId,
                 productCode,
                 productName,
                 productMeasurementUnitId,
                 categoryName,
                 brandName,
                 measurementUnitName,
                 unitPrice,
                 unitPriceIva,
                 unitPriceFovial,
                 unitPriceCotrans,
                 unitPriceNoTaxes,
                 unitCost,
                 unitCostNoTaxes,
                 subTotalCost,
                 totalCostTaxes,
                 totalCost,
                 quantity,
                 subTotal,
                 isVoided,
                 isActive,
                 taxesData,
                 ivaTaxAmount,
                 fovialTaxAmount,
                 cotransTaxAmount,
                 totalTaxes,
                 taxableSubTotal,
                 taxableSubTotalWithoutTaxes,
                 noTaxableSubTotal */

                for(const element of (dteDocumentBody || [])) {
                  bodyData.push([
                    { text: `${element?.itemNum || 0}`, bold: false, alignment: 'center' },
                    { text: `${element?.quantity || 0}`, bold: false, alignment: 'right' },
                    { text: `${element?.measurementUnitName || ''}`, bold: false, alignment: 'center' },
                    { text: `${element?.productName || ''}`, bold: false, alignment: 'left' },
                    { text: `${(+element?.unitPrice - (+element?.unitPriceFovial + +element?.unitPriceCotrans + (isNoTaxableOperation ? +element?.unitPriceIva : 0))).toFixed(2) || 0}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount).toFixed(2) : (0)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (0) : (+element?.subTotal - +element?.fovialTaxAmount - +element?.cotransTaxAmount).toFixed(2)}`, bold: false, alignment: 'right' },
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                /*
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                */

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA VENTAS`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2)}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : 0).toFixed(2) || 0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? 0 : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount) || 0)).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA TOTAL DE OPERACIONES`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS NO SUJETAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS EXENTAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS GRAVADAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                // bodyData.push([
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: `IMPUESTO VALOR AGREGADO (13%)`, colSpan: 3, bold: false, alignment: 'right' },
                //   { text: ``, bold: false, alignment: 'right' },
                //   { text: ``, bold: false, alignment: 'right' },
                //   { text: `${Number(totalTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                // ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUBTOTAL`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(+)`, bold: true, color: '#52c41a', alignment: 'center' },
                  { text: `IVA PERCIBIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `IVA RETENIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAretention).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                if (+fovialTaxAmount !== null && +fovialTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `FOVIAL ($0.20/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+fovialTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                if (+cotransTaxAmount !== null && +cotransTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `COTRANS ($0.10/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+cotransTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `RETE. RENTA`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `MONTO TOTAL OPERACION`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `OTROS MONTOS NO AFECTOS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: `VALOR EN LETRAS`, colSpan: 2, bold: false, alignment: 'right' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `${totalInLetters || ''}`, colSpan: 2, bold: false, alignment: 'left' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `TOTAL A PAGAR`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                const docDefinition = {
                  header: function(currentPage, pageCount, pageSize) {
                    // Podemos tener hasta cuatro líneas de encabezado de página
                    return [
                      {
                        text: 'Documento Tributario Electrónico',
                        alignment: 'left',
                        color: '#001d66',
                        bold: true,
                        fontSize: 10,
                        margin: [40, 30, 40, 0]
                      },
                      {
                        text: 'Factura Electrónica',
                        alignment: 'left',
                        color: '#1677ff',
                        fontSize: 8,
                        margin: [40, 0, 40, 0]
                      }
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                    ]
                  },
                  footer: function(currentPage, pageCount) {
                    // Podemos tener hasta cuatro líneas de pie de página
                    return [
                      { text: ``, alignment: 'right', margin: [40, 0, 40, 0] },
                      { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    ]
                  },
                  content: [
                    {
                      columns: [
                        {
                          stack: [
                            {
                              // svg: `
                              //   <svg id="logo-15" width="36" height="36" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              //     <path d="M24.5 12.75C24.5 18.9632 19.4632 24 13.25 24H2V12.75C2 6.53679 7.03679 1.5 13.25 1.5C19.4632 1.5 24.5 6.53679 24.5 12.75Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M24.5 35.25C24.5 29.0368 29.5368 24 35.75 24H47V35.25C47 41.4632 41.9632 46.5 35.75 46.5C29.5368 46.5 24.5 41.4632 24.5 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M2 35.25C2 41.4632 7.03679 46.5 13.25 46.5H24.5V35.25C24.5 29.0368 19.4632 24 13.25 24C7.03679 24 2 29.0368 2 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M47 12.75C47 6.53679 41.9632 1.5 35.75 1.5H24.5V12.75C24.5 18.9632 29.5368 24 35.75 24C41.9632 24 47 18.9632 47 12.75Z" class="ccustom" fill="#030852"></path>
                              //   </svg>
                              // `,
                              svg: pumalogo,
                              alignment: 'center'
                            },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerName}`, bold: true, alignment: 'center' },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerActivityDescription}`.toUpperCase(), bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NIT: ${ownerNit}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NRC: ${ownerNrc}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${locationAddress}, ${locationCityName}, ${locationDepartmentName}`, bold: false, alignment: 'center' }
                          ],
                          width: '30%'
                        },
                        {
                          stack: [
                            {
                              qr: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`,
                              foreground: '#001d66',
                              background: '#e6f4ff',
                              eccLevel: "L",
                              fit: 100,
                              width: '100%',
                              alignment: 'center'
                            },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                            {
                              text: 'Consultar',
                              alignment: 'center',
                              color: '#1677ff',
                              fontSize: 9,
                              link: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`
                            }
                          ],
                          width: '20%'
                        },
                        {
                          layout: 'noBorders',
                          table: {
                            widths: ['30%', '70%'],
                            body: [
                              [
                                { text: 'Código de Generación', bold: true, alignment: 'right' },
                                { text: `${generationCode}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Número de Control', bold: true, alignment: 'right' },
                                { text: `${controlNumber}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Sello de Recepción', bold: true, alignment: 'right' },
                                { text: `${receptionStamp}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Moneda', bold: true, alignment: 'right' },
                                { text: `${currencyType}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Transmisión', bold: true, alignment: 'right' },
                                { text: `${transmissionTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Modelo Facturación', bold: true, alignment: 'right' },
                                { text: `${transmissionModelName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Fecha y hora Generación', bold: true, alignment: 'right' },
                                { text: `${dayjs(docDate).format('DD-MM-YYYY')} ${dayjs(`${docDate} ${docTime}`).format('HH:mm:ss')}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Cond. Operación', bold: true, alignment: 'right' },
                                { text: `${paymentTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Cliente', bold: true, alignment: 'left' },
                                { text: `${(customerId === 1 ? (customerComplementaryName || customerFullname) : customerFullname) || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Dirección', bold: true, alignment: 'left' },
                                { text: `${customerAddress || ''}, ${customerCityName}, ${customerDepartmentName}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'DUI', bold: true, alignment: 'left' },
                                { text: `${customerDui || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NIT', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Teléfono', bold: true, alignment: 'left' },
                                { text: `${customerDefPhoneNumber || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Correo', bold: true, alignment: 'left' },
                                { text: `${customerEmail || ''}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Resp. Emisor', bold: true, alignment: 'left' },
                                { text: `${userPINCodeFullName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `-`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Resp. Receptor', bold: true, alignment: 'left' },
                                { text: `${customerFullname}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                            ]
                          },
                        }
                      ],
                      columnGap: 5,
                      width: '100%'
                    },
                    // { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    // {
                    //   stack: [
                    //     { text: 'OTROS DOCUMENTOS ASOCIADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `Identificación del Documento`, bold: false, alignment: 'center' },
                    //             { text: `Descripción`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'VENTA A CUENTA DE TERCEROS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `NIT`, bold: false, alignment: 'center' },
                    //             { text: `Nombre, denominación o razón social`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'DOCUMENTOS RELACIONADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '33%', '34%'],
                    //         body: [
                    //           [
                    //             { text: `Tipo Documento`, bold: false, alignment: 'center' },
                    //             { text: `N° Documento`, bold: false, alignment: 'center' },
                    //             { text: `Fecha Documento`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //   ],
                    //   width: '100%'
                    // },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      layout: 'normalLayout',
                      table: {
                        widths: ['7%', '7%', '7%', '29%', '7.10%', '7.10%', '14.20%', '7.10%', '7.10%', '7.40%'],
                        body: bodyData
                      },
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Notas', bold: true, alignment: 'left' },
                                { text: `${notes || 'Sin notas'}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        }
                      ],
                      columnGap: 5,
                      width: '100%'
                    },
                  ],
                  defaultStyle: {
                    font: 'Roboto',
                    fontSize: 7
                  },
                  pageSize: 'LETTER',
                  pageMargins: [ 40, 60, 40, 60 ]
                };
                
                const myTableLayouts = {
                  normalLayout: {
                    hLineWidth: function (i, node) {
                      return 1;
                    },
                    vLineWidth: function (i) {
                      return 1;
                    },
                    hLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    vLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    paddingLeft: function (i) {
                      return 4;
                    },
                    paddingRight: function (i, node) {
                      return 4;
                    }
                  }
                };
                
                const options = {
                  tableLayouts: myTableLayouts
                };

                const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=cfpdf.pdf');

                pdfDoc.pipe(res);
                pdfDoc.end();
              } catch(error) {
                console.log(error);
                res.json({ status: 400, message: 'error', errorContent: error });
              }
            } else {
              res.status(500).json({ error: 'No document found to download', errorMsg: 'Error al descargar el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.getCCFPDF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT * FROM vw_sales vs WHERE vs.id = ?;
          SELECT ROW_NUMBER() OVER() AS itemNum, vsd.* FROM vw_saledetails vsd WHERE vsd.saleId = ?;
        `,
        [ saleId, saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                id,
                controlNumber,
                generationCode,
                dteType,
                receptionStamp,
                dteTransmitionStatus,
                dteTransmitionStatusName,
                transmissionType,
                transmissionTypeName,
                transmissionModel,
                transmissionModelName,
                currencyType,
                shiftcutId,
                cashierId,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                locationId,
                locationName,
                locationPhone,
                locationAddress,
                locationDepartmentName,
                locationCityName,
                locationDepartmentMhCode,
                locationCityMhCode,
                locationEmail,
                ownerNit,
                ownerNrc,
                ownerName,
                ownerActivityCode,
                ownerActivityDescription,
                ownerTradename,
                establishmentType,
                customerId,
                documentTypeId,
                documentTypeName,
                paymentTypeId,
                paymentTypeName,
                createdBy,
                createdByFullname,
                userPINCodeFullName,
                docDatetime,
                docDatetimeFormatted,
                docDate,
                docTime,
                docDatetimeLabel,
                docNumber,
                serie,
                paymentStatus,
                expirationDays,
                expirationInformation,
                expiresIn,
                expired,
                IVAretention,
                IVAperception,
                paymentStatusName,
                isVoided,
                voidedByFullname,
                total,
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                totalInLetters,
                saleTotalPaid,
                customerCode,
                customerFullname,
                customerAddress,
                customerDefPhoneNumber,
                customerEmail,
                customerDui,
                customerNit,
                customerNrc,
                customerBusinessLine,
                customerOccupation,
                customerDepartmentName,
                customerCityName,
                customerDepartmentMhCode,
                customerCityMhCode,
                customerEconomicActivityCode,
                customerEconomicActivityName,
                isNoTaxableOperation,
                notes
              } = rows[0][0];

              const dteDocumentBody = rows[1];

              try {
                const printer = new PdfPrinter(fonts);
            
                const bodyData = [];
                bodyData.push([
                  { text: `N°`, bold: false, alignment: 'center' },
                  { text: `Cantidad`, bold: false, alignment: 'center' },
                  { text: `Unidad`, bold: false, alignment: 'center' },
                  { text: `Descripción`, bold: false, alignment: 'center' },
                  { text: `Precio Uni.`, bold: false, alignment: 'center' },
                  { text: `Desc P/Item`, bold: false, alignment: 'center' },
                  { text: `Otros Montos No Afectos`, bold: false, alignment: 'center' },
                  { text: `Ventas No Sujetas`, bold: false, alignment: 'center', fontSize: 6 },
                  { text: `Ventas Exentas`, bold: false, alignment: 'center' },
                  { text: `Ventas Gravadas`, bold: false, alignment: 'center' },
                ]);

                /* itemNum,
                 saleDetailId,
                 saleId,
                 productId,
                 productTypeId,
                 productCode,
                 productName,
                 productMeasurementUnitId,
                 categoryName,
                 brandName,
                 measurementUnitName,
                 unitPrice,
                 unitPriceIva,
                 unitPriceFovial,
                 unitPriceCotrans,
                 unitPriceNoTaxes,
                 unitCost,
                 unitCostNoTaxes,
                 subTotalCost,
                 totalCostTaxes,
                 totalCost,
                 quantity,
                 subTotal,
                 isVoided,
                 isActive,
                 taxesData,
                 ivaTaxAmount,
                 fovialTaxAmount,
                 cotransTaxAmount,
                 totalTaxes,
                 taxableSubTotal,
                 taxableSubTotalWithoutTaxes,
                 noTaxableSubTotal */

                for(const element of (dteDocumentBody || [])) {
                  bodyData.push([
                    { text: `${element?.itemNum || 0}`, bold: false, alignment: 'center' },
                    { text: `${element?.quantity || 0}`, bold: false, alignment: 'right' },
                    { text: `${element?.measurementUnitName || ''}`, bold: false, alignment: 'center' },
                    { text: `${element?.productName || ''}`, bold: false, alignment: 'left' },
                    { text: `${element?.unitPriceNoTaxes || 0}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount) : (0)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ?  (0) : (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount)}`, bold: false, alignment: 'right' },
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                /*
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                */

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA VENTAS`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2)}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : 0).toFixed(2) || 0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? 0 : taxableSubTotalWithoutTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA TOTAL DE OPERACIONES`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(taxableSubTotalWithoutTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS NO SUJETAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS EXENTAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS GRAVADAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `IMPUESTO VALOR AGREGADO (13%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? 0 : ivaTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUBTOTAL`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(+)`, bold: true, color: '#52c41a', alignment: 'center' },
                  { text: `IVA PERCIBIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `IVA RETENIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAretention).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                if (+fovialTaxAmount !== null && +fovialTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `FOVIAL ($0.20/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+fovialTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                if (+cotransTaxAmount !== null && +cotransTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `COTRANS ($0.10/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+cotransTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `RETE. RENTA`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `MONTO TOTAL OPERACION`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `OTROS MONTOS NO AFECTOS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: `VALOR EN LETRAS`, colSpan: 2, bold: false, alignment: 'right' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `${totalInLetters || ''}`, colSpan: 2, bold: false, alignment: 'left' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `TOTAL A PAGAR`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                const docDefinition = {
                  header: function(currentPage, pageCount, pageSize) {
                    // Podemos tener hasta cuatro líneas de encabezado de página
                    return [
                      {
                        text: 'Documento Tributario Electrónico',
                        alignment: 'left',
                        color: '#001d66',
                        bold: true,
                        fontSize: 10,
                        margin: [40, 30, 40, 0]
                      },
                      {
                        text: 'Comprobante de Crédito Fiscal',
                        alignment: 'left',
                        color: '#1677ff',
                        fontSize: 8,
                        margin: [40, 0, 40, 0]
                      }
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                    ]
                  },
                  footer: function(currentPage, pageCount) {
                    // Podemos tener hasta cuatro líneas de pie de página
                    return [
                      { text: ``, alignment: 'right', margin: [40, 0, 40, 0] },
                      { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    ]
                  },
                  content: [
                    {
                      columns: [
                        {
                          stack: [
                            {
                              // svg: `
                              //   <svg id="logo-15" width="36" height="36" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              //     <path d="M24.5 12.75C24.5 18.9632 19.4632 24 13.25 24H2V12.75C2 6.53679 7.03679 1.5 13.25 1.5C19.4632 1.5 24.5 6.53679 24.5 12.75Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M24.5 35.25C24.5 29.0368 29.5368 24 35.75 24H47V35.25C47 41.4632 41.9632 46.5 35.75 46.5C29.5368 46.5 24.5 41.4632 24.5 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M2 35.25C2 41.4632 7.03679 46.5 13.25 46.5H24.5V35.25C24.5 29.0368 19.4632 24 13.25 24C7.03679 24 2 29.0368 2 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M47 12.75C47 6.53679 41.9632 1.5 35.75 1.5H24.5V12.75C24.5 18.9632 29.5368 24 35.75 24C41.9632 24 47 18.9632 47 12.75Z" class="ccustom" fill="#030852"></path>
                              //   </svg>
                              // `,
                              svg: pumalogo,
                              alignment: 'center'
                            },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerName}`, bold: true, alignment: 'center' },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerActivityDescription}`.toUpperCase(), bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NIT: ${ownerNit}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NRC: ${ownerNrc}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${locationAddress}, ${locationCityName}, ${locationDepartmentName}`, bold: false, alignment: 'center' }
                          ],
                          width: '30%'
                        },
                        {
                          stack: [
                            {
                              qr: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`,
                              foreground: '#001d66',
                              background: '#e6f4ff',
                              eccLevel: "L",
                              fit: 100,
                              width: '100%',
                              alignment: 'center'
                            },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                            {
                              text: 'Consultar',
                              alignment: 'center',
                              color: '#1677ff',
                              fontSize: 9,
                              link: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`
                            }
                          ],
                          width: '20%'
                        },
                        {
                          layout: 'noBorders',
                          table: {
                            widths: ['30%', '70%'],
                            body: [
                              [
                                { text: 'Código de Generación', bold: true, alignment: 'right' },
                                { text: `${generationCode}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Número de Control', bold: true, alignment: 'right' },
                                { text: `${controlNumber}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Sello de Recepción', bold: true, alignment: 'right' },
                                { text: `${receptionStamp}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Moneda', bold: true, alignment: 'right' },
                                { text: `${currencyType}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Transmisión', bold: true, alignment: 'right' },
                                { text: `${transmissionTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Modelo Facturación', bold: true, alignment: 'right' },
                                { text: `${transmissionModelName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Fecha y hora Generación', bold: true, alignment: 'right' },
                                { text: `${dayjs(docDate).format('DD-MM-YYYY')} ${dayjs(`${docDate} ${docTime}`).format('HH:mm:ss')}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Cond. Operación', bold: true, alignment: 'right' },
                                { text: `${paymentTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Cliente', bold: true, alignment: 'left' },
                                { text: `${customerFullname || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Act. Económica', bold: true, alignment: 'left' },
                                { text: `${customerEconomicActivityName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Dirección', bold: true, alignment: 'left' },
                                { text: `${customerAddress || ''}, ${customerCityName}, ${customerDepartmentName}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NIT', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NRC', bold: true, alignment: 'left' },
                                { text: `${customerNrc || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Teléfono', bold: true, alignment: 'left' },
                                { text: `${customerDefPhoneNumber || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Correo', bold: true, alignment: 'left' },
                                { text: `${customerEmail || ''}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Resp. Emisor', bold: true, alignment: 'left' },
                                { text: `${userPINCodeFullName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `-`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Resp. Receptor', bold: true, alignment: 'left' },
                                { text: `${customerFullname}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      columnGap: 10,
                      width: '100%'
                    },
                    // { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    // {
                    //   stack: [
                    //     { text: 'OTROS DOCUMENTOS ASOCIADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `Identificación del Documento`, bold: false, alignment: 'center' },
                    //             { text: `Descripción`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'VENTA A CUENTA DE TERCEROS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `NIT`, bold: false, alignment: 'center' },
                    //             { text: `Nombre, denominación o razón social`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'DOCUMENTOS RELACIONADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '33%', '34%'],
                    //         body: [
                    //           [
                    //             { text: `Tipo Documento`, bold: false, alignment: 'center' },
                    //             { text: `N° Documento`, bold: false, alignment: 'center' },
                    //             { text: `Fecha Documento`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //   ],
                    //   width: '100%'
                    // },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      layout: 'normalLayout',
                      table: {
                        widths: ['7%', '7%', '7%', '29%', '7.10%', '7.10%', '14.20%', '7.10%', '7.10%', '7.40%'],
                        body: bodyData
                      },
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Notas', bold: true, alignment: 'left' },
                                { text: `${notes || 'Sin notas'}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        }
                      ],
                      columnGap: 5,
                      width: '100%'
                    },
                  ],
                  defaultStyle: {
                    font: 'Roboto',
                    fontSize: 7
                  },
                  pageSize: 'LETTER',
                  pageMargins: [ 40, 60, 40, 60 ]
                };
                
                
                const myTableLayouts = {
                  normalLayout: {
                    hLineWidth: function (i, node) {
                      return 1;
                    },
                    vLineWidth: function (i) {
                      return 1;
                    },
                    hLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    vLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    paddingLeft: function (i) {
                      return 4;
                    },
                    paddingRight: function (i, node) {
                      return 4;
                    }
                  }
                };
                
                const options = {
                  tableLayouts: myTableLayouts
                };

                const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=cfpdf.pdf');

                pdfDoc.pipe(res);
                pdfDoc.end();
              } catch(error) {
                console.log(error);
                res.json({ status: 400, message: 'error', errorContent: error });
              }
            } else {
              res.status(500).json({ error: 'No document found to download', errorMsg: 'Error al descargar el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.sendEmailCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT * FROM vw_sales vs WHERE vs.id = ?;
          SELECT ROW_NUMBER() OVER() AS itemNum, vsd.* FROM vw_saledetails vsd WHERE vsd.saleId = ?;
          SELECT fn_gendtecf(?) AS JSONDTE;
        `,
        [ saleId, saleId, saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                id,
                controlNumber,
                generationCode,
                dteType,
                receptionStamp,
                dteTransmitionStatus,
                dteTransmitionStatusName,
                transmissionType,
                transmissionTypeName,
                transmissionModel,
                transmissionModelName,
                currencyType,
                shiftcutId,
                cashierId,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                locationId,
                locationName,
                locationPhone,
                locationAddress,
                locationDepartmentName,
                locationCityName,
                locationDepartmentMhCode,
                locationCityMhCode,
                locationEmail,
                ownerNit,
                ownerNrc,
                ownerName,
                ownerActivityCode,
                ownerActivityDescription,
                ownerTradename,
                establishmentType,
                customerId,
                documentTypeId,
                documentTypeName,
                paymentTypeId,
                paymentTypeName,
                createdBy,
                createdByFullname,
                userPINCodeFullName,
                docDatetime,
                docDatetimeFormatted,
                docDate,
                docTime,
                docDatetimeLabel,
                docNumber,
                serie,
                paymentStatus,
                expirationDays,
                expirationInformation,
                expiresIn,
                expired,
                IVAretention,
                IVAperception,
                paymentStatusName,
                isVoided,
                voidedByFullname,
                total,
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                totalInLetters,
                saleTotalPaid,
                customerCode,
                customerFullname,
                customerAddress,
                customerDefPhoneNumber,
                customerEmail,
                customerDui,
                customerNit,
                customerNrc,
                customerBusinessLine,
                customerOccupation,
                customerDepartmentName,
                customerCityName,
                customerDepartmentMhCode,
                customerCityMhCode,
                customerEconomicActivityCode,
                customerEconomicActivityName,
                isNoTaxableOperation,
                customerComplementaryName,
                notes
              } = rows[0][0];

              const dteDocumentBody = rows[1];

              const { JSONDTE } = rows[2][0];

              try {
                const printer = new PdfPrinter(fonts);
            
                const bodyData = [];
                bodyData.push([
                  { text: `N°`, bold: false, alignment: 'center' },
                  { text: `Cantidad`, bold: false, alignment: 'center' },
                  { text: `Unidad`, bold: false, alignment: 'center' },
                  { text: `Descripción`, bold: false, alignment: 'center' },
                  { text: `Precio Uni.`, bold: false, alignment: 'center' },
                  { text: `Desc P/Item`, bold: false, alignment: 'center' },
                  { text: `Otros Montos No Afectos`, bold: false, alignment: 'center' },
                  { text: `Ventas No Sujetas`, bold: false, alignment: 'center', fontSize: 6 },
                  { text: `Ventas Exentas`, bold: false, alignment: 'center' },
                  { text: `Ventas Gravadas`, bold: false, alignment: 'center' },
                ]);

                /* itemNum,
                 saleDetailId,
                 saleId,
                 productId,
                 productTypeId,
                 productCode,
                 productName,
                 productMeasurementUnitId,
                 categoryName,
                 brandName,
                 measurementUnitName,
                 unitPrice,
                 unitPriceIva,
                 unitPriceFovial,
                 unitPriceCotrans,
                 unitPriceNoTaxes,
                 unitCost,
                 unitCostNoTaxes,
                 subTotalCost,
                 totalCostTaxes,
                 totalCost,
                 quantity,
                 subTotal,
                 isVoided,
                 isActive,
                 taxesData,
                 ivaTaxAmount,
                 fovialTaxAmount,
                 cotransTaxAmount,
                 totalTaxes,
                 taxableSubTotal,
                 taxableSubTotalWithoutTaxes,
                 noTaxableSubTotal */

                for(const element of (dteDocumentBody || [])) {
                  bodyData.push([
                    { text: `${element?.itemNum || 0}`, bold: false, alignment: 'center' },
                    { text: `${element?.quantity || 0}`, bold: false, alignment: 'right' },
                    { text: `${element?.measurementUnitName || ''}`, bold: false, alignment: 'center' },
                    { text: `${element?.productName || ''}`, bold: false, alignment: 'left' },
                    { text: `${(+element?.unitPrice - (+element?.unitPriceFovial + +element?.unitPriceCotrans + (isNoTaxableOperation ? +element?.unitPriceIva : 0))).toFixed(2) || 0}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount).toFixed(2) : (0)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (0) : (+element?.subTotal - +element?.fovialTaxAmount - +element?.cotransTaxAmount).toFixed(2)}`, bold: false, alignment: 'right' },
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                 /*
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                */

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA VENTAS`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2)}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : 0).toFixed(2) || 0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? 0 : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount) || 0)).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA TOTAL DE OPERACIONES`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS NO SUJETAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS EXENTAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS GRAVADAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                // bodyData.push([
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                //   { text: `IMPUESTO VALOR AGREGADO (13%)`, colSpan: 3, bold: false, alignment: 'right' },
                //   { text: ``, bold: false, alignment: 'right' },
                //   { text: ``, bold: false, alignment: 'right' },
                //   { text: `${Number(totalTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                // ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUBTOTAL`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(+)`, bold: true, color: '#52c41a', alignment: 'center' },
                  { text: `IVA PERCIBIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `IVA RETENIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAretention).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                if (+fovialTaxAmount !== null && +fovialTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `FOVIAL ($0.20/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+fovialTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                if (+cotransTaxAmount !== null && +cotransTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `COTRANS ($0.10/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+cotransTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `RETE. RENTA`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `MONTO TOTAL OPERACION`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `OTROS MONTOS NO AFECTOS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: `VALOR EN LETRAS`, colSpan: 2, bold: false, alignment: 'right' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `${totalInLetters || ''}`, colSpan: 2, bold: false, alignment: 'left' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `TOTAL A PAGAR`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                const docDefinition = {
                  header: function(currentPage, pageCount, pageSize) {
                    // Podemos tener hasta cuatro líneas de encabezado de página
                    return [
                      {
                        text: 'Documento Tributario Electrónico',
                        alignment: 'left',
                        color: '#001d66',
                        bold: true,
                        fontSize: 10,
                        margin: [40, 30, 40, 0]
                      },
                      {
                        text: 'Factura Electrónica',
                        alignment: 'left',
                        color: '#1677ff',
                        fontSize: 8,
                        margin: [40, 0, 40, 0]
                      }
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                    ]
                  },
                  footer: function(currentPage, pageCount) {
                    // Podemos tener hasta cuatro líneas de pie de página
                    return [
                      { text: ``, alignment: 'right', margin: [40, 0, 40, 0] },
                      { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    ]
                  },
                  content: [
                    {
                      columns: [
                        {
                          stack: [
                            {
                              // svg: `
                              //   <svg id="logo-15" width="36" height="36" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              //     <path d="M24.5 12.75C24.5 18.9632 19.4632 24 13.25 24H2V12.75C2 6.53679 7.03679 1.5 13.25 1.5C19.4632 1.5 24.5 6.53679 24.5 12.75Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M24.5 35.25C24.5 29.0368 29.5368 24 35.75 24H47V35.25C47 41.4632 41.9632 46.5 35.75 46.5C29.5368 46.5 24.5 41.4632 24.5 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M2 35.25C2 41.4632 7.03679 46.5 13.25 46.5H24.5V35.25C24.5 29.0368 19.4632 24 13.25 24C7.03679 24 2 29.0368 2 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M47 12.75C47 6.53679 41.9632 1.5 35.75 1.5H24.5V12.75C24.5 18.9632 29.5368 24 35.75 24C41.9632 24 47 18.9632 47 12.75Z" class="ccustom" fill="#030852"></path>
                              //   </svg>
                              // `,
                              svg: pumalogo,
                              alignment: 'center'
                            },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerName}`, bold: true, alignment: 'center' },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerActivityDescription}`.toUpperCase(), bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NIT: ${ownerNit}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NRC: ${ownerNrc}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${locationAddress}, ${locationCityName}, ${locationDepartmentName}`, bold: false, alignment: 'center' }
                          ],
                          width: '30%'
                        },
                        {
                          stack: [
                            {
                              qr: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`,
                              foreground: '#001d66',
                              background: '#e6f4ff',
                              eccLevel: "L",
                              fit: 100,
                              width: '100%',
                              alignment: 'center'
                            },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                            {
                              text: 'Consultar',
                              alignment: 'center',
                              color: '#1677ff',
                              fontSize: 9,
                              link: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`
                            }
                          ],
                          width: '20%'
                        },
                        {
                          layout: 'noBorders',
                          table: {
                            widths: ['30%', '70%'],
                            body: [
                              [
                                { text: 'Código de Generación', bold: true, alignment: 'right' },
                                { text: `${generationCode}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Número de Control', bold: true, alignment: 'right' },
                                { text: `${controlNumber}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Sello de Recepción', bold: true, alignment: 'right' },
                                { text: `${receptionStamp}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Moneda', bold: true, alignment: 'right' },
                                { text: `${currencyType}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Transmisión', bold: true, alignment: 'right' },
                                { text: `${transmissionTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Modelo Facturación', bold: true, alignment: 'right' },
                                { text: `${transmissionModelName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Fecha y hora Generación', bold: true, alignment: 'right' },
                                { text: `${dayjs(docDate).format('DD-MM-YYYY')} ${dayjs(`${docDate} ${docTime}`).format('HH:mm:ss')}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Cond. Operación', bold: true, alignment: 'right' },
                                { text: `${paymentTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Cliente', bold: true, alignment: 'left' },
                                { text: `${(customerId === 1 ? (customerComplementaryName || customerFullname) : customerFullname) || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Dirección', bold: true, alignment: 'left' },
                                { text: `${customerAddress || ''}, ${customerCityName}, ${customerDepartmentName}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'DUI', bold: true, alignment: 'left' },
                                { text: `${customerDui || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NIT', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Teléfono', bold: true, alignment: 'left' },
                                { text: `${customerDefPhoneNumber || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Correo', bold: true, alignment: 'left' },
                                { text: `${customerEmail || ''}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Resp. Emisor', bold: true, alignment: 'left' },
                                { text: `${userPINCodeFullName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `-`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Resp. Receptor', bold: true, alignment: 'left' },
                                { text: `${customerFullname}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                            ]
                          },
                        }
                      ],
                      columnGap: 10,
                      width: '100%'
                    },
                    // { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    // {
                    //   stack: [
                    //     { text: 'OTROS DOCUMENTOS ASOCIADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `Identificación del Documento`, bold: false, alignment: 'center' },
                    //             { text: `Descripción`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'VENTA A CUENTA DE TERCEROS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `NIT`, bold: false, alignment: 'center' },
                    //             { text: `Nombre, denominación o razón social`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'DOCUMENTOS RELACIONADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '33%', '34%'],
                    //         body: [
                    //           [
                    //             { text: `Tipo Documento`, bold: false, alignment: 'center' },
                    //             { text: `N° Documento`, bold: false, alignment: 'center' },
                    //             { text: `Fecha Documento`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //   ],
                    //   width: '100%'
                    // },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      layout: 'normalLayout',
                      table: {
                        widths: ['7%', '7%', '7%', '29%', '7.10%', '7.10%', '14.20%', '7.10%', '7.10%', '7.40%'],
                        body: bodyData
                      },
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Notas', bold: true, alignment: 'left' },
                                { text: `${notes || 'Sin notas'}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        }
                      ],
                      columnGap: 5,
                      width: '100%'
                    },
                  ],
                  defaultStyle: {
                    font: 'Roboto',
                    fontSize: 7
                  },
                  pageSize: 'LETTER',
                  pageMargins: [ 40, 60, 40, 60 ]
                };
                
                
                const myTableLayouts = {
                  normalLayout: {
                    hLineWidth: function (i, node) {
                      return 1;
                    },
                    vLineWidth: function (i) {
                      return 1;
                    },
                    hLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    vLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    paddingLeft: function (i) {
                      return 4;
                    },
                    paddingRight: function (i, node) {
                      return 4;
                    }
                  }
                };
                
                const options = {
                  tableLayouts: myTableLayouts
                };

                const pdfDoc = printer.createPdfKitDocument(docDefinition, options);
                
                const buffers = [];

                pdfDoc.on('data', buffers.push.bind(buffers));
                pdfDoc.on('end', () => {
                  const buffer = Buffer.concat(buffers);
                  let mailOptions;

                  mailOptions = {
                    from: '"DTE Emisor SigPro" <dtesigpro@gmail.com>',
                    to: customerEmail || 'ventas.pumasantarosa@gmail.com',
                    subject: `Puma Santa Rosa - Emisión DTE`,
                    bcc: 'ventas.pumasantarosa@gmail.com',
                    // text: 'Im testing nodemailer and attachment DTE pdf with my personal Gmail account',
                    html: generateDTEHTML.cfHTML({
                      dteTypeName: 'Factura Electrónica',
                      documentDate: docDate,
                      customerFullname: customerFullname,
                      controlNumber: controlNumber,
                      generationCode: generationCode,
                      receptionStamp: receptionStamp
                    }),
                    attachments: [
                      {
                        filename: `${generationCode}.pdf`,
                        content: buffer,
                        contentType: 'application/pdf'
                      },
                      {
                        filename: `${generationCode}.json`,
                        content: JSON.stringify(JSONDTE),
                        encoding: 'utf-8', // Codificación del contenido
                        contentType: 'application/json' // Tipo de contenido
                      }
                    ]
                  }

                  const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                      user: 'dtesigpro@gmail.com',
                      pass: 'qnpw kvfq qlfl tvjl'
                    }
                  });
                
                  transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                      res.json({ status: 400, message: 'Error' });
                    } else {
                      res.json({ status: 200, message: 'Success' });
                    }
                  });
                });

                pdfDoc.end();
              } catch(error) {
                console.log(error);
                res.status(400).json({ status: 400, message: 'error', errorContent: error });
              }
            } else {
              res.status(500).json({ error: 'No document found to download', errorMsg: 'Error al descargar el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

controller.sendEmailCCF = (req, res) => {
  req.getConnection((err, conn) => {
    if (err) res.status(500).json(err);
    else {
      const { saleId } = req.params;
      conn.query(
        `
          SELECT * FROM vw_sales vs WHERE vs.id = ?;
          SELECT ROW_NUMBER() OVER() AS itemNum, vsd.* FROM vw_saledetails vsd WHERE vsd.saleId = ?;
          SELECT fn_gendteccf_test(?) AS JSONDTE;
        `,
        [ saleId, saleId, saleId ],
        async (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (!!rows && rows.length > 0) {
              const {
                id,
                controlNumber,
                generationCode,
                dteType,
                receptionStamp,
                dteTransmitionStatus,
                dteTransmitionStatusName,
                transmissionType,
                transmissionTypeName,
                transmissionModel,
                transmissionModelName,
                currencyType,
                shiftcutId,
                cashierId,
                estCodeInternal,
                estCodeMH,
                posCodeInternal,
                posCodeMH,
                locationId,
                locationName,
                locationPhone,
                locationAddress,
                locationDepartmentName,
                locationCityName,
                locationDepartmentMhCode,
                locationCityMhCode,
                locationEmail,
                ownerNit,
                ownerNrc,
                ownerName,
                ownerActivityCode,
                ownerActivityDescription,
                ownerTradename,
                establishmentType,
                customerId,
                documentTypeId,
                documentTypeName,
                paymentTypeId,
                paymentTypeName,
                createdBy,
                createdByFullname,
                userPINCodeFullName,
                docDatetime,
                docDatetimeFormatted,
                docDate,
                docTime,
                docDatetimeLabel,
                docNumber,
                serie,
                paymentStatus,
                expirationDays,
                expirationInformation,
                expiresIn,
                expired,
                IVAretention,
                IVAperception,
                paymentStatusName,
                isVoided,
                voidedByFullname,
                total,
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                totalInLetters,
                saleTotalPaid,
                customerCode,
                customerFullname,
                customerAddress,
                customerDefPhoneNumber,
                customerEmail,
                customerDui,
                customerNit,
                customerNrc,
                customerBusinessLine,
                customerOccupation,
                customerDepartmentName,
                customerCityName,
                customerDepartmentMhCode,
                customerCityMhCode,
                customerEconomicActivityCode,
                customerEconomicActivityName,
                isNoTaxableOperation,
                notes
              } = rows[0][0];

              const dteDocumentBody = rows[1];

              const { JSONDTE } = rows[2][0];

              try {
                const printer = new PdfPrinter(fonts);
            
                const bodyData = [];
                bodyData.push([
                  { text: `N°`, bold: false, alignment: 'center' },
                  { text: `Cantidad`, bold: false, alignment: 'center' },
                  { text: `Unidad`, bold: false, alignment: 'center' },
                  { text: `Descripción`, bold: false, alignment: 'center' },
                  { text: `Precio Uni.`, bold: false, alignment: 'center' },
                  { text: `Desc P/Item`, bold: false, alignment: 'center' },
                  { text: `Otros Montos No Afectos`, bold: false, alignment: 'center' },
                  { text: `Ventas No Sujetas`, bold: false, alignment: 'center', fontSize: 6 },
                  { text: `Ventas Exentas`, bold: false, alignment: 'center' },
                  { text: `Ventas Gravadas`, bold: false, alignment: 'center' },
                ]);

                /* itemNum,
                 saleDetailId,
                 saleId,
                 productId,
                 productTypeId,
                 productCode,
                 productName,
                 productMeasurementUnitId,
                 categoryName,
                 brandName,
                 measurementUnitName,
                 unitPrice,
                 unitPriceIva,
                 unitPriceFovial,
                 unitPriceCotrans,
                 unitPriceNoTaxes,
                 unitCost,
                 unitCostNoTaxes,
                 subTotalCost,
                 totalCostTaxes,
                 totalCost,
                 quantity,
                 subTotal,
                 isVoided,
                 isActive,
                 taxesData,
                 ivaTaxAmount,
                 fovialTaxAmount,
                 cotransTaxAmount,
                 totalTaxes,
                 taxableSubTotal,
                 taxableSubTotalWithoutTaxes,
                 noTaxableSubTotal */

                for(const element of (dteDocumentBody || [])) {
                  bodyData.push([
                    { text: `${element?.itemNum || 0}`, bold: false, alignment: 'center' },
                    { text: `${element?.quantity || 0}`, bold: false, alignment: 'right' },
                    { text: `${element?.measurementUnitName || ''}`, bold: false, alignment: 'center' },
                    { text: `${element?.productName || ''}`, bold: false, alignment: 'left' },
                    { text: `${+element?.unitPriceNoTaxes || 0}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${Number(0).toFixed(2)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ? (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount) : (0)}`, bold: false, alignment: 'right' },
                    { text: `${isNoTaxableOperation ?  (0) : (+element?.subTotal - +element?.ivaTaxAmount - +element?.fovialTaxAmount - +element?.cotransTaxAmount)}`, bold: false, alignment: 'right' },
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                /*
                ivaTaxAmount,
                fovialTaxAmount,
                cotransTaxAmount,
                totalTaxes,
                taxableSubTotal,
                taxableSubTotalWithoutTaxes,
                noTaxableSubTotal,
                */

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA VENTAS`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2)}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : 0).toFixed(2) || 0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? 0 : taxableSubTotalWithoutTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUMA TOTAL DE OPERACIONES`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(taxableSubTotalWithoutTaxes).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS NO SUJETAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS EXENTAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `DESC., BONIFIC., REBAJAS GRAVADAS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                // if (!isNoTaxableOperation) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `IMPUESTO VALOR AGREGADO (13%)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(isNoTaxableOperation ? 0 : ivaTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                // }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `SUBTOTAL`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(isNoTaxableOperation ? taxableSubTotalWithoutTaxes : taxableSubTotal - ((+fovialTaxAmount + +cotransTaxAmount))).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(+)`, bold: true, color: '#52c41a', alignment: 'center' },
                  { text: `IVA PERCIBIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                  { text: `IVA RETENIDO (1%)`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(IVAretention).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                if (+fovialTaxAmount !== null && +fovialTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `FOVIAL ($0.20/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+fovialTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                if (+cotransTaxAmount !== null && +cotransTaxAmount > 0) {
                  bodyData.push([
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                    { text: `(-)`, bold: true, color: '#f5222d', alignment: 'center' },
                    { text: `COTRANS ($0.10/gal)`, colSpan: 3, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: ``, bold: false, alignment: 'right' },
                    { text: `${Number(+cotransTaxAmount).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                  ]);
                }

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `RETE. RENTA`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `MONTO TOTAL OPERACION`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `OTROS MONTOS NO AFECTOS`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(0).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                bodyData.push([
                  { text: `VALOR EN LETRAS`, colSpan: 2, bold: false, alignment: 'right' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `${totalInLetters || ''}`, colSpan: 2, bold: false, alignment: 'left' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: ``, border: [false, false, false, false], bold: false, alignment: 'center' },
                  { text: `TOTAL A PAGAR`, colSpan: 3, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: ``, bold: false, alignment: 'right' },
                  { text: `${Number(+total - (isNoTaxableOperation ? +ivaTaxAmount : 0) - +IVAretention + +IVAperception).toFixed(2) ||  0}`, fillColor: '#eeeeee', bold: false, alignment: 'right' }
                ]);

                const docDefinition = {
                  header: function(currentPage, pageCount, pageSize) {
                    // Podemos tener hasta cuatro líneas de encabezado de página
                    return [
                      {
                        text: 'Documento Tributario Electrónico',
                        alignment: 'left',
                        color: '#001d66',
                        bold: true,
                        fontSize: 10,
                        margin: [40, 30, 40, 0]
                      },
                      {
                        text: 'Comprobante de Crédito Fiscal',
                        alignment: 'left',
                        color: '#1677ff',
                        fontSize: 8,
                        margin: [40, 0, 40, 0]
                      }
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] },
                      // { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [40, 0, 40, 0] }
                    ]
                  },
                  footer: function(currentPage, pageCount) {
                    // Podemos tener hasta cuatro líneas de pie de página
                    return [
                      { text: ``, alignment: 'right', margin: [40, 0, 40, 0] },
                      { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] },
                      // { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [40, 0, 40, 0] }
                    ]
                  },
                  content: [
                    {
                      columns: [
                        {
                          stack: [
                            {
                              // svg: `
                              //   <svg id="logo-15" width="36" height="36" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              //     <path d="M24.5 12.75C24.5 18.9632 19.4632 24 13.25 24H2V12.75C2 6.53679 7.03679 1.5 13.25 1.5C19.4632 1.5 24.5 6.53679 24.5 12.75Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M24.5 35.25C24.5 29.0368 29.5368 24 35.75 24H47V35.25C47 41.4632 41.9632 46.5 35.75 46.5C29.5368 46.5 24.5 41.4632 24.5 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M2 35.25C2 41.4632 7.03679 46.5 13.25 46.5H24.5V35.25C24.5 29.0368 19.4632 24 13.25 24C7.03679 24 2 29.0368 2 35.25Z" class="ccustom" fill="#030852"></path>
                              //     <path d="M47 12.75C47 6.53679 41.9632 1.5 35.75 1.5H24.5V12.75C24.5 18.9632 29.5368 24 35.75 24C41.9632 24 47 18.9632 47 12.75Z" class="ccustom" fill="#030852"></path>
                              //   </svg>
                              // `,
                              svg: pumalogo,
                              alignment: 'center'
                            },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerName}`, bold: true, alignment: 'center' },
                            { text: `-`, bold: true, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${ownerActivityDescription}`.toUpperCase(), bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NIT: ${ownerNit}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `NRC: ${ownerNrc}`, bold: false, alignment: 'center' },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 3 },
                            { text: `${locationAddress}, ${locationCityName}, ${locationDepartmentName}`, bold: false, alignment: 'center' }
                          ],
                          width: '30%'
                        },
                        {
                          stack: [
                            {
                              qr: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`,
                              foreground: '#001d66',
                              background: '#e6f4ff',
                              eccLevel: "L",
                              fit: 100,
                              width: '100%',
                              alignment: 'center'
                            },
                            { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                            {
                              text: 'Consultar',
                              alignment: 'center',
                              color: '#1677ff',
                              fontSize: 9,
                              link: `https://admin.factura.gob.sv/consultaPublica?ambiente=${mhAmbient}&codGen=${generationCode || ''}&fechaEmi=${docDate}`
                            }
                          ],
                          width: '20%'
                        },
                        {
                          layout: 'noBorders',
                          table: {
                            widths: ['30%', '70%'],
                            body: [
                              [
                                { text: 'Código de Generación', bold: true, alignment: 'right' },
                                { text: `${generationCode}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Número de Control', bold: true, alignment: 'right' },
                                { text: `${controlNumber}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Sello de Recepción', bold: true, alignment: 'right' },
                                { text: `${receptionStamp}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Moneda', bold: true, alignment: 'right' },
                                { text: `${currencyType}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Tipo Transmisión', bold: true, alignment: 'right' },
                                { text: `${transmissionTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Modelo Facturación', bold: true, alignment: 'right' },
                                { text: `${transmissionModelName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Fecha y hora Generación', bold: true, alignment: 'right' },
                                { text: `${dayjs(docDate).format('DD-MM-YYYY')} ${dayjs(`${docDate} ${docTime}`).format('HH:mm:ss')}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Cond. Operación', bold: true, alignment: 'right' },
                                { text: `${paymentTypeName}`, background: '#e6f4ff', bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Cliente', bold: true, alignment: 'left' },
                                { text: `${customerFullname || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Act. Económica', bold: true, alignment: 'left' },
                                { text: `${customerEconomicActivityName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Dirección', bold: true, alignment: 'left' },
                                { text: `${customerAddress || ''}, ${customerCityName}, ${customerDepartmentName}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NIT', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'NRC', bold: true, alignment: 'left' },
                                { text: `${customerNrc || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Teléfono', bold: true, alignment: 'left' },
                                { text: `${customerDefPhoneNumber || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Correo', bold: true, alignment: 'left' },
                                { text: `${customerEmail || ''}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Resp. Emisor', bold: true, alignment: 'left' },
                                { text: `${userPINCodeFullName || ''}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `-`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'Resp. Receptor', bold: true, alignment: 'left' },
                                { text: `${customerFullname}`, bold: false, alignment: 'left' }
                              ],
                              [
                                { text: 'N° Documento', bold: true, alignment: 'left' },
                                { text: `${customerNit || ''}`, bold: false, alignment: 'left' }
                              ],
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        },
                      ],
                      columnGap: 10,
                      width: '100%'
                    },
                    // { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    // {
                    //   stack: [
                    //     { text: 'OTROS DOCUMENTOS ASOCIADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `Identificación del Documento`, bold: false, alignment: 'center' },
                    //             { text: `Descripción`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'VENTA A CUENTA DE TERCEROS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '67%'],
                    //         body: [
                    //           [
                    //             { text: `NIT`, bold: false, alignment: 'center' },
                    //             { text: `Nombre, denominación o razón social`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     { text: 'DOCUMENTOS RELACIONADOS', background: '#f0f0f0', bold: false, alignment: 'center', width: '100%' },
                    //     { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 4, width: '100%' },
                    //     {
                    //       layout: 'normalLayout',
                    //       table: {
                    //         widths: ['33%', '33%', '34%'],
                    //         body: [
                    //           [
                    //             { text: `Tipo Documento`, bold: false, alignment: 'center' },
                    //             { text: `N° Documento`, bold: false, alignment: 'center' },
                    //             { text: `Fecha Documento`, bold: false, alignment: 'center' }
                    //           ],
                    //           [
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' },
                    //             { text: `-`, bold: false, alignment: 'center' }
                    //           ]
                    //         ]
                    //       },
                    //       width: '100%' // Ajustar automáticamente el ancho de la columna
                    //     },
                    //   ],
                    //   width: '100%'
                    // },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      layout: 'normalLayout',
                      table: {
                        widths: ['7%', '7%', '7%', '29%', '7.10%', '7.10%', '14.20%', '7.10%', '7.10%', '7.40%'],
                        body: bodyData
                      },
                      width: '100%'
                    },
                    { text: `-`, bold: false, alignment: 'center', color: '#FFFFFF', fontSize: 16, width: '100%' },
                    {
                      columns: [
                        {
                          layout: 'normalLayout',
                          table: {
                            widths: ['20%', '80%'],
                            body: [
                              [
                                { text: 'Notas', bold: true, alignment: 'left' },
                                { text: `${notes || 'Sin notas'}`, bold: false, alignment: 'left' }
                              ]
                            ]
                          },
                          width: '50%' // Ajustar automáticamente el ancho de la columna
                        }
                      ],
                      columnGap: 5,
                      width: '100%'
                    },
                  ],
                  defaultStyle: {
                    font: 'Roboto',
                    fontSize: 7
                  },
                  pageSize: 'LETTER',
                  pageMargins: [ 40, 60, 40, 60 ]
                };
                
                
                const myTableLayouts = {
                  normalLayout: {
                    hLineWidth: function (i, node) {
                      return 1;
                    },
                    vLineWidth: function (i) {
                      return 1;
                    },
                    hLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    vLineColor: function (i) {
                      return '#bfbfbf';
                    },
                    paddingLeft: function (i) {
                      return 4;
                    },
                    paddingRight: function (i, node) {
                      return 4;
                    }
                  }
                };
                
                const options = {
                  tableLayouts: myTableLayouts
                };

                const pdfDoc = printer.createPdfKitDocument(docDefinition, options);

                const buffers = [];

                pdfDoc.on('data', buffers.push.bind(buffers));
                pdfDoc.on('end', () => {
                  const buffer = Buffer.concat(buffers);

                  let mailOptions;
                  
                  mailOptions = {
                    from: '"DTE Emisor SigPro" <dtesigpro@gmail.com>',
                    to: customerEmail || 'ventas.pumasantarosa@gmail.com',
                    subject: `Puma Santa Rosa - Emisión DTE`,
                    bcc: 'ventas.pumasantarosa@gmail.com',
                    // text: 'Im testing nodemailer and attachment DTE pdf with my personal Gmail account',
                    html: generateDTEHTML.cfHTML({
                      dteTypeName: 'Comprobante de Crédito Fiscal',
                      documentDate: docDate,
                      customerFullname: customerFullname,
                      controlNumber: controlNumber,
                      generationCode: generationCode,
                      receptionStamp: receptionStamp
                    }),
                    attachments: [
                      {
                        filename: `${generationCode}.pdf`,
                        content: buffer,
                        contentType: 'application/pdf'
                      },
                      {
                        filename: `${generationCode}.json`,
                        content: JSON.stringify(JSONDTE),
                        encoding: 'utf-8', // Codificación del contenido
                        contentType: 'application/json' // Tipo de contenido
                      }
                    ]
                  };
                  
                  const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                      user: 'dtesigpro@gmail.com',
                      pass: 'qnpw kvfq qlfl tvjl'
                    }
                  });
                
                  transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                      console.log(error);
                      res.json({ status: 400, message: 'Error' });
                    } else {
                      res.json({ status: 200, message: 'Success' });
                    }
                  });
                })

                pdfDoc.end();
              } catch(error) {
                console.log(error);
                res.json({ status: 400, message: 'error', errorContent: error });
              }
            } else {
              res.status(500).json({ error: 'No document found to download', errorMsg: 'Error al descargar el documento. Consulte su sistema integrado.' });
            }
          }
        }
      )
    }
  });
}

export default controller;
