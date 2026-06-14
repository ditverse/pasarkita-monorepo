# Algoritma Greedy di PasarKita

## 1. Definisi

**Greedy Algorithm** adalah algoritma yang menyelesaikan masalah dengan cara
**memilih solusi terbaik secara lokal (pada saat itu)** di setiap langkah, tanpa
mempertimbangkan kembali keputusan sebelumnya. Prinsip utamanya:

> "Ambil yang terbaik sekarang, dan jangan pernah melihat ke belakang."

Ciri-ciri Greedy:
- Membuat keputusan **satu per satu** secara berurutan.
- Setiap keputusan bersifat **optimal lokal** (terbaik di langkah tersebut).
- Tidak ada **backtracking** (mundur untuk mengubah keputusan sebelumnya).
- Cepat karena hanya perlu **satu kali iterasi** (umumnya O(n) atau O(n log n)).

---

## 2. Penerapan di PasarKita

Greedy digunakan di **3 tempat utama** dalam PasarKita:

| # | Fitur | File | Cara Kerja Greedy |
|---|---|---|---|
| A | Rekomendasi Produk | `frontend/lib/product-recommendations.ts` | Hitung skor setiap produk → ambil 4 terbaik |
| B | Sorting Produk Terlaris | `backend/src/modules/products/product.service.js` | Ranking produk berdasarkan penjualan → ambil halaman terbaik |
| C | Perhitungan Fee Marketplace | `backend/src/utils/fee.js` | Hitung 2% dari subtotal → langsung pakai hasilnya |

---

## 3. Penerapan A: Rekomendasi Produk (Utama)

### 3.1 Alur Algoritma (Pseudocode)

```
FUNGSI RekomendasiProdukGreedy(semuaProduk, riwayatDilihat, batas):

  // LANGKAH 1: Bangun "bobot preferensi kategori" dari riwayat
  UNTUK setiap produk di riwayatDilihat (maks 8 terakhir):
    bobotKategori[produk.kategori] += (8 - urutanIndex)
    // Produk yang baru dilihat mendapat bobot lebih tinggi

  // LANGKAH 2: Hitung skor GREEDY untuk setiap produk kandidat
  UNTUK setiap produk di semuaProduk:
    JIKA produk sudah pernah dilihat ATAU stok = 0:
      LEWATI (tidak direkomendasikan)

    // Skor dihitung secara LOKAL per produk (ciri khas Greedy)
    skorKategori = bobotKategori[produk.kategori] atau 0
    skorPopularitas = (unitTerjual × 2) + (rating × jumlahReview)
    skorTotal = skorKategori × 1000 + skorPopularitas

  // LANGKAH 3: GREEDY CHOICE — Ambil N produk dengan skor tertinggi
  URUTKAN semua kandidat BERDASARKAN skorTotal (terbesar ke terkecil)
  KEMBALIKAN hanya `batas` produk teratas (default 4)
```

### 3.2 Mengapa Ini Greedy?

1. **Optimal Lokal**: Setiap produk dinilai berdasarkan skornya **sendiri**, tanpa
   mempertimbangkan kombinasi dengan produk lain.
2. **Tidak Ada Backtracking**: Setelah skor dihitung, tidak ada langkah mundur
   untuk mengevaluasi ulang.
3. **Greedy Choice Property**: Kita langsung mengambil 4 teratas — tidak mencoba
   semua kemungkinan kombinasi 4 produk dari ratusan kandidat.

> Perbandingan: Jika menggunakan **Brute Force**, kita harus mengevaluasi semua
> kemungkinan kombinasi C(n,4) yang bisa mencapai jutaan kombinasi. Greedy cukup
> melakukan **1 kali sort** dan mengambil 4 teratas.

### 3.3 Kode Aktual

**File**: `frontend/lib/product-recommendations.ts`

```typescript
export function buildProductRecommendations(
  products: Product[],
  recentlyViewed: SavedProduct[],
  limit = 4
): ProductRecommendation[] {
  const viewedIds = new Set(recentlyViewed.map((item) => item.id));
  const categoryWeights = new Map<string, number>();

  // LANGKAH 1: Bangun bobot kategori dari riwayat browsing
  recentlyViewed.slice(0, 8).forEach((item, index) => {
    const category = item.category.trim();
    if (!category) return;
    categoryWeights.set(
      category,
      (categoryWeights.get(category) ?? 0) + (8 - index)
    );
  });

  // LANGKAH 2 & 3: Skor lokal + Greedy Choice (sort & slice)
  return products
    .filter((product) => !viewedIds.has(product.id) && product.stock > 0)
    .map((product) => {
      const categoryWeight = categoryWeights.get(product.category) ?? 0;
      const popularityScore =
        (product.sold_units ?? 0) * 2 +
        (product.rating_average ?? 0) *
          Math.min(product.rating_count ?? 0, 10);

      return {
        product,
        score: categoryWeight * 1000 + popularityScore, // Skor lokal
        reason: categoryWeight > 0
          ? `Karena Anda melihat kategori ${product.category}`
          : (product.sold_units ?? 0) > 0
            ? 'Populer di kalangan pembeli'
            : 'Produk baru untuk dijelajahi',
      };
    })
    .sort((a, b) => b.score - a.score)  // Greedy: urutkan terbaik
    .slice(0, limit)                     // Greedy: ambil top-N saja
    .map(({ product, reason }) => ({ product, reason }));
}
```

### 3.4 Cara Menguji / Membuktikan

**Langkah 1** — Buka halaman utama PasarKita (`http://localhost:3000`).

**Langkah 2** — Klik beberapa produk dari **kategori yang sama** (misalnya klik
3 produk "Fashion" berturut-turut).

**Langkah 3** — Kembali ke halaman utama. Lihat bagian **"Rekomendasi Untuk
Anda"** di bawah daftar produk.

**Yang diharapkan:**
- Produk rekomendasi mayoritas berasal dari kategori **Fashion** (karena
  bobotnya paling tinggi).
- Produk yang sudah pernah Anda klik **tidak muncul** di rekomendasi.
- Produk dengan **stok 0 tidak muncul**.
- Jika ada produk Fashion dengan penjualan tinggi, produk tersebut akan muncul
  **lebih atas** dari Fashion dengan penjualan rendah.

**Langkah 4** — Buka Developer Tools (F12) → Console, dan ketik:

```javascript
// Lihat riwayat browsing yang tersimpan di Zustand store
JSON.parse(localStorage.getItem('pk-buyer-prefs'))
```

Anda akan melihat data `recentlyViewed` yang menjadi input algoritma Greedy.

### 3.5 Analisis Kompleksitas

| Operasi | Kompleksitas |
|---|---|
| Bangun bobot kategori | O(k), k = jumlah riwayat (maks 8) |
| Filter produk | O(n), n = jumlah total produk |
| Hitung skor per produk | O(n) |
| Sort berdasarkan skor | O(n log n) |
| Slice top-N | O(1) |
| **Total** | **O(n log n)** |

> Bandingkan: Brute force yang mengevaluasi semua kombinasi C(n,4) memiliki
> kompleksitas O(n⁴) — jauh lebih lambat.

---

## 4. Penerapan B: Sorting Produk Terlaris (Backend)

### 4.1 Pseudocode

```
FUNGSI UrutkanProdukTerlaris(semuaProduk, dataRating, dataPenjualan):

  UNTUK setiap produk di semuaProduk:
    // Skor lokal per produk (Greedy)
    ratingRata = totalRating / jumlahReview
    unitTerjual = totalQtyDibeli
    skorPenjualan = unitTerjual  (jika sort=sold_desc)
    skorRating = ratingRata      (jika sort=rating_desc)

  URUTKAN berdasarkan skor tertinggi ke terendah
  KEMBALIKAN hanya produk di halaman yang diminta (offset..limit)
```

### 4.2 Kode Aktual

**File**: `backend/src/modules/products/product.service.js` (baris 127–194)

```javascript
// GREEDY: Hitung skor tiap produk secara lokal, lalu sort
const rankedProducts = (allProducts || [])
  .map((product) => {
    const rating = ratingTotals.get(product.id);
    return {
      ...product,
      rating_average: rating
        ? Math.round((rating.sum / rating.count) * 10) / 10
        : null,
      rating_count: rating?.count || 0,
      sold_units: soldTotals.get(product.id) || 0,
    };
  })
  .sort((a, b) => {
    // GREEDY CHOICE: Bandingkan skor lokal antar produk
    const primary =
      query.sort === 'rating_desc'
        ? (b.rating_average || 0) - (a.rating_average || 0)
        : b.sold_units - a.sold_units;
    if (primary !== 0) return primary;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

return {
  data: rankedProducts.slice(offset, offset + limit), // Ambil halaman
};
```

### 4.3 Cara Menguji

**Langkah 1** — Buka halaman produk: `http://localhost:3000/products`

**Langkah 2** — Pada dropdown "Urutkan", pilih **"Terlaris"**.

**Yang diharapkan:**
- Produk yang paling banyak terjual muncul paling atas.
- Jika dua produk memiliki jumlah penjualan sama, yang lebih baru muncul lebih
  atas (tie-breaking greedy).

**Langkah 3** — Ganti ke **"Rating Tertinggi"**.

**Yang diharapkan:**
- Produk dengan rating rata-rata tertinggi muncul paling atas.

---

## 5. Penerapan C: Perhitungan Fee Marketplace

### 5.1 Pseudocode

```
FUNGSI HitungFeeGreedy(subtotal):
  fee = BULATKAN(subtotal × 0.02)    // Langsung hitung, tidak optimasi
  total = subtotal + fee
  KEMBALIKAN { subtotal, fee, total }
```

### 5.2 Kode Aktual

**File**: `backend/src/utils/fee.js`

```javascript
const FEE_PERCENTAGE = 0.02;

const calculateFee = (subtotal) => {
  const fee = Math.round(subtotal * FEE_PERCENTAGE);  // Greedy: langsung
  const total = subtotal + fee;
  return { subtotal, fee_marketplace: fee, total, fee_percentage: 2 };
};
```

### 5.3 Mengapa Greedy?

- Keputusan fee diambil **sekali langsung** tanpa mempertimbangkan variasi
  (misal diskon volume, negosiasi, dll.).
- Ini adalah bentuk Greedy paling sederhana: **satu keputusan, satu langkah,
  langsung selesai**.

### 5.4 Cara Menguji

**Langkah 1** — Login sebagai pembeli, tambahkan barang ke keranjang.

**Langkah 2** — Buka halaman Checkout (`/checkout`).

**Yang diharapkan:**
- Terlihat rincian: Subtotal, Fee Marketplace (2%), dan Total.
- Contoh: Subtotal Rp50.000 → Fee Rp1.000 → Total Rp51.000.

**Langkah 3** — Verifikasi via API langsung di browser console:

```javascript
// Hitung fee secara manual untuk verifikasi
const subtotal = 50000;
const fee = Math.round(subtotal * 0.02);
console.log(`Fee: Rp${fee.toLocaleString('id-ID')}`);
// Output: Fee: Rp1.000
```
