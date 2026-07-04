const test = require('node:test');
const assert = require('node:assert');

// Import utilities to test
const { calculateFee } = require('../src/utils/fee');
const { buildPrefixTable, kmpSearch, kmpFilterProducts } = require('../src/utils/kmp-search');
const { parsePositiveInt, startOfJakartaDay, bucketKey, parsePeriod, escapeCSV } = require('../src/utils/shared');
const { AppError } = require('../src/utils/app-error');

test('Fee Utility - calculateFee', (t) => {
  // Test basic fee calculation (2%)
  const result1 = calculateFee(100000);
  assert.strictEqual(result1.subtotal, 100000);
  assert.strictEqual(result1.fee_marketplace, 2000);
  assert.strictEqual(result1.total, 102000);
  assert.strictEqual(result1.fee_percentage, 2);

  // Test rounding
  const result2 = calculateFee(55); // 55 * 0.02 = 1.1 -> rounds to 1
  assert.strictEqual(result2.fee_marketplace, 1);
  assert.strictEqual(result2.total, 56);
});

test('KMP Search Utility - Knuth-Morris-Pratt Algorithm', (t) => {
  // Test prefix table construction
  const prefixTable = buildPrefixTable('ABCABD');
  assert.deepStrictEqual(prefixTable, [0, 0, 0, 1, 2, 0]);

  // Test basic string search (case-insensitive)
  assert.strictEqual(kmpSearch('Kripik Singkong Gurih', 'singkong'), true);
  assert.strictEqual(kmpSearch('Kripik Singkong Gurih', 'SINGKONG'), true);
  assert.strictEqual(kmpSearch('Kripik Singkong Gurih', 'keju'), false);

  // Test empty/edge cases
  assert.strictEqual(kmpSearch('Kripik Singkong', ''), true); // empty pattern matches anything
  assert.strictEqual(kmpSearch('', 'singkong'), false); // empty text cannot match non-empty pattern
  assert.strictEqual(kmpSearch('Singkong', 'Singkong Super Jumbo'), false); // pattern longer than text

  // Test filter products
  const products = [
    { id: '1', name: 'Kripik Tempe Premium' },
    { id: '2', name: 'Sambal Terasi Pedas' },
    { id: '3', name: 'Kripik Singkong Renyah' },
  ];

  const filtered1 = kmpFilterProducts(products, 'kripik');
  assert.strictEqual(filtered1.length, 2);
  assert.strictEqual(filtered1[0].id, '1');
  assert.strictEqual(filtered1[1].id, '3');

  const filtered2 = kmpFilterProducts(products, 'sambal');
  assert.strictEqual(filtered2.length, 1);
  assert.strictEqual(filtered2[0].id, '2');

  const filteredEmpty = kmpFilterProducts(products, '');
  assert.strictEqual(filteredEmpty.length, 3);
});

test('Shared Utility Helpers', (t) => {
  // parsePositiveInt
  assert.strictEqual(parsePositiveInt('5', 10), 5);
  assert.strictEqual(parsePositiveInt('-2', 10), 10);
  assert.strictEqual(parsePositiveInt('invalid', 10), 10);
  assert.strictEqual(parsePositiveInt('150', 10, 100), 100); // respects max limit

  // escapeCSV
  assert.strictEqual(escapeCSV('simple'), 'simple');
  assert.strictEqual(escapeCSV('with,comma'), '"with,comma"');
  assert.strictEqual(escapeCSV('with"quote'), '"with""quote"');
  assert.strictEqual(escapeCSV(null), '');
  assert.strictEqual(escapeCSV(undefined), '');

  // startOfJakartaDay & bucketKey
  const date = new Date('2026-07-04T14:15:00.000Z');
  const startDay = startOfJakartaDay(date);
  assert.ok(startDay instanceof Date);
  assert.strictEqual(bucketKey(date), '2026-07-04');
});

test('AppError - Standard Error Class', (t) => {
  const error = new AppError(404, 'NOT_FOUND', 'Sumber daya tidak ditemukan', { id: 123 });
  assert.ok(error instanceof Error);
  assert.ok(error instanceof AppError);
  assert.strictEqual(error.name, 'AppError');
  assert.strictEqual(error.status, 404);
  assert.strictEqual(error.code, 'NOT_FOUND');
  assert.strictEqual(error.message, 'Sumber daya tidak ditemukan');
  assert.deepStrictEqual(error.details, { id: 123 });
});
