/**
 * Safely parses a string or number into a positive integer.
 * @param {any} value - Value to parse.
 * @param {number} fallback - Fallback value.
 * @param {number} [max=100] - Maximum allowed value.
 * @returns {number}
 */
const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

/**
 * Returns a Date object set to the beginning of the day in Jakarta (UTC+7).
 * @param {Date} date - Source date.
 * @returns {Date}
 */
const startOfJakartaDay = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
};

/**
 * Returns a YYYY-MM-DD string representation of a Date in Jakarta time.
 * @param {string|Date} iso - ISO date string or Date object.
 * @returns {string}
 */
const bucketKey = (iso) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/**
 * Parses query object for date range filters.
 * @param {object} query - Express query object.
 * @returns {{ start: Date, end: Date }}
 */
const parsePeriod = (query) => {
  if (query.date_from && query.date_to) {
    const start = new Date(`${query.date_from}T00:00:00+07:00`);
    const end = new Date(`${query.date_to}T23:59:59.999+07:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { start, end };
    }
  }
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  return { start: startOfJakartaDay(start), end };
};

/**
 * Escapes value for CSV safety.
 * @param {any} val - Value to escape.
 * @returns {string}
 */
const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

module.exports = {
  parsePositiveInt,
  startOfJakartaDay,
  bucketKey,
  parsePeriod,
  escapeCSV,
};
