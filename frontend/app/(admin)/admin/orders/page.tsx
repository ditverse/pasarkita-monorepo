'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { Order } from '@/types/api';

const STATUS_TABS = [
  { id: '', label: 'Semua' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'delivered', label: 'Selesai' },
  { id: 'payment_failed', label: 'Gagal' },
];

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'payment_failed'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; limit?: number } = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await ordersApi.getAll(params);
      setOrders(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) {
      console.error('Gagal load orders', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await ordersApi.updateStatus(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o))
      );
    } catch (err) {
      console.error('Gagal update status order', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Semua Order</h1>
        <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
          {loading ? '...' : `${total.toLocaleString('id-ID')} total order`}
        </p>
      </div>

      {/* Status tabs */}
      <div style={{ borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto' }}>
        {STATUS_TABS.map((t) => {
          const isActive = statusFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                color: isActive ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                borderBottom: isActive ? '2px solid var(--pk-text)' : '2px solid transparent',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Order ID', 'Total', 'Status', 'Tanggal', 'Ubah Status'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 4 ? 'right' : 'left',
                  padding: '10px 20px', fontSize: 12, fontWeight: 500,
                  color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Tidak ada order ditemukan.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '14px 20px' }}>
                  <span className="pk-mono" style={{ fontSize: 13 }}>
                    {o.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500 }}>
                  {formatIDR(o.total)}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <StatusBadge status={o.status} />
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>
                  {formatDate(o.created_at)}
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <select
                      className="pk-select"
                      style={{ height: 32, fontSize: 12, width: 140 }}
                      value={o.status}
                      disabled={updatingId === o.id}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    >
                      {VALID_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {updatingId === o.id && (
                      <Icon name="loader" size={14} style={{ marginLeft: 8, color: 'var(--pk-text-hint)', animation: 'pk-spin 0.8s linear infinite' }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
