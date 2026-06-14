import { SavedProduct } from '@/store/buyer-preferences';
import { Product } from '@/types/api';

export type ProductRecommendation = {
  product: Product;
  reason: string;
};

/**
 * ALGORITMA GREEDY — Rekomendasi Produk
 *
 * Strategi: Hitung skor setiap produk secara lokal (optimal lokal),
 * lalu ambil N produk dengan skor tertinggi (greedy choice).
 *
 * Kompleksitas: O(n log n) dimana n = jumlah produk kandidat.
 *
 * Dokumentasi lengkap: docs/algorithms/greedy-algorithm.md
 */
export function buildProductRecommendations(
  products: Product[],
  recentlyViewed: SavedProduct[],
  limit = 4
): ProductRecommendation[] {
  const viewedIds = new Set(recentlyViewed.map((item) => item.id));
  const categoryWeights = new Map<string, number>();

  // GREEDY STEP 1: Bangun bobot preferensi kategori dari riwayat browsing
  recentlyViewed.slice(0, 8).forEach((item, index) => {
    const category = item.category.trim();
    if (!category) return;
    categoryWeights.set(category, (categoryWeights.get(category) ?? 0) + (8 - index));
  });

  // GREEDY STEP 2: Hitung skor lokal setiap produk (tanpa backtracking)
  // GREEDY STEP 3: Sort dan ambil top-N (greedy choice property)
  return products
    .filter((product) => !viewedIds.has(product.id) && product.stock > 0)
    .map((product) => {
      const categoryWeight = categoryWeights.get(product.category) ?? 0;
      const popularityScore = (product.sold_units ?? 0) * 2
        + (product.rating_average ?? 0) * Math.min(product.rating_count ?? 0, 10);

      return {
        product,
        categoryWeight,
        score: categoryWeight * 1000 + popularityScore,
        reason: categoryWeight > 0
          ? `Karena Anda melihat kategori ${product.category}`
          : (product.sold_units ?? 0) > 0
            ? 'Populer di kalangan pembeli'
            : 'Produk baru untuk dijelajahi',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product, reason }) => ({ product, reason }));
}
