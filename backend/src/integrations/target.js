const env = require('../config/env');

const isDevelopment = env.NODE_ENV === 'development';

const getIntegrationTarget = (service, path) => {
  const directBaseUrl = service === 'smartbank'
    ? env.SMARTBANK_URL
    : env.LOGISTIKITA_URL;

  if (directBaseUrl && (isDevelopment || directBaseUrl.includes('localhost'))) {
    return {
      url: `${directBaseUrl}${path}`,
      logService: service,
    };
  }

  if (!env.GATEWAY_BASE_URL) {
    throw {
      status: 503,
      code: 'GATEWAY_NOT_CONFIGURED',
      message: 'API Gateway wajib dikonfigurasi untuk komunikasi antar aplikasi',
    };
  }

  return {
    url: `${env.GATEWAY_BASE_URL}/${service}${path}`,
    logService: 'gateway',
  };
};

module.exports = { getIntegrationTarget };
