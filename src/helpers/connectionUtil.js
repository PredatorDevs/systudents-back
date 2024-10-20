import errorResponses from './errorResponses.js';

const connUtil = {};

connUtil.connSPFunc = (query, queryParams, res) => ((err, conn) => {
  if (err) res.status(400).json(errorResponses.status400(err));
  else {
    conn.query(
      query,
      queryParams,
      (err, rows) => {
        if (err) res.status(400).json(errorResponses.status400(err));
        else res.json(rows[0]);
      }
    )
  }
});

connUtil.connFunc = (query, queryParams, res, indexToReturn = null) => ((err, conn) => {
  if (err) res.status(400).json(errorResponses.status400(err));
  else {
    conn.query(
      query,
      queryParams,
      (err, rows) => {
        if (err) res.status(400).json(errorResponses.status400(err));
        else {
          try {
            if (indexToReturn !== null) {
              res.json(rows[indexToReturn]); 
            } else {
              res.json(rows);
            }
          } catch(error) {
            res.json(error); 
          }
        }
      }
    )
  }
});

connUtil.connFuncReturn = (query, queryParams, res, indexToReturn = null) => ((err, conn) => {
  if (err) res.status(400).json(errorResponses.status400(err));
  else {
    conn.query(
      query,
      queryParams,
      (err, rows) => {
        if (err) res.status(400).json(errorResponses.status400(err));
        else {
          try {
            if (indexToReturn !== null) {
              return rows[indexToReturn]; 
            } else {
              return rows;
            }
          } catch(error) {
            res.json(error); 
          }
        }
      }
    )
  }
});

export default connUtil;
