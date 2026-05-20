'use client';

import { useState, useEffect } from 'react';
import StatusBadge from '@/components/pk/status-badge';
import { formatIDR } from '@/lib/format';
import { adminApi } from '@/lib/api/admin';
import { ordersApi } from '@/lib/api/orders';
import { Order } from '@/types/api';

interface Metrics {
  total_orders: number;
  total_revenue: number;
  marketplace_fee: number;
  new_users: number;
}

function MetricCard({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
      <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginBottom: 10 }}>{label}</div>
      {loading ? (
        <div style={{ width: '80%', height: 28, background: 'var(--pk-bg-subtle)', borderRadius: 4, animation: 'pk-pulse 1.5s infinite' }} />
      ) : (
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [analyticsRes, ordersRes] = await Promise.all([
          adminApi.getAnalytics(),
          ordersApi.getAll({ limit: 5 }),
        ]);
        // Backend: { success, message, data: { metrics, ... } }
        const analyticsData = analyticsRes.data.data as unknown as { metrics: Metrics };
        setMetrics(analyticsData?.metrics ?? null);
        setOrders(ordersRes.data.data ?? []);
      } catch (err) {
        console.error('Gagal load admin overview', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const m: Metrics = metrics ?? { total_orders: 0, total_revenue: 0, marketplace_fee: 0, new_users: 0 };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Overview</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Data keseluruhan platform</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard label="Total User" value={m.new_users.toLocaleString('id-ID')} loading={loading} />
        <MetricCard label="Total Orders" value={m.total_orders.toLocaleString('id-ID')} loading={loading} />
        <MetricCard label="Total Revenue" value={formatIDR(m.total_revenue)} loading={loading} />
        <MetricCard label="Fee Marketplace" value={formatIDR(m.marketplace_fee)} loading={loading} />
      </div>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Order Terbaru</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>5 order terakhir</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Order ID', 'Total', 'Status', 'Tanggal'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 24px', fontSize: 12, fontWeight: 500, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat...</td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Belum ada order.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '14px 24px' }}>
                  <span className="pk-mono" style={{ color: 'var(--pk-text)', fontSize: 13 }}>{o.id.slice(0, 8).toUpperCase()}</span>
                </td>
                <td style={{ padding: '14px 24px', fontSize: 13, fontWeight: 500 }}>{formatIDR(o.total)}</td>
                <td style={{ padding: '14px 24px' }}><StatusBadge status={o.status} /></td>
                <td style={{ padding: '14px 24px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
