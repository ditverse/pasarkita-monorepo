'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Product } from '@/types/api';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

export default function BrowseProductsPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceMax, setPriceMax] = useState(15000000);
  const [sort, setSort] = useState('relevant');

  const debouncedSearch = useDebounce(searchQuery, 400);

  const productsQuery = useQuery({
    queryKey: ['products', 'browse', sort, debouncedSearch],
    queryFn: async (): Promise<Product[]> => {
      const params: { limit: number; sort?: string; search?: string } = { limit: 100 };
      if (sort === 'high') params.sort = 'price_desc';
      if (sort === 'low') params.sort = 'price_asc';
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await productsApi.getAll(params);
      return res.data.data ?? [];
    },
  });

  // Client-side filtering for category + price (multi-category not supported by backend)
  const filtered = useMemo(() => {
    return (productsQuery.data ?? []).filter(
      (p) => 
        (selectedCategories.length === 0 || selectedCategories.includes(p.category)) && 
        p.price <= priceMax
    );
  }, [productsQuery.data, selectedCategories, priceMax]);

  const toggleCategory = (c: string) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  return (
    <div style={{ display: 'flex', padding: '24px 80px', gap: 32 }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--pk-text-hint)',
            marginBottom: 12,
          }}
        >
          Kategori
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {CATEGORIES.map((c) => (
            <label
              key={c}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                cursor: 'pointer',
                color: 'var(--pk-text)',
              }}
            >
              <span
                onClick={() => toggleCategory(c)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid ' + (selectedCategories.includes(c) ? 'var(--pk-text)' : 'var(--pk-border-strong)'),
                  background: selectedCategories.includes(c) ? 'var(--pk-text)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 150ms ease',
                }}
              >
                {selectedCategories.includes(c) && (
                  <Icon name="check" size={12} style={{ color: '#fff' }} stroke={3} />
                )}
              </span>
              {c}
            </label>
          ))}
        </div>

        {/* Active category tags */}
        {selectedCategories.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {selectedCategories.map((c) => (
                <span
                  key={c}
                  onClick={() => toggleCategory(c)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                    background: 'var(--pk-accent-soft)',
                    color: 'var(--pk-accent)',
                    cursor: 'pointer',
                    transition: 'opacity 150ms ease',
                  }}
                >
                  {c}
                  <Icon name="x" size={12} stroke={2.5} />
                </span>
              ))}
            </div>
            <button
              onClick={() => setSelectedCategories([])}
              style={{
                fontSize: 12,
                color: 'var(--pk-text-hint)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Hapus semua filter
            </button>
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--pk-text-hint)',
            marginBottom: 12,
          }}
        >
          Harga Maks.
        </div>
        <div style={{ marginBottom: 28 }}>
          <input
            type="range"
            min="0"
            max="15000000"
            step="100000"
            value={priceMax}
            onChange={(e) => setPriceMax(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--pk-text)' }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--pk-text-secondary)',
              marginTop: 6,
            }}
          >
            <span>Rp 0</span>
            <span style={{ fontWeight: 500, color: 'var(--pk-text)' }}>{formatIDR(priceMax)}</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--pk-text-hint)',
            marginBottom: 12,
          }}
        >
          Urutkan
        </div>
        <select
          className="pk-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="relevant">Paling relevan (Terbaru)</option>
          <option value="low">Harga terendah</option>
          <option value="high">Harga tertinggi</option>
        </select>
      </aside>

      {/* Main */}
      <main style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 16px',
            border: '1px solid var(--pk-border)',
            borderRadius: 8,
            height: 44,
            marginBottom: 20,
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <Icon name="search" size={16} style={{ color: 'var(--pk-text-hint)' }} />
          <input
            placeholder="Cari nama produk, brand, atau kategori e.g. Kopi, Tas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 14,
              background: 'transparent',
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
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* Debounce indicator removed as requested */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--pk-text-secondary)' }}>
            Menampilkan{' '}
            <span style={{ color: 'var(--pk-text)', fontWeight: 500 }}>{filtered.length}</span> produk 
            {productsQuery.isLoading && ' (memuat data...)'}
            {selectedCategories.length > 0 && ` · Kategori: ${selectedCategories.join(', ')}`}
          </div>
        </div>

        {productsQuery.isError ? (
          <div
            style={{
              padding: '64px 24px',
              textAlign: 'center',
              border: '1px dashed var(--pk-border)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              Produk gagal dimuat
            </div>
            <div style={{ fontSize: 14, color: 'var(--pk-text-secondary)' }}>
              Periksa koneksi backend dan nilai NEXT_PUBLIC_API_URL.
            </div>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void productsQuery.refetch()} disabled={productsQuery.isFetching} style={{ marginTop: 16 }}>
              {productsQuery.isFetching ? 'Mencoba lagi...' : 'Coba Lagi'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              textAlign: 'center',
              border: '1px dashed var(--pk-border)',
              borderRadius: 12,
            }}
          >
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
                marginBottom: 16,
              }}
            >
              <Icon name="search" size={24} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {productsQuery.isLoading ? 'Sistem sedang memuat data...' : 'Tidak ada produk ditemukan'}
            </div>
            {!productsQuery.isLoading && (
              <>
                <div style={{ fontSize: 14, color: 'var(--pk-text-secondary)', maxWidth: 380, marginBottom: 20 }}>
                  Coba perlebar batas harga maksimal, hapus kata kunci, atau pilih kategori lain.
                </div>
                <button
                  className="pk-btn pk-btn-primary pk-btn-sm"
                  onClick={() => {
                    setSelectedCategories([]);
                    setPriceMax(15000000);
                    setSearchQuery('');
                  }}
                >
                  Reset Filter
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {filtered.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                <div className="pk-card pk-card-hover" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    height={160}
                    style={{ borderRadius: 0 }}
                  />
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
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
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--pk-text)' }}>
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
        )}

        {/* Pagination Dummy UX */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            marginTop: 40,
          }}
        >
          <button className="pk-btn pk-btn-secondary pk-btn-sm">
            <Icon name="chevronLeft" size={14} />
          </button>
          {[1].map((n) => (
            <button
              key={n}
              className="pk-btn pk-btn-sm"
              style={{
                minWidth: 32,
                padding: 0,
                background: n === 1 ? 'var(--pk-text)' : 'transparent',
                color: n === 1 ? '#fff' : 'var(--pk-text)',
                border: n === 1 ? 'none' : '1px solid transparent',
              }}
            >
              {n}
            </button>
          ))}
          <button className="pk-btn pk-btn-secondary pk-btn-sm">
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </main>
    </div>
  );
}
