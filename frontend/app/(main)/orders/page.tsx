'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth';
import { Order } from '@/types/api';

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'delivered', label: 'Selesai' },
  { id: 'payment_failed', label: 'Gagal' },
];

export default function OrdersListPage() {
  const [tab, setTab] = useState('all');
  const user = useAuthStore((state) => state.user);

  const { data: orders = [], isLoading: loading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.orders.list('buyer'),
    queryFn: async (): Promise<Order[]> => {
      const res = await ordersApi.getAll();
      return res.data.data ?? [];
    },
    enabled: Boolean(user),
  });

  if (!user) {
    return <div style={{ padding: '64px', textAlign: 'center' }}>Harap login untuk melihat pesanan.</div>;
  }

  const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab);

  const getCount = (statusId: string) => {
    if (statusId === 'all') return orders.length;
    return orders.filter(o => o.status === statusId).length;
  };

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
          const count = getCount(t.id);
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
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat pesanan...</div>}

        {!loading && isError && (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-secondary)' }}>
            <div>Pesanan gagal dimuat. Periksa koneksi lalu coba kembali.</div>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void refetch()} disabled={isFetching} style={{ marginTop: 12 }}>
              {isFetching ? 'Mencoba lagi...' : 'Coba Lagi'}
            </button>
          </div>
        )}
        
        {!loading && !isError && filtered.map((o) => (
          <div key={o.id} className="pk-card pk-card-hover" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="pk-mono" style={{ fontSize: 13, color: 'var(--pk-text)', fontWeight: 500 }}>
                  {o.id.split('-').shift()?.toUpperCase()}
                </span>
                <StatusBadge status={o.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>
                {new Date(o.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric'})}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {o.items?.[0]?.product_name || 'Produk dihapus'}{' '}
                  {o.items && o.items.length > 1 && (
                    <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>
                      + {o.items.length - 1} item lain
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 2 }}>
                  {o.items?.reduce((s, i) => s + i.qty, 0) ?? 0} barang · Total {formatIDR(o.total)}
                </div>
              </div>
              <Link href={`/orders/${o.id}`} style={{ textDecoration: 'none' }}>
                <button className="pk-btn pk-btn-secondary pk-btn-sm">Lihat Detail</button>
              </Link>
            </div>
          </div>
        ))}

        {!loading && !isError && filtered.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-hint)', fontSize: 14 }}>
            <div style={{ marginBottom: 14 }}>Tidak ada pesanan dalam status ini.</div>
            {tab === 'all' && (
              <Link href="/products" className="pk-btn pk-btn-primary pk-btn-sm">Mulai Belanja</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
