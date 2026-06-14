# Algoritma String Matching di PasarKita

## 1. Definisi

**String Matching** adalah algoritma untuk menemukan posisi kemunculan sebuah
**pattern** (pola/kata kunci) di dalam **text** (teks/data yang lebih panjang).

Rumusan masalahnya:
```
Diberikan:
  - text    T  dengan panjang n  (contoh: "Sepatu Running Nike Air Max")
  - pattern P  dengan panjang m  (contoh: "nike")

Pertanyaan:
  Apakah P muncul di dalam T? Di posisi mana?
```

## 2. Dua Jenis Utama String Matching

Dalam teori algoritma, String Matching dibagi menjadi **2 jenis utama**:

### Jenis 1: Exact String Matching (Pencocokan Persis)

Mencari pattern yang **persis sama** (huruf per huruf) di dalam teks. Tidak
boleh ada perbedaan sama sekali (kecuali case-insensitive yang mengabaikan
huruf besar/kecil).

**Contoh:**
```
Text:    "Sepatu Nike Air Max"
Pattern: "nike"
Hasil:   ✅ COCOK (di posisi 7, karena case-insensitive)

Text:    "Sepatu Nyke Air Max"
Pattern: "nike"
Hasil:   ❌ TIDAK COCOK (huruf 'y' ≠ 'i', harus persis)
```

**Algoritma yang termasuk Exact Matching:**
| Algoritma | Cara Kerja | Kompleksitas |
|---|---|---|
| **Naive (Brute Force)** | Geser pattern 1 posisi, bandingkan semua karakter | O(n × m) |
| **KMP (Knuth-Morris-Pratt)** | Pra-proses pattern untuk menghindari perbandingan ulang | O(n + m) |
| **Boyer-Moore** | Mulai pencocokan dari kanan, lompati karakter yang tidak cocok | O(n/m) best case |
| **Rabin-Karp** | Gunakan hashing untuk mempercepat perbandingan | O(n + m) average |

### Jenis 2: Approximate String Matching (Pencocokan Mirip / Fuzzy)

Mencari pattern yang **mirip tapi tidak harus persis** di dalam teks. Boleh
ada sejumlah perbedaan (salah ketik, huruf hilang, huruf tertukar).

**Contoh:**
```
Text:    "Sepatu Nike Air Max"
Pattern: "nke"  (huruf 'i' hilang)
Hasil:   ✅ COCOK (mirip dengan "nike", jarak edit = 1)

Text:    "Sepatu Nike Air Max"
Pattern: "niek"  (huruf 'e' dan 'k' tertukar)
Hasil:   ✅ COCOK (mirip dengan "nike", jarak edit = 1)
```

**Algoritma yang termasuk Approximate Matching:**
| Algoritma | Cara Kerja |
|---|---|
| **Levenshtein Distance** | Hitung jumlah operasi (insert, delete, replace) untuk mengubah satu string menjadi string lain |
| **Hamming Distance** | Hitung jumlah posisi di mana karakter berbeda (hanya untuk string yang sama panjang) |
| **Fuzzy Search (Fuse.js, dsb.)** | Library yang mengkombinasikan berbagai metrik kemiripan |

### ⭐ PasarKita Menggunakan: Exact String Matching — KMP (Jenis 1)

```
┌─────────────────────────────────────────────────────────┐
│                  STRING MATCHING                        │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Jenis 1: EXACT      │  │  Jenis 2: APPROXIMATE    │ │
│  │  (Pencocokan Persis)  │  │  (Pencocokan Mirip)      │ │
│  │                      │  │                          │ │
│  │  • Naive             │  │  • Levenshtein Distance  │ │
│  │  • KMP    ◄── ✅     │  │  • Hamming Distance      │ │
│  │  • Boyer-Moore       │  │  • Fuzzy Search          │ │
│  │  • Rabin-Karp        │  │                          │ │
│  │                      │  │                          │ │
│  │  PasarKita memakai   │  │  PasarKita TIDAK         │ │
│  │  KMP                 │  │  menggunakan jenis ini   │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Mengapa PasarKita memilih KMP, bukan Boyer-Moore?**

| Aspek | KMP | Boyer-Moore |
|---|---|---|
| Kompleksitas | O(n + m) — konsisten | O(n/m) best, O(n × m) worst |
| Arah pencocokan | Kiri → kanan (natural) | Kanan → kiri (terbalik) |
| Preprocessing | Hanya 1 tabel (prefix) | 2 tabel (bad char + good suffix) |
| Implementasi | Lebih sederhana | Lebih kompleks |
| Cocok untuk | Teks pendek (nama produk) | Teks panjang (dokumen) |

**Alasan memilih KMP:**
1. **Efisien**: O(n + m) — lebih cepat dari Naive O(n × m) karena tidak
   pernah mundur di text (tidak ada backtracking).
2. **Konsisten**: Worst case tetap O(n + m), sedangkan Boyer-Moore bisa
   jatuh ke O(n × m) pada kasus terburuk.
3. **Sederhana**: Hanya butuh 1 tabel preprocessing (prefix table), lebih
   mudah diimplementasikan dan dipahami.
4. **Cocok untuk marketplace**: Nama produk umumnya pendek (< 100 karakter),
   sehingga keunggulan Boyer-Moore pada teks panjang tidak terasa.

**Implementasi KMP di PasarKita:**
- File utility: `backend/src/utils/kmp-search.js`
- Digunakan di: `backend/src/modules/products/product.service.js`

Variasi Exact Matching yang digunakan di PasarKita:

| Variasi | Penjelasan | Contoh |
|---|---|---|
| **Substring Matching** | Mencari apakah pattern muncul di posisi manapun | `"nike"` ditemukan dalam `"Sepatu Nike Air"` |
| **Case-Insensitive** | Tidak peduli huruf besar/kecil | `"NIKE"` = `"nike"` = `"Nike"` |

---

## 3. Penerapan di PasarKita

String Matching digunakan di **3 tempat utama**:

| # | Fitur | File | Metode |
|---|---|---|---|
| A | Pencarian Produk (Pembeli) | `backend/src/utils/kmp-search.js` | KMP (Case-Insensitive) |
| B | Pencarian Produk (Penjual) | `backend/src/utils/kmp-search.js` | KMP (Case-Insensitive) |
| C | Pencarian Pesanan (Penjual) | `backend/src/modules/orders/order.service.js` | OR-ILIKE (Multi-field Matching) |

---

## 4. Penerapan A: Pencarian Produk Pembeli (Utama)

### 4.1 Alur Algoritma KMP (Pseudocode)

KMP terdiri dari 2 langkah utama: **preprocessing** (bangun tabel prefix)
dan **pencarian** (gunakan tabel untuk menghindari backtracking).

```
FUNGSI KMP_Search(text, pattern):

  // ═══ STEP 1: PREPROCESSING — Bangun Tabel Prefix ═══
  // Tabel ini menyimpan: "jika terjadi mismatch di posisi j,
  // loncat ke posisi berapa di pattern?"
  
  prefixTable = array berukuran PANJANG(pattern), isi semua 0
  length = 0    // panjang prefix-suffix terpanjang
  i = 1

  SELAMA i < PANJANG(pattern):
    JIKA pattern[i] == pattern[length]:
      length = length + 1
      prefixTable[i] = length
      i = i + 1
    SELAIN ITU:
      JIKA length ≠ 0:
        length = prefixTable[length - 1]    // Jangan naikkan i!
      SELAIN ITU:
        prefixTable[i] = 0
        i = i + 1

  // ═══ STEP 2: PENCARIAN KMP ═══
  i = 0    // index di text
  j = 0    // index di pattern

  SELAMA i < PANJANG(text):
    JIKA text[i] == pattern[j]:
      i = i + 1
      j = j + 1

    JIKA j == PANJANG(pattern):
      KEMBALIKAN TRUE    // Pattern ditemukan!

    SELAIN JIKA i < PANJANG(text) DAN text[i] ≠ pattern[j]:
      JIKA j ≠ 0:
        j = prefixTable[j - 1]    // ← KUNCI KMP: loncat, bukan mulai ulang
      SELAIN ITU:
        i = i + 1

  KEMBALIKAN FALSE    // Pattern tidak ditemukan
```

### 4.2 Ilustrasi Proses KMP vs Naive

**Contoh**: Mencari pattern `"abab"` di text `"abacababc"`

**Naive (Brute Force) — mundur setiap gagal:**
```
text:    a b a c a b a b c
         a b a b             ← gagal di posisi 3, mundur ke awal
           a b a b           ← mulai ulang dari posisi 1
             a b a b         ← mulai ulang dari posisi 2
               a b a b       ← gagal
                 a b a b     ← COCOK di posisi 4
Total perbandingan: ~15 kali
```

**KMP — tidak pernah mundur di text:**
```
Tabel Prefix untuk "abab": [0, 0, 1, 2]

text:    a b a c a b a b c
         a b a b             ← gagal di j=3, tabel prefix[2]=1, loncat j=1
         . . a b a b         ← gagal di j=1, tabel prefix[0]=0, loncat j=0
         . . . . a b a b     ← COCOK!
               ↑
Index i terus maju, TIDAK PERNAH mundur
Total perbandingan: ~10 kali
```

**Inti perbedaan KMP:** Saat terjadi mismatch, Naive mundur ke awal text,
sedangkan KMP menggunakan tabel prefix untuk **melompat langsung** ke posisi
yang sudah pasti cocok, tanpa mengulangi perbandingan.

### 4.3 Kode Aktual

**File utama KMP**: `backend/src/utils/kmp-search.js`

```javascript
// STEP 1: Preprocessing — Bangun tabel prefix
function buildPrefixTable(pattern) {
  const table = new Array(pattern.length).fill(0);
  let length = 0;
  let i = 1;

  while (i < pattern.length) {
    if (pattern[i] === pattern[length]) {
      length++;
      table[i] = length;
      i++;
    } else {
      if (length !== 0) {
        length = table[length - 1]; // Loncat, jangan reset
      } else {
        table[i] = 0;
        i++;
      }
    }
  }
  return table;
}

// STEP 2: Pencarian KMP (case-insensitive)
function kmpSearch(text, pattern) {
  if (!pattern || pattern.length === 0) return true;
  if (!text || text.length === 0) return false;

  const t = text.toLowerCase();
  const p = pattern.toLowerCase();
  const prefixTable = buildPrefixTable(p);

  let i = 0, j = 0;
  while (i < t.length) {
    if (t[i] === p[j]) {
      i++;
      j++;
    }
    if (j === p.length) {
      return true; // COCOK!
    } else if (i < t.length && t[i] !== p[j]) {
      if (j !== 0) {
        j = prefixTable[j - 1]; // ← KUNCI KMP
      } else {
        i++;
      }
    }
  }
  return false;
}
```

**Dipanggil di**: `backend/src/modules/products/product.service.js`

```javascript
const { kmpFilterProducts } = require('../../utils/kmp-search');

// Saat sorting terlaris/rating, data di-load ke memori
// KMP STRING MATCHING: Filter produk menggunakan KMP
allProducts = query.search
  ? kmpFilterProducts(data || [], query.search, 'name')
  : (data || []);
```

### 3.4 Cara Menguji / Membuktikan

**Langkah 1** — Buka halaman produk: `http://localhost:3000/products`

**Langkah 2** — Ketik di kotak pencarian: `sepatu`

**Yang diharapkan:**
- Hanya produk yang mengandung kata **"sepatu"** di namanya yang muncul.
- Pencarian bersifat **case-insensitive**: mengetik `SEPATU`, `Sepatu`, atau
  `sepatu` menghasilkan hasil yang sama.
- Produk bernama "Sepatu Running" dan "Sepatu Casual" muncul.
- Produk bernama "Tas Kulit" **tidak muncul** (tidak mengandung "sepatu").

**Langkah 3** — Ketik keyword parsial: `sep`

**Yang diharapkan:**
- Produk "Sepatu Running" tetap muncul karena "sep" adalah substring dari
  "Sepatu".
- Ini membuktikan bahwa kita menggunakan **substring matching**, bukan exact
  matching.

**Langkah 4** — Verifikasi melalui backend API secara langsung:

```bash
# Buka terminal lalu jalankan (ganti token sesuai login Anda):
curl "http://localhost:3001/api/products?search=nike" | jq '.data[] | .name'
```

Output yang diharapkan: Hanya nama-nama produk yang mengandung "nike".

**Langkah 5** — Kosongkan kotak pencarian.

**Yang diharapkan:**
- Semua produk kembali ditampilkan (tidak ada filter string matching).

---

## 5. Penerapan B: Pencarian Produk Penjual

### 4.1 Kode Aktual

**File**: `backend/src/modules/products/product.service.js` (baris 356-358)

```javascript
// String Matching: Pencarian produk milik penjual
if (query.search?.trim()) {
  dbQuery = dbQuery.ilike('name', `%${query.search.trim()}%`);
}
```

**Perbedaan dengan Pencarian Pembeli:**
- Scope pencarian **hanya produk milik penjual yang login** (ada filter
  `seller_id`).
- Ditambahkan `.trim()` untuk menghapus spasi di awal dan akhir keyword.

### 4.2 Cara Menguji

**Langkah 1** — Login sebagai penjual, buka: `http://localhost:3000/seller/products`

**Langkah 2** — Ketik nama produk di kotak pencarian.

**Yang diharapkan:**
- Hanya produk milik toko Anda yang cocok dengan keyword yang muncul.

---

## 6. Penerapan C: Pencarian Pesanan (Multi-field Matching)

### 5.1 Pseudocode

```
FUNGSI CariPesanan(semuaPesanan, keyword):
  pattern = "%" + keyword + "%"

  // Multi-field String Matching:
  // Cek keyword di BEBERAPA kolom sekaligus
  hasilCocok = []
  UNTUK setiap pesanan di semuaPesanan:
    JIKA COCOK(pesanan.order_id, pattern)
      ATAU COCOK(pesanan.nama_produk, pattern)
      ATAU COCOK(pesanan.transaction_id, pattern)
      ATAU COCOK(pesanan.tracking_id, pattern):
        TAMBAHKAN pesanan ke hasilCocok

  KEMBALIKAN hasilCocok
```

### 5.2 Cara Menguji

**Langkah 1** — Login sebagai penjual, buka: `http://localhost:3000/seller/orders`

**Langkah 2** — Coba ketik bagian dari Order ID (misalnya 8 karakter pertama).

**Yang diharapkan:**
- Pesanan dengan ID yang mengandung keyword tersebut muncul.

**Langkah 3** — Coba ketik nama produk yang ada di pesanan.

**Yang diharapkan:**
- Pesanan yang berisi produk dengan nama tersebut muncul.
- Ini membuktikan **multi-field string matching** — satu keyword dicari di
  beberapa kolom sekaligus.

---

## 7. Analisis Kompleksitas

### KMP String Matching (yang dipakai PasarKita)

| Variabel | Keterangan |
|---|---|
| n | Panjang teks (nama produk) |
| m | Panjang pattern (keyword pencarian) |
| N | Jumlah total produk di database |

| Operasi | Kompleksitas |
|---|---|
| Preprocessing (tabel prefix) | O(m) |
| Matching 1 produk | O(n + m) |
| Matching semua produk | O(N × (n + m)) |

### Perbandingan KMP vs Boyer-Moore vs Naive

| Algoritma | Preprocessing | Matching | Dipakai di PasarKita? |
|---|---|---|---|
| Naive (Brute Force) | Tidak ada | O(n × m) | ❌ Terlalu lambat |
| **KMP** | **O(m)** | **O(n + m)** | **✅ Ya** |
| Boyer-Moore | O(m + σ) | O(n/m) best, O(n × m) worst | ❌ Terlalu kompleks |
| Rabin-Karp | O(m) | O(n + m) avg | ❌ Tidak diperlukan |

> **Mengapa KMP?** KMP memberikan performa yang **konsisten** O(n + m) di semua
> kasus (best, average, worst). Berbeda dengan Boyer-Moore yang bisa jatuh ke
> O(n × m) pada worst case, dan Naive yang selalu O(n × m). Untuk nama produk
> yang pendek (< 100 karakter), overhead preprocessing KMP O(m) sangat minimal.

---

## 8. Diagram Alur Pencarian

```
┌─────────────────────┐
│  User mengetik       │
│  "nike" di search    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Frontend mengirim   │
│  GET /api/products   │
│  ?search=nike        │
│  &sort=sold_desc     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Backend: ILIKE      │
│  pre-filter di DB    │
│  (mengurangi data)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────┐
│  KMP String Matching         │
│                              │
│  1. buildPrefixTable("nike") │
│     → [0, 0, 0, 0]          │
│                              │
│  2. kmpSearch(produk, "nike") │
│     → Cocok / Tidak          │
│                              │
│  Dijalankan untuk setiap     │
│  produk di memori            │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────┐
│  Hasil: hanya produk│
│  yang mengandung     │
│  "nike" dikembalikan │
└─────────────────────┘
```
