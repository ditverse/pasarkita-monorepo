'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import Placeholder from '@/components/pk/placeholder';
import Avatar from '@/components/pk/avatar';
import { formatIDR } from '@/lib/format';

const PRODUCT = {
  id: 'p1',
  name: 'Batik Tulis Pekalongan',
  seller: 'Batik Nusantara',
  price: 285000,
  stock: 12,
  cat: 'Fashion',
};

export default function ProductDetailPage() {
  const [qty, setQty] = useState(1);
  const p = PRODUCT;
  const subtotal = p.price * qty;
  const fee = Math.round(subtotal * 0.02);

  return (
    <div style={{ padding: '20px 80px 64px' }}>
      <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', marginBottom: 16 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Beranda</Link>
        <span style={{ margin: '0 6px' }}>/</span>
        <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>Fashion</Link>
        <span style={{ margin: '0 6px' }}>/</span>
        <span style={{ color: 'var(--pk-text)' }}>{p.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        {/* Images */}
        <div>
          <Placeholder label="foto produk utama" height={520} style={{ borderRadius: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <Placeholder
                key={i}
                label={`thumb ${i}`}
                height={96}
                style={{
                  borderRadius: 8,
                  border: i === 1 ? '1.5px solid var(--pk-text)' : '1px solid var(--pk-border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <span className="pk-badge pk-badge-neutral" style={{ marginBottom: 12 }}>
            {p.cat}
          </span>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              margin: '12px 0 12px',
              lineHeight: 1.15,
            }}
          >
            {p.name}
          </h1>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              marginBottom: 24,
            }}
          >
            {formatIDR(p.price)}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 0',
              borderTop: '1px solid var(--pk-border)',
              borderBottom: '1px solid var(--pk-border)',
            }}
          >
            <Avatar name="Batik Nusantara" size={40} bg="#F3F4F6" color="#111827" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.seller}</div>
              <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Pekalongan · Bergabung 2024</div>
            </div>
            <button className="pk-btn pk-btn-secondary pk-btn-sm">Kunjungi toko</button>
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Deskripsi</div>
            <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', lineHeight: 1.65, margin: 0 }}>
              Batik tulis motif Jlamprang khas Pekalongan, dikerjakan langsung oleh pembatik lokal dengan
              pewarna alami. Bahan katun primis 2.15m × 1.05m. Setiap lembar memiliki variasi motif unik —
              tidak ada yang identik. Cocok untuk acara formal maupun kasual.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
            <span className="pk-label" style={{ margin: 0 }}>Jumlah</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--pk-border)',
                borderRadius: 8,
                height: 40,
              }}
            >
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                style={{
                  width: 40,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--pk-text-secondary)',
                }}
              >
                <Icon name="minus" size={14} />
              </button>
              <div
                style={{
                  width: 48,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  borderLeft: '1px solid var(--pk-border)',
                  borderRight: '1px solid var(--pk-border)',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty(Math.min(p.stock, qty + 1))}
                style={{
                  width: 40,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--pk-text-secondary)',
                }}
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>Stok: {p.stock}</span>
          </div>

          {/* Fee preview */}
          <div
            style={{
              background: 'var(--pk-bg-subtle)',
              borderRadius: 12,
              padding: 20,
              marginTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Row label="Subtotal" value={formatIDR(subtotal)} />
            <Row label="Fee marketplace (2%)" value={formatIDR(fee)} muted />
            <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
            <Row label="Total" value={formatIDR(subtotal + fee)} bold />
          </div>

          <Link href="/checkout" style={{ textDecoration: 'none' }}>
            <button
              className="pk-btn pk-btn-primary pk-btn-lg pk-btn-block"
              style={{ marginTop: 20 }}
            >
              Checkout Sekarang <Icon name="arrowRight" size={16} />
            </button>
          </Link>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', textAlign: 'center', marginTop: 12 }}>
            Pembayaran aman lewat SmartBank · Dana ditahan sampai barang diterima
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: bold ? 15 : 13,
          color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)',
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: bold ? 17 : 14,
          color: 'var(--pk-text)',
          fontWeight: bold ? 600 : 500,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
    </div>
  );
}
