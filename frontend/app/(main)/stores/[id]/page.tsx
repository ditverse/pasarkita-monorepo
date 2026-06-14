'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Avatar from '@/components/pk/avatar';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import WishlistButton from '@/components/pk/wishlist-button';
import { productsApi } from '@/lib/api/products';
import { formatIDR } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function PublicStorePage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const storeQuery = useQuery({
    queryKey: ['stores', id],
    queryFn: async () => (await productsApi.getStore(id)).data.data,
    enabled: Boolean(id),
  });
  const productsQuery = useQuery({
    queryKey: ['stores', id, 'products', debouncedSearch],
    queryFn: async () => {
      const response = await productsApi.getAll({
        seller_id: id,
        search: debouncedSearch || undefined,
        limit: 100,
      });
      return response.data.data ?? [];
    },
    enabled: Boolean(id),
  });

  if (storeQuery.isLoading) {
    return (
      <div className="pk-page-shell" style={{ padding: '40px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
        <div className="pk-skel" style={{ height: 150, marginBottom: 24 }} />
        <div className="pk-product-grid">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="pk-skel" style={{ height: 260 }} />)}
        </div>
      </div>
    );
  }

  if (storeQuery.isError || !storeQuery.data) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Toko tidak ditemukan</h1>
        <Link href="/products" className="pk-btn pk-btn-primary">Kembali ke Katalog</Link>
      </div>
    );
  }

  const { seller, stats } = storeQuery.data;
  const products = productsQuery.data ?? [];

  return (
    <div className="pk-page-shell" style={{ padding: '32px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
      <Link href="/products" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--pk-text-secondary)', textDecoration: 'none', fontSize: 13, marginBottom: 16 }}>
        <Icon name="arrowLeft" size={14} /> Kembali ke Katalog
      </Link>

      <section className="pk-card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {seller.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.logo_url} alt={`Logo ${seller.store_name}`} style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: '1px solid var(--pk-border)' }} />
          ) : <Avatar name={seller.store_name} size={64} />}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, margin: 0 }}>{seller.store_name}</h1>
              {seller.verification_status === 'demo_verified' && <span className="pk-badge pk-badge-active">Terverifikasi Demo</span>}
            </div>
            <div style={{ color: 'var(--pk-text-hint)', fontSize: 12 }}>
              Dikelola {seller.name} ·{' '}
              Bergabung {new Date(seller.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <span className="pk-badge pk-badge-active">Toko Aktif</span>
        </div>
        {seller.description && <p style={{ maxWidth: 760, margin: '18px 0 0', color: 'var(--pk-text-secondary)', lineHeight: 1.65 }}>{seller.description}</p>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, fontSize: 12, color: 'var(--pk-text-secondary)' }}>
          {seller.open_time && seller.close_time && <span>Jam operasional {seller.open_time.slice(0, 5)}-{seller.close_time.slice(0, 5)}</span>}
          {seller.processing_days && <span>Estimasi proses {seller.processing_days} hari kerja</span>}
          {seller.contact_phone && <span>Kontak {seller.contact_phone}</span>}
        </div>

        <div className="pk-store-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 24 }}>
          {[
            ['Produk Aktif', String(stats.active_products)],
            ['Unit Terjual', String(stats.sold_units)],
            ['Rating Produk', stats.rating_average === null ? 'Belum ada' : `${stats.rating_average} / 5`],
            ['Order Ber-tracking', stats.tracking_coverage === null ? 'Belum ada' : `${stats.tracking_coverage}%`],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 14, borderRadius: 10, background: 'var(--pk-bg-subtle)' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--pk-text-hint)', margin: '12px 0 0' }}>
          Cakupan tracking menunjukkan proporsi order valid yang memiliki nomor pengiriman, bukan jaminan ketepatan waktu.
        </p>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--pk-border)', borderRadius: 8, height: 42, padding: '0 12px', marginBottom: 20 }}>
        <Icon name="search" size={15} style={{ color: 'var(--pk-text-hint)' }} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Cari produk di ${seller.store_name}...`}
          aria-label={`Cari produk di toko ${seller.store_name}`}
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent' }}
        />
        {search && <button type="button" aria-label="Hapus pencarian" onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><Icon name="x" size={14} /></button>}
      </div>

      {productsQuery.isLoading ? (
        <div className="pk-product-grid">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="pk-skel" style={{ height: 260 }} />)}
        </div>
      ) : products.length === 0 ? (
        <div style={{ padding: '56px 24px', border: '1px dashed var(--pk-border)', borderRadius: 12, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
          {search ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Toko belum memiliki produk aktif.'}
        </div>
      ) : (
        <div className="pk-product-grid">
          {products.map((product) => (
            <div key={product.id} className="pk-card pk-card-hover" style={{ overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}><WishlistButton product={product} compact /></div>
              <Link href={`/products/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                <ProductImage src={product.image_url} alt={product.name} height={180} style={{ borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div style={{ color: 'var(--pk-text)', fontWeight: 600 }}>{product.name}</div>
                  <div style={{ color: 'var(--pk-text-hint)', fontSize: 12, marginTop: 4 }}>{product.category}</div>
                  <div style={{ color: 'var(--pk-text)', fontWeight: 700, marginTop: 10 }}>{formatIDR(product.price)}</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
