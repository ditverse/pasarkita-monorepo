const errorHandler = (err, req, res, next) => {
  const isFileTooLarge = err.code === 'LIMIT_FILE_SIZE';
  const status = isFileTooLarge ? 413 : err.status || 500;
  
  if (status >= 500) {
    console.error(err);
  } else {
    console.warn(`[Client Error] ${err.code || 'BAD_REQUEST'}: ${err.message}`);
  }

  res.status(status).json({
    success: false,
    message: isFileTooLarge ? 'Ukuran gambar maksimal 5MB' : err.message || 'Internal server error',
    error: {
      code: isFileTooLarge ? 'IMAGE_TOO_LARGE' : err.code || 'INTERNAL_ERROR',
      details: err.details || null
    }
  });
};

module.exports = errorHandler;

