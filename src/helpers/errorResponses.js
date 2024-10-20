const errorResponses = {};

errorResponses.status400 = (err, message = 'Database connection error') => (
  {status: 400, message: 'Database connection error', errorContent: err}
);

errorResponses.status500 = (err, message = 'Internal server error') => (
  {status: 500, message: message, errorContent: err}
);

export default errorResponses;
