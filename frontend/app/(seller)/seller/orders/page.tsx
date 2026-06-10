'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { Order } from '@/types/api';

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'paid', label: 'Perlu Dikirim' },
  { id: 'shipped', label: 'Sedang Dikirim' },
  { id: 'delivered', label: 'Selesai' },
  { id: 'payment_failed', label: 'Gagal' },
];

export default function SellerOrdersPage() {
  const [tab, setTab] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading: loading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.orders.list('seller'),
    queryFn: async (): Promise<Order[]> => {
      const res = await ordersApi.getAll();
      return res.data.data ?? [];
    },
    enabled: Boolean(user),
  });

  const markShippedMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.updateStatus(orderId, { status: 'shipped' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleMarkShipped = async (orderId: string) => {
    if (!window.confirm(`Tandai order ${orderId.slice(0, 8).toUpperCase()} sebagai sudah dikirim?`)) {
      return;
    }

    setUpdatingId(orderId);
    try {
      await markShippedMutation.mutateAsync(orderId);
      toast.success('Pesanan ditandai sebagai dikirim');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gagal update status'));
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user) {
    return <div style={{ padding: '64px', textAlign: 'center' }}>Memuat data...</div>;
  }

  const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab);

  const getCount = (statusId: string) => {
    if (statusId === 'all') return orders.length;
    return orders.filter((o) => o.status === statusId).length;
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Order Masuk</h1>
        <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
          Kelola semua pesanan dari pelanggan Anda
        </p>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const count = getCount(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px', background: 'transparent', border: 'none',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                color: isActive ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                borderBottom: isActive ? '2px solid var(--pk-text)' : '2px solid transparent',
                marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              {t.label}
              <span style={{
                background: isActive ? 'var(--pk-text)' : 'var(--pk-bg-subtle)',
                color: isActive ? '#fff' : 'var(--pk-text-secondary)',
                borderRadius: 999, fontSize: 11, fontWeight: 500, padding: '1px 8px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
            Memuat pesanan...
          </div>
        )}

        {!loading && isError && (
          <div style={{
            padding: '40px', textAlign: 'center',
            border: '1px dashed var(--pk-border)', borderRadius: 12,
            color: 'var(--pk-text-secondary)',
          }}>
            <div>Order gagal dimuat. Periksa koneksi backend dan token login.</div>
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              style={{ marginTop: 12 }}
            >
              {isFetching ? 'Mencoba lagi...' : 'Coba Lagi'}
            </button>
          </div>
        )}

        {!loading && !isError && filtered.map((o) => (
          <div key={o.id} className="pk-card pk-card-hover" style={{ padding: 20, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="pk-mono" style={{ fontSize: 13, color: 'var(--pk-text)', fontWeight: 500 }}>
                  {o.id.slice(0, 8).toUpperCase()}
                </span>
                <StatusBadge status={o.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>
                {new Date(o.created_at).toLocaleDateString('id-ID', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {o.items?.[0]?.product_name || 'Produk dihapus'}
                  {o.items && o.items.length > 1 && (
                    <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>
                      {' '}+ {o.items.length - 1} item lain
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 2 }}>
                  {o.items?.reduce((s, i) => s + i.qty, 0) ?? 0} barang ·{' '}
                  Total: <span style={{ fontWeight: 600, color: 'var(--pk-text)' }}>{formatIDR(o.total)}</span>
                </div>
                {o.tracking_id && (
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
                    Resi: <span className="pk-mono" style={{ color: 'var(--pk-accent)' }}>{o.tracking_id}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {/* Tombol Tandai Dikirim — hanya untuk order paid */}
                {o.status === 'paid' && (
                  <button
                    className="pk-btn pk-btn-primary pk-btn-sm"
                    disabled={updatingId === o.id}
                    onClick={() => handleMarkShipped(o.id)}
                  >
                    {updatingId === o.id ? 'Memproses...' : 'Tandai Dikirim'}
                  </button>
                )}
                <Link href={`/orders/${o.id}`} style={{ textDecoration: 'none' }}>
                  <button className="pk-btn pk-btn-secondary pk-btn-sm">Lihat Detail</button>
                </Link>
              </div>
            </div>
          </div>
        ))}

        {!loading && !isError && filtered.length === 0 && (
          <div style={{
            padding: '64px 24px', textAlign: 'center',
            border: '1px dashed var(--pk-border)', borderRadius: 12,
            color: 'var(--pk-text-hint)', fontSize: 14,
          }}>
            Tidak ada pesanan dalam status ini.
          </div>
        )}
      </div>
    </div>
  );
}
