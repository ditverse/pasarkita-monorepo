'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { queryKeys } from '@/lib/query-keys';
import { buildProductRecommendations } from '@/lib/product-recommendations';
import { useBuyerPreferencesStore } from '@/store/buyer-preferences';
import { Product } from '@/types/api';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];
const POPULAR_TAGS = ['Fashion Pria', 'Snack', 'Handphone', 'Sepatu'];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const recentlyViewed = useBuyerPreferencesStore((state) => state.recentlyViewed);

  const debouncedSearch = useDebounce(searchQuery, 400);

  const { data: products = [], isLoading: loading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.products.home(debouncedSearch),
    queryFn: async (): Promise<Product[]> => {
      const res = await productsApi.getAll({
        limit: 50,
        search: debouncedSearch.trim() || undefined,
      });
      return res.data.data ?? [];
    },
  });

  const recommendationQuery = useQuery({
    queryKey: ['products', 'recommendations', recentlyViewed.map((item) => item.id).join(',')],
    queryFn: async (): Promise<Product[]> => {
      const response = await productsApi.getAll({ limit: 50, sort: 'sold_desc', in_stock: true });
      return response.data.data ?? [];
    },
    enabled: recentlyViewed.length > 0,
  });

  const recommendations = buildProductRecommendations(
    recommendationQuery.data ?? [],
    recentlyViewed
  );

  // Client-side filtering for category
  const filteredProducts = activeCategory === 'Semua' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  // Handle category click
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
  };

  // Handle popular tag click — fill search bar and trigger search
  const handlePopularClick = (tag: string) => {
    setSearchQuery(tag);
  };

  // Handle search submit (button click or Enter)
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '72px 80px 48px', textAlign: 'center', background: '#fff' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid var(--pk-border)',
            borderRadius: 999,
            fontSize: 12,
            color: 'var(--pk-text-secondary)',
            marginBottom: 20,
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pk-success)', display: 'inline-block' }}
          />
          12.480 UMKM sedang berjualan
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 860,
            marginInline: 'auto',
          }}
        >
          Belanja dari <span style={{ color: 'var(--pk-text-secondary)' }}>UMKM Indonesia</span>,
          <br />semudah chat teman.
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'var(--pk-text-secondary)',
            marginTop: 16,
            maxWidth: 560,
            marginInline: 'auto',
            lineHeight: 1.55,
          }}
        >
          Produk asli dari ribuan pelaku usaha kecil. Transaksi aman lewat SmartBank, dikirim langsung ke pintu Anda.
        </p>
        <div
          style={{
            maxWidth: 620,
            marginInline: 'auto',
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid var(--pk-border)',
            borderRadius: 999,
            padding: '6px 6px 6px 18px',
            boxShadow: 'var(--pk-shadow-sm)',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <Icon name="search" size={18} style={{ color: 'var(--pk-text-hint)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari produk impianmu..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
              padding: '12px 0',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--pk-text-hint)',
                display: 'flex',
              }}
            >
              <Icon name="x" size={16} />
            </button>
          )}
          <button
            className="pk-btn pk-btn-primary"
            style={{ borderRadius: 999, height: 40 }}
            onClick={handleSearchSubmit}
          >
            Cari
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginTop: 20,
            fontSize: 12,
            color: 'var(--pk-text-hint)',
          }}
        >
          <span>Populer:</span>
          {POPULAR_TAGS.map((t) => (
            <a
              key={t}
              onClick={() => handlePopularClick(t)}
              style={{
                color: 'var(--pk-text-secondary)',
                cursor: 'pointer',
                transition: 'color 150ms ease',
                textDecoration: searchQuery === t ? 'underline' : 'none',
                fontWeight: searchQuery === t ? 600 : 400,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--pk-accent)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--pk-text-secondary)'; }}
            >
              {t}
            </a>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '0 80px 40px' }}>
        <div
          className="pk-scroll"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}
        >
          {['Semua', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => handleCategoryClick(c)}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid ' + (activeCategory === c ? 'var(--pk-text)' : 'var(--pk-border)'),
                background: activeCategory === c ? 'var(--pk-text)' : '#fff',
                color: activeCategory === c ? '#fff' : 'var(--pk-text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 150ms ease',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {recentlyViewed.length > 0 && (
        <section style={{ padding: '0 80px 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                Rekomendasi dari Riwayat Anda
              </h2>
              <p style={{ fontSize: 13, color: 'var(--pk-text-hint)', margin: '5px 0 0' }}>
                Berdasarkan kategori yang baru dilihat, lalu diurutkan dengan data penjualan dan rating.
              </p>
            </div>
            <Link href="/products?sort=sold_desc" style={{ fontSize: 13, color: 'var(--pk-accent)', whiteSpace: 'nowrap' }}>
              Lihat produk populer →
            </Link>
          </div>

          {recommendationQuery.isLoading ? (
            <div className="pk-product-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="pk-card" style={{ overflow: 'hidden' }}>
                  <div className="pk-skel" style={{ height: 170 }} />
                  <div style={{ padding: 14 }}>
                    <div className="pk-skel" style={{ height: 16, width: '78%', marginBottom: 10 }} />
                    <div className="pk-skel" style={{ height: 13, width: '55%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recommendationQuery.isError ? (
            <div style={{ padding: 20, border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-secondary)', fontSize: 13 }}>
              Rekomendasi belum dapat dimuat. Katalog utama tetap tersedia di bawah.
            </div>
          ) : recommendations.length > 0 ? (
            <div className="pk-product-grid">
              {recommendations.map(({ product, reason }) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="pk-card pk-card-hover"
                  style={{ overflow: 'hidden', textDecoration: 'none' }}
                >
                  <ProductImage src={product.image_url} alt={product.name} height={170} style={{ borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ color: 'var(--pk-accent)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                      {reason}
                    </div>
                    <div style={{ color: 'var(--pk-text)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.name}
                    </div>
                    <div style={{ color: 'var(--pk-text-hint)', fontSize: 12, marginTop: 3 }}>
                      {product.seller?.name || 'Toko Anonim'}
                    </div>
                    <div style={{ color: 'var(--pk-text)', fontSize: 15, fontWeight: 700, marginTop: 9 }}>
                      {formatIDR(product.price)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ padding: 20, border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-secondary)', fontSize: 13 }}>
              Belum ada produk lain yang cocok dengan riwayat Anda.
            </div>
          )}
        </section>
      )}

      {/* Product grid */}
      <section style={{ padding: '0 80px 64px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
            {activeCategory !== 'Semua' ? activeCategory : (debouncedSearch ? `Hasil pencarian "${debouncedSearch}"` : 'Pilihan untuk Anda')}
          </h2>
          <Link href="/products" style={{ fontSize: 13, color: 'var(--pk-accent)' }}>
            Lihat semua →
          </Link>
        </div>
        
        {isError ? (
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
            <p style={{ color: 'var(--pk-text-secondary)', fontWeight: 500, marginBottom: 4 }}>
              Produk gagal dimuat
            </p>
            <p style={{ color: 'var(--pk-text-hint)', fontSize: 13 }}>
              Periksa koneksi backend dan konfigurasi API.
            </p>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Mencoba lagi...' : 'Coba Lagi'}
            </button>
          </div>
        ) : loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pk-card" style={{ overflow: 'hidden' }}>
                <div className="pk-skel" style={{ height: 200 }} />
                <div style={{ padding: 14 }}>
                  <div className="pk-skel" style={{ height: 16, width: '80%', marginBottom: 8 }} />
                  <div className="pk-skel" style={{ height: 12, width: '50%', marginBottom: 12 }} />
                  <div className="pk-skel" style={{ height: 18, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
            }}
          >
            {filteredProducts.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="pk-card pk-card-hover" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    height={200}
                    style={{ borderRadius: 0 }}
                  />
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--pk-text)',
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 10 }}>
                      {p.seller?.name || 'Toko Anonim'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--pk-text)' }}>
                        {formatIDR(p.price)}
                      </div>
                      {p.stock <= 5 && (
                        <span className="pk-badge pk-badge-neutral" style={{ fontSize: 11 }}>
                          Sisa {p.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'var(--pk-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--pk-text-hint)',
                marginInline: 'auto',
                marginBottom: 16,
              }}
            >
              <Icon name="search" size={24} />
            </div>
            <p style={{ color: 'var(--pk-text-secondary)', fontWeight: 500, marginBottom: 4 }}>
              Tidak ada produk ditemukan
            </p>
            <p style={{ color: 'var(--pk-text-hint)', fontSize: 13 }}>
              {debouncedSearch
                ? `Tidak ditemukan produk untuk "${debouncedSearch}"`
                : 'Belum ada produk dari database.'}
            </p>
            {(debouncedSearch || activeCategory !== 'Semua') && (
              <button
                className="pk-btn pk-btn-primary pk-btn-sm"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('Semua');
                }}
              >
                Reset Pencarian
              </button>
            )}
          </div>
        )}
      </section>

      {/* CTA banner */}
      <section style={{ padding: '0 80px 80px' }}>
        <div
          style={{
            background: 'var(--pk-text)',
            color: '#fff',
            borderRadius: 16,
            padding: '48px 56px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 40,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Untuk Seller
            </div>
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                maxWidth: 520,
              }}
            >
              Punya usaha? Mulai jual di PasarKita dalam 5 menit.
            </h3>
            <p
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                marginTop: 12,
                maxWidth: 520,
              }}
            >
              Gratis biaya langganan. Hanya 2% fee per transaksi. Dapat pelanggan dari seluruh Indonesia.
            </p>
          </div>
          <Link href="/seller/products" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: '#fff',
                color: 'var(--pk-text)',
                border: 'none',
                borderRadius: 8,
                padding: '0 22px',
                height: 48,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Mulai Berjualan →
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
