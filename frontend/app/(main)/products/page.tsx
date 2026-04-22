'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

const PRODUCTS = [
  { id: 'p1',  name: 'Batik Tulis Pekalongan',    seller: 'Batik Nusantara',  price: 285000, stock: 12, cat: 'Fashion' },
  { id: 'p2',  name: 'Keripik Singkong Balado',    seller: 'Warung Bu Sari',   price: 18500,  stock: 48, cat: 'Makanan' },
  { id: 'p3',  name: 'Tas Rotan Handwoven',        seller: 'Kriya Bali',       price: 145000, stock: 7,  cat: 'Kerajinan' },
  { id: 'p4',  name: 'Speaker Bluetooth Mini',     seller: 'Toko Elektro ID',  price: 220000, stock: 23, cat: 'Elektronik' },
  { id: 'p5',  name: 'Kopi Arabika Gayo 250g',     seller: 'Kopi Rakyat',      price: 89000,  stock: 34, cat: 'Makanan' },
  { id: 'p6',  name: 'Kemeja Linen Pria',          seller: 'Tenun Modern',     price: 189000, stock: 15, cat: 'Fashion' },
  { id: 'p7',  name: 'Gerabah Kasongan Set',       seller: 'Kriya Bali',       price: 95000,  stock: 9,  cat: 'Kerajinan' },
  { id: 'p8',  name: 'Madu Hutan Flores 500ml',    seller: 'Kopi Rakyat',      price: 125000, stock: 22, cat: 'Makanan' },
  { id: 'p9',  name: 'Sepatu Kulit Handmade',      seller: 'Tenun Modern',     price: 495000, stock: 4,  cat: 'Fashion' },
  { id: 'p10', name: 'Wayang Kulit Mini',          seller: 'Kriya Bali',       price: 75000,  stock: 16, cat: 'Kerajinan' },
  { id: 'p11', name: 'Teh Hijau Tambi 200g',       seller: 'Warung Bu Sari',   price: 42000,  stock: 40, cat: 'Makanan' },
  { id: 'p12', name: 'Powerbank 10.000 mAh',       seller: 'Toko Elektro ID',  price: 165000, stock: 31, cat: 'Elektronik' },
];

export default function BrowseProductsPage() {
  const [cat, setCat] = useState<Set<string>>(new Set());
  const [priceMax, setPriceMax] = useState(500000);
  const [sort, setSort] = useState('relevant');

  const filtered = PRODUCTS.filter(
    (p) => (cat.size === 0 || cat.has(p.cat)) && p.price <= priceMax,
  );

  const toggle = (c: string) => {
    const next = new Set(cat);
    next.has(c) ? next.delete(c) : next.add(c);
    setCat(next);
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
                onClick={() => toggle(c)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid ' + (cat.has(c) ? 'var(--pk-text)' : 'var(--pk-border-strong)'),
                  background: cat.has(c) ? 'var(--pk-text)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {cat.has(c) && (
                  <Icon name="check" size={12} style={{ color: '#fff' }} stroke={3} />
                )}
              </span>
              {c}
            </label>
          ))}
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
          Harga Maks.
        </div>
        <div style={{ marginBottom: 28 }}>
          <input
            type="range"
            min="0"
            max="500000"
            step="10000"
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
          <option value="relevant">Paling relevan</option>
          <option value="newest">Terbaru</option>
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
          }}
        >
          <Icon name="search" size={16} style={{ color: 'var(--pk-text-hint)' }} />
          <input
            placeholder="Cari produk, seller, kategori..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 14,
              background: 'transparent',
            }}
          />
        </div>

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
          </div>
        </div>

        {filtered.length === 0 ? (
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
              Tidak ada produk ditemukan
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--pk-text-secondary)',
                maxWidth: 380,
                marginBottom: 20,
              }}
            >
              Coba ubah filter atau kata kunci pencarian.
            </div>
            <button
              className="pk-btn pk-btn-primary pk-btn-sm"
              onClick={() => {
                setCat(new Set());
                setPriceMax(500000);
              }}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {filtered.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                <div className="pk-card pk-card-hover" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                  <Placeholder label={p.cat.toLowerCase()} height={160} style={{ borderRadius: 0 }} />
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
                      {p.seller}
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

        {/* Pagination */}
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
          {[1, 2, 3, 4, 5].map((n) => (
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
