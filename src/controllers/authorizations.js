import pkg from 'jsonwebtoken';
import { config } from 'dotenv';
import connUtil from '../helpers/connectionUtil.js';
import axios from 'axios';
import { mhAmbient, mhEndpoint } from '../configs/mhsettings.js';
const { sign } = pkg;

config();

const controller = {};

const queries = {
  authLogin: `CALL usp_AuthUser(?, ?);`,
  authUserPassword: `CALL usp_AuthUserPassword(?, ?);`,
  authUserPINCode: `CALL usp_AuthUserPINCode(?);`
};

// TEST
// const mhEndpoint = `https://apitest.dtes.mh.gob.sv`;
// PRD
// const mhEndpoint = `https://api.dtes.mh.gob.sv`;

// TEST
// const mhAmbient = "00";
// PRD
// const mhAmbient = "01";

controller.authMH = async (req, res) => {
  try {
    const formData = new FormData();

    formData.append('user', process.env.PDEV_MHUSER);
    formData.append('pwd', process.env.PDEV_MHPASS);

    const response = await axios.post(`${mhEndpoint}/seguridad/auth`, formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      },
    })
    
    const data = response.data;

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error, errorMsg: 'No fue posible autenticar con MH' });
  }
}

controller.authLogin = async (req, res) => {
  let mhToken = null;

  try {
    const formData = new FormData();

    console.log(process.env.PDEV_MHUSER);
    console.log(process.env.PDEV_MHPASS);

    formData.append('user', process.env.PDEV_MHUSER);
    formData.append('pwd', process.env.PDEV_MHPASS);

    const response = await axios.post(`${mhEndpoint}/seguridad/auth`, formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      },
    })
    
    const data = response.data;
    console.log(data);

    if (data?.status === "OK") {
      const { status, body } = data;
      const { token } = body;
      mhToken = token;
    }

    // res.json(data);
  } catch (error) {
    console.log(error);
    console.error('No fue posible autenticar:', error);
    // res.status(500).json({ error, errorMsg: 'Error al llamar a la API externa' });
  }
  
  req.getConnection((err, conn) => {
    if (err) res.status(500).json({ info: err });
    else {
      const { username, password } = req.body;
      conn.query(
        queries.authLogin,
        [ username, password ], 
        (err, rows) => {
          if (err) res.status(400).json({ info: err });
          else {
            const token = sign(
              { 
                payload: rows[0][0]}, 
                process.env.PDEV_JWTSECRET,
                { expiresIn: '24h' } // CONFIG OBJECT
              );
            res.json({ userdata: rows[0][0], token: token, mhToken });
          }
      })
    }
  })
}

controller.authUserPassword = (req, res) => {
  const { password, actionType } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.authUserPassword, [password, actionType], res));
}

controller.authUserPINCode = (req, res) => {
  const { PINCode } = req.body;
  req.getConnection(connUtil.connSPFunc(queries.authUserPINCode, [ PINCode ], res));
}

controller.successVerification = (req, res) => {
  res.json({ status: 200, message: 'Success' });
}

export default controller;
