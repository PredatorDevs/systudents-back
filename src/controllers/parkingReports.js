import connUtil from "../helpers/connectionUtil.js";

const controller = {};

const queries = {
  guardIncomesByMonth: `
    SELECT 
      parkingGuardId,
      parkingGuardFullname,
      parkingGuardChartColor,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          "day",
          checkoutDay,
          "total",
          checkoutTotal
        )
      ) AS dataset
    FROM vw_guardincomes 
    WHERE checkoutDate BETWEEN ? AND ?
    GROUP BY
      parkingGuardId,
      parkingGuardFullname
    ORDER BY
      parkingGuardFullname,
      checkoutDay;
  `,
  guardIncomesByWeek: `
    SELECT 
      parkingGuardId,
      parkingGuardFullname,
      parkingGuardChartColor,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          "day",
          checkoutDay,
          "total",
          checkoutTotal
        )
      ) AS dataset
    FROM vw_guardincomes 
    WHERE checkoutFullDate BETWEEN ? AND ?
    GROUP BY
      parkingGuardId,
      parkingGuardFullname
    ORDER BY
      parkingGuardFullname,
      checkoutDay;
  `,
  incomesByMonth: `
    SELECT
      checkoutFullDate,
      SUM(IF(parkingGuardSchedule = 'M', checkoutTotal, 0)) AS morningTotal,
      SUM(IF(parkingGuardSchedule = 'V', checkoutTotal, 0)) AS noonTotal,
      SUM(checkoutTotal) AS checkoutTotal
    FROM
      vw_guardincomes
    WHERE
      checkoutDate BETWEEN ? AND ?
    GROUP BY
      checkoutFullDate
    ORDER BY
      checkoutFullDate;
  `,
  incomesByWeek: `
    SELECT
      checkoutFullDate,
      SUM(IF(parkingGuardSchedule = 'M', checkoutTotal, 0)) AS morningTotal,
      SUM(IF(parkingGuardSchedule = 'V', checkoutTotal, 0)) AS noonTotal,
      SUM(checkoutTotal) AS checkoutTotal
    FROM
      vw_guardincomes
    WHERE
      checkoutFullDate BETWEEN ? AND ?
    GROUP BY
      checkoutFullDate
    ORDER BY
      checkoutFullDate;
  `,
  expensesByMonth: `
    SELECT
      documentFullDate,
      concept,
      amount
    FROM
      vw_parkingexpenses
    WHERE
      documentDate BETWEEN ? AND ?
    ORDER BY
      documentFullDate;
  `,
  expensesByWeek: `
    SELECT
      documentFullDate,
      concept,
      amount
    FROM
      vw_parkingexpenses
    WHERE
      documentFullDate BETWEEN ? AND ?
    ORDER BY
      documentFullDate;
  `
}

controller.guardIncomesByMonth = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07" Expected format
  req.getConnection(connUtil.connFunc(queries.guardIncomesByMonth, [ initDate, finalDate ], res));
}

controller.guardIncomesByWeek = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07-01" Expected format
  req.getConnection(connUtil.connFunc(queries.guardIncomesByWeek, [ initDate, finalDate ], res));
}

controller.incomesByMonth = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07" Expected format
  req.getConnection(connUtil.connFunc(queries.incomesByMonth, [ initDate, finalDate ], res));
}

controller.incomesByWeek = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07-01" Expected format
  req.getConnection(connUtil.connFunc(queries.incomesByWeek, [ initDate, finalDate ], res));
}

controller.expensesByMonth = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07" Expected format
  req.getConnection(connUtil.connFunc(queries.expensesByMonth, [ initDate, finalDate ], res));
}

controller.expensesByWeek = (req, res) => {
  const { initDate, finalDate } = req.params;
  // "2023-07-01" Expected format
  req.getConnection(connUtil.connFunc(queries.expensesByWeek, [ initDate, finalDate ], res));
}

export default controller;
