const FEE_PERCENTAGE = 0.02;

/**
 * ALGORITMA GREEDY — Perhitungan Fee Marketplace
 *
 * Strategi: Langsung hitung fee 2% dari subtotal tanpa optimasi global.
 * Keputusan diambil sekali (satu langkah), tanpa backtracking.
 *
 * Dokumentasi: docs/algorithms/greedy-algorithm.md
 */
const calculateFee = (subtotal) => {
  const fee = Math.round(subtotal * FEE_PERCENTAGE);
  const total = subtotal + fee;
  return { subtotal, fee_marketplace: fee, total, fee_percentage: FEE_PERCENTAGE * 100 };
};

module.exports = { calculateFee };
