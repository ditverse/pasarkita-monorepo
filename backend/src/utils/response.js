const successResponse = (res, statusCode = 200, message = 'Success', data = null, pagination = null) => {
  const response = { success: true };
  if (message) response.message = message;
  if (data) response.data = data;
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', errorCode = 'INTERNAL_ERROR', details = null) => {
  const response = {
    success: false,
    message,
    error: { code: errorCode }
  };
  if (details) response.error.details = details;
  return res.status(statusCode).json(response);
};

module.exports = { successResponse, errorResponse };
