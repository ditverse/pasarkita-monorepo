const { errorResponse } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    return errorResponse(res, 400, 'Validasi gagal', 'VALIDATION_ERROR', err.errors);
  }
};

module.exports = validate;
