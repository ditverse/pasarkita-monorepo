/**
 * ALGORITMA STRING MATCHING — Knuth-Morris-Pratt (KMP)
 *
 * KMP menghindari perbandingan ulang karakter yang sudah cocok dengan
 * memanfaatkan tabel "failure function" (prefix function) dari pattern.
 *
 * Kompleksitas:
 *   - Preprocessing (bangun tabel prefix): O(m)
 *   - Pencarian: O(n)
 *   - Total: O(n + m)
 *
 * Dokumentasi lengkap: docs/algorithms/string-matching-algorithm.md
 */

/**
 * Bangun tabel prefix (failure function) untuk pattern.
 * Tabel ini menyimpan panjang prefix terpanjang yang juga merupakan suffix
 * untuk setiap posisi di pattern.
 *
 * Contoh: pattern "ABCABD"
 *   index:  0  1  2  3  4  5
 *   char:   A  B  C  A  B  D
 *   table: [0, 0, 0, 1, 2, 0]
 *
 * @param {string} pattern - Pattern yang akan dicari
 * @returns {number[]} Tabel prefix
 */
function buildPrefixTable(pattern) {
  const table = new Array(pattern.length).fill(0);
  let length = 0; // panjang prefix-suffix terpanjang sebelumnya
  let i = 1;

  while (i < pattern.length) {
    if (pattern[i] === pattern[length]) {
      length++;
      table[i] = length;
      i++;
    } else {
      if (length !== 0) {
        // Jangan increment i, coba panjang prefix-suffix yang lebih pendek
        length = table[length - 1];
      } else {
        table[i] = 0;
        i++;
      }
    }
  }

  return table;
}

/**
 * Cari apakah `pattern` muncul sebagai substring di dalam `text`.
 * Menggunakan algoritma KMP (case-insensitive).
 *
 * @param {string} text - Teks yang akan dicari (misal: nama produk)
 * @param {string} pattern - Kata kunci pencarian
 * @returns {boolean} true jika pattern ditemukan di dalam text
 */
function kmpSearch(text, pattern) {
  if (!pattern || pattern.length === 0) return true;
  if (!text || text.length === 0) return false;

  // Case-insensitive: konversi ke lowercase
  const t = text.toLowerCase();
  const p = pattern.toLowerCase();

  if (p.length > t.length) return false;

  // STEP 1: Preprocessing — Bangun tabel prefix dari pattern
  const prefixTable = buildPrefixTable(p);

  // STEP 2: Pencarian KMP
  let i = 0; // index di text
  let j = 0; // index di pattern

  while (i < t.length) {
    if (t[i] === p[j]) {
      i++;
      j++;
    }

    if (j === p.length) {
      // Pattern ditemukan di posisi (i - j)
      return true;
    } else if (i < t.length && t[i] !== p[j]) {
      if (j !== 0) {
        // Gunakan tabel prefix untuk melompat (TIDAK mulai dari awal)
        // Ini yang membedakan KMP dari Naive — tidak ada backtracking di text
        j = prefixTable[j - 1];
      } else {
        i++;
      }
    }
  }

  return false; // Pattern tidak ditemukan
}

/**
 * Filter array produk berdasarkan keyword menggunakan KMP.
 *
 * @param {Array} products - Array produk
 * @param {string} keyword - Kata kunci pencarian
 * @param {string} field - Nama field yang dicari (default: 'name')
 * @returns {Array} Produk yang cocok
 */
function kmpFilterProducts(products, keyword, field = 'name') {
  if (!keyword || keyword.trim().length === 0) return products;

  const searchTerm = keyword.trim();
  return products.filter((product) => kmpSearch(product[field] || '', searchTerm));
}

module.exports = { buildPrefixTable, kmpSearch, kmpFilterProducts };
