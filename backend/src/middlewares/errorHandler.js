const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    error: {
      code: err.code || 'INTERNAL_ERROR',
      details: err.details || null
    }
  });
};

module.exports = errorHandler;
