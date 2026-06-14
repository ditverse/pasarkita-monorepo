'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import WishlistButton from '@/components/pk/wishlist-button';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Product } from '@/types/api';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];
const PAGE_SIZE = 12;

function BrowseProductsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const restoredScroll = useRef(false);
  const debouncedSearch = useDebounce(searchInput, 400);

  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') ?? 'created_desc';
  const minPrice = Math.max(0, Number(searchParams.get('min_price') ?? 0) || 0);
  const maxPrice = Math.max(0, Number(searchParams.get('max_price') ?? 15000000) || 15000000);
  const inStock = searchParams.get('in_stock') !== 'false';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const updateParams = (updates: Record<string, string | null>, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    const url = `${pathname}${params.size ? `?${params.toString()}` : ''}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? '';
    if (currentSearch === debouncedSearch.trim()) return;
    updateParams({ search: debouncedSearch.trim() || null, page: null }, true);
    // updateParams intentionally derives from the current URL snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const productsQuery = useQuery({
    queryKey: ['products', 'browse', debouncedSearch, category, sort, minPrice, maxPrice, inStock, page],
    queryFn: async () => {
      const response = await productsApi.getAll({
        search: debouncedSearch.trim() || undefined,
        category: category || undefined,
        sort,
        min_price: minPrice || undefined,
        max_price: maxPrice || undefined,
        in_stock: inStock,
        page,
        limit: PAGE_SIZE,
      });
      return {
        products: response.data.data ?? [],
        pagination: response.data.pagination,
      };
    },
    placeholderData: (previous) => previous,
  });

  const products: Product[] = productsQuery.data?.products ?? [];
  const pagination = productsQuery.data?.pagination ?? {
    page,
    limit: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  };
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(pagination.total_pages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [page, pagination.total_pages]);
  const hasFilters = Boolean(debouncedSearch || category || minPrice || maxPrice !== 15000000 || !inStock || sort !== 'created_desc');
  const scrollStorageKey = `pk-catalog-scroll:${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (restoredScroll.current || productsQuery.isLoading) return;
    const savedScroll = window.sessionStorage.getItem(scrollStorageKey);
    if (savedScroll) {
      requestAnimationFrame(() => window.scrollTo({ top: Number(savedScroll), behavior: 'auto' }));
    }
    restoredScroll.current = true;
  }, [productsQuery.isLoading, scrollStorageKey]);

  const resetFilters = () => {
    setSearchInput('');
    router.push(pathname, { scroll: false });
  };

  return (
    <div className="pk-catalog-layout" style={{ display: 'flex', padding: '24px clamp(16px, 6vw, 80px)', gap: 32, alignItems: 'flex-start' }}>
      <aside className="pk-catalog-sidebar" style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pk-text-hint)', marginBottom: 12 }}>
          Kategori
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => updateParams({ category: category === item ? null : item, page: null })}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: 0,
                textAlign: 'left',
                background: category === item ? 'var(--pk-bg-subtle)' : 'transparent',
                color: category === item ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                fontSize: 13,
                fontWeight: category === item ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pk-text-hint)', marginBottom: 12 }}>
          Rentang Harga
        </div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          <input
            className="pk-input"
            type="number"
            min={0}
            value={minPrice}
            aria-label="Harga minimum"
            onChange={(event) => updateParams({ min_price: event.target.value === '0' ? null : event.target.value, page: null }, true)}
            placeholder="Harga minimum"
          />
          <input
            className="pk-input"
            type="number"
            min={0}
            value={maxPrice}
            aria-label="Harga maksimum"
            onChange={(event) => updateParams({ max_price: event.target.value === '15000000' ? null : event.target.value, page: null }, true)}
            placeholder="Harga maksimum"
          />
          <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>
            {formatIDR(minPrice)} - {formatIDR(maxPrice)}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 24 }}>
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) => updateParams({ in_stock: event.target.checked ? null : 'false', page: null })}
          />
          Hanya stok tersedia
        </label>

        <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pk-text-hint)', marginBottom: 12 }}>
          Urutkan
        </div>
        <select className="pk-select" value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'created_desc' ? null : event.target.value, page: null })}>
          <option value="created_desc">Terbaru</option>
          <option value="price_asc">Harga terendah</option>
          <option value="price_desc">Harga tertinggi</option>
          <option value="rating_desc">Rating tertinggi</option>
          <option value="sold_desc">Paling banyak terjual</option>
        </select>

        {hasFilters && (
          <button type="button" className="pk-btn pk-btn-secondary pk-btn-block pk-btn-sm" onClick={resetFilters} style={{ marginTop: 16 }}>
            Reset Semua Filter
          </button>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', border: '1px solid var(--pk-border)', borderRadius: 8, height: 44, marginBottom: 20 }}>
          <Icon name="search" size={16} style={{ color: 'var(--pk-text-hint)' }} />
          <input
            placeholder="Cari nama produk..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput('')} aria-label="Hapus pencarian" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--pk-text-hint)' }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--pk-text-secondary)' }}>
            {productsQuery.isFetching ? 'Memperbarui hasil...' : `${pagination.total} produk ditemukan`}
            {category && ` · ${category}`}
          </div>
          {pagination.total > 0 && (
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
              Halaman {page} dari {pagination.total_pages}
            </div>
          )}
        </div>

        {productsQuery.isError ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Produk gagal dimuat</div>
            <div style={{ fontSize: 14, color: 'var(--pk-text-secondary)' }}>Periksa koneksi lalu coba kembali.</div>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void productsQuery.refetch()} style={{ marginTop: 16 }}>
              Coba Lagi
            </button>
          </div>
        ) : productsQuery.isLoading ? (
          <div className="pk-product-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="pk-card" style={{ overflow: 'hidden' }}>
                <div className="pk-skel" style={{ height: 160 }} />
                <div style={{ padding: 14 }}><div className="pk-skel" style={{ height: 16 }} /></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
            <Icon name="search" size={24} style={{ color: 'var(--pk-text-hint)' }} />
            <h2 style={{ fontSize: 16 }}>Tidak ada produk ditemukan</h2>
            <p style={{ color: 'var(--pk-text-secondary)', fontSize: 14 }}>Ubah kata kunci atau rentang harga Anda.</p>
            <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={resetFilters}>Reset Filter</button>
          </div>
        ) : (
          <div className="pk-product-grid">
            {products.map((product) => (
              <div key={product.id} className="pk-card pk-card-hover" style={{ overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                    <WishlistButton product={product} compact />
                  </div>
                <Link
                  href={`/products/${product.id}`}
                  onClick={() => window.sessionStorage.setItem(scrollStorageKey, String(window.scrollY))}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <ProductImage src={product.image_url} alt={product.name} height={160} style={{ borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--pk-text)' }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 10 }}>{product.seller?.name || 'Toko Anonim'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--pk-text)' }}>{formatIDR(product.price)}</div>
                      {product.stock <= 5 && <span className="pk-badge pk-badge-neutral" style={{ fontSize: 11 }}>Sisa {product.stock}</span>}
                    </div>
                    {(sort === 'rating_desc' || sort === 'sold_desc') && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--pk-text-hint)' }}>
                        {sort === 'rating_desc'
                          ? product.rating_average === null
                            ? 'Belum ada rating'
                            : `Rating ${product.rating_average} (${product.rating_count} ulasan)`
                          : `${product.sold_units ?? 0} unit terjual`}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {pagination.total_pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 40 }}>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
              <Icon name="chevronLeft" size={14} /> Sebelumnya
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className="pk-btn pk-btn-sm"
                onClick={() => updateParams({ page: pageNumber === 1 ? null : String(pageNumber) })}
                style={{ minWidth: 34, background: pageNumber === page ? 'var(--pk-text)' : '#fff', color: pageNumber === page ? '#fff' : 'var(--pk-text)', border: '1px solid var(--pk-border)' }}
              >
                {pageNumber}
              </button>
            ))}
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= pagination.total_pages} onClick={() => updateParams({ page: String(page + 1) })}>
              Berikutnya <Icon name="chevronRight" size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BrowseProductsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat katalog...</div>}>
      <BrowseProductsContent />
    </Suspense>
  );
}
