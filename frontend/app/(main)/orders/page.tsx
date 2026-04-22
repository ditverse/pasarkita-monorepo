'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';

const ORDERS = [
  { id: 'PK-2048-A9F2', date: '21 Apr 2026', items: [{ name: 'Kopi Arabika Gayo 250g', qty: 2, price: 89000 }, { name: 'Madu Hutan Flores 500ml', qty: 1, price: 125000 }], total: 303000, status: 'shipped' },
  { id: 'PK-2047-B1C4', date: '20 Apr 2026', items: [{ name: 'Batik Tulis Pekalongan', qty: 1, price: 285000 }], total: 290700, status: 'paid' },
  { id: 'PK-2045-K7M1', date: '18 Apr 2026', items: [{ name: 'Keripik Singkong Balado', qty: 4, price: 18500 }], total: 75480, status: 'delivered' },
  { id: 'PK-2041-Z8N3', date: '16 Apr 2026', items: [{ name: 'Tas Rotan Handwoven', qty: 1, price: 145000 }], total: 147900, status: 'pending' },
  { id: 'PK-2039-Q3R8', date: '14 Apr 2026', items: [{ name: 'Speaker Bluetooth Mini', qty: 1, price: 220000 }], total: 224400, status: 'payment_failed' },
];

const TABS = [
  { id: 'all', label: 'Semua', count: 5 },
  { id: 'pending', label: 'Pending', count: 1 },
  { id: 'paid', label: 'Dibayar', count: 1 },
  { id: 'shipped', label: 'Dikirim', count: 1 },
  { id: 'delivered', label: 'Selesai', count: 1 },
  { id: 'payment_failed', label: 'Gagal', count: 1 },
];

export default function OrdersListPage() {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? ORDERS : ORDERS.filter((o) => o.status === tab);

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1200, marginInline: 'auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 4px' }}>
        Pesanan Saya
      </h1>
      <p style={{ color: 'var(--pk-text-secondary)', fontSize: 14, margin: '0 0 28px' }}>
        Pantau semua transaksi dan status pengiriman Anda.
      </p>

      <div style={{ borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                color: isActive ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                borderBottom: isActive ? '2px solid var(--pk-text)' : '2px solid transparent',
                marginBottom: -1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.label}
              <span
                style={{
                  background: isActive ? 'var(--pk-text)' : 'var(--pk-bg-subtle)',
                  color: isActive ? '#fff' : 'var(--pk-text-secondary)',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '1px 8px',
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((o) => (
          <div key={o.id} className="pk-card pk-card-hover" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="pk-mono" style={{ fontSize: 13, color: 'var(--pk-text)', fontWeight: 500 }}>
                  {o.id}
                </span>
                <StatusBadge status={o.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>{o.date}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {o.items[0].name}{' '}
                  {o.items.length > 1 && (
                    <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>
                      + {o.items.length - 1} item lain
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 2 }}>
                  {o.items.reduce((s, i) => s + i.qty, 0)} barang · Total {formatIDR(o.total)}
                </div>
              </div>
              <Link href={`/orders/${o.id}`} style={{ textDecoration: 'none' }}>
                <button className="pk-btn pk-btn-secondary pk-btn-sm">Lihat Detail</button>
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-hint)', fontSize: 14 }}>
            Tidak ada pesanan dalam status ini.
          </div>
        )}
      </div>
    </div>
  );
}
