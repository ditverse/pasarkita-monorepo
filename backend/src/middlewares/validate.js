const { errorResponse } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    const details = err.issues ?? err.errors ?? null;
    return errorResponse(res, 400, 'Validasi gagal', 'VALIDATION_ERROR', details);
  }
};

module.exports = validate;
