import jsonwebtoken from 'jsonwebtoken';
const { verify } = jsonwebtoken;

const middleware = {};

const checkIfUserIsActiveQuery = `SELECT IFNULL((SELECT isActive FROM users WHERE id = ?), 0) AS isActive;`;

middleware.checkToken = (req, res, next) => {
  const { authorization, idtoauth, mhauth } = req.headers;
  // console.log(idtoauth, mhauth);
  verify(authorization, process.env.PDEV_JWTSECRET, (err, data) => {
    if (err) res.status(401).send(err);
    else next();
  })
}

middleware.checkUserIsActive = (req, res, next) => {
  req.getConnection((err, conn) => {
    if (err) res.status(400).json(err);
    else {
      const { idtoauth } = req.headers;
      conn.query(
        checkIfUserIsActiveQuery,
        [ idtoauth ],
        (err, rows) => {
          if (err) res.status(400).json(err);
          else {
            if (rows[0].isActive === 1) next();
            else res.status(400).json({ status: 400, message: 'Current users cant be authorized because block or ban' });
          }
        }
      )
    }
  })
}

export default middleware;