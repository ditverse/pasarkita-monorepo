'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import StatusBadge from '@/components/pk/status-badge';
import { ActionCenter, MetricCard, TrendChart } from '@/components/pk/admin-analytics';
import { formatIDR } from '@/lib/format';
import { adminApi } from '@/lib/api/admin';
import { ordersApi } from '@/lib/api/orders';
import { queryKeys } from '@/lib/query-keys';

export default function AdminDashboardPage() {
  const analyticsQuery = useQuery({
    queryKey: queryKeys.admin.analytics('7d'),
    queryFn: async () => (await adminApi.getAnalytics({ period: '7d' })).data.data,
  });
  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list('admin-overview'),
    queryFn: async () => (await ordersApi.getAll({ limit: 5 })).data.data ?? [],
  });

  const data = analyticsQuery.data;
  const summary = data?.summary;
  const loading = analyticsQuery.isLoading;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Overview</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Ringkasan operasional 7 hari terakhir</p>
        </div>
        <Link href="/admin/analytics" className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
          Buka Analytics Lengkap
        </Link>
      </div>

      {analyticsQuery.isError && (
        <div className="pk-card" role="alert" style={{ padding: 18, marginBottom: 20 }}>
          Dashboard gagal dimuat.{' '}
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => analyticsQuery.refetch()}>Coba Lagi</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricCard label="GMV" value={formatIDR(summary?.gmv)} change={data?.comparison.gmv} hint="Nilai paid order." loading={loading} href="/admin/orders" />
        <MetricCard label="Revenue Fee" value={formatIDR(summary?.marketplace_revenue)} change={data?.comparison.marketplace_revenue} hint="Fee dari paid order." loading={loading} href="/admin/analytics" />
        <MetricCard label="Paid Orders" value={(summary?.paid_orders ?? 0).toLocaleString('id-ID')} change={data?.comparison.paid_orders} hint="Order paid, shipped, delivered." loading={loading} href="/admin/orders?status=paid" />
        <MetricCard label="Payment Failure" value={`${summary?.payment_failure_rate ?? 0}%`} hint="Rasio payment gagal." loading={loading} href="/admin/orders?status=payment_failed" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
        <TrendChart data={data?.timeseries ?? []} />
        <ActionCenter data={data?.action_center ?? []} />
      </div>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Order Terbaru</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>5 order terakhir</div>
          </div>
          <Link href="/admin/orders" style={{ fontSize: 12, color: 'var(--pk-accent)', textDecoration: 'none' }}>Lihat semua</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                {['Order ID', 'Total', 'Status', 'Tanggal'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '10px 24px', fontSize: 12, fontWeight: 500, color: 'var(--pk-text-hint)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center' }}>Memuat...</td></tr>}
              {!ordersQuery.isLoading && (ordersQuery.data?.length ?? 0) === 0 && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Belum ada order.</td></tr>
              )}
              {ordersQuery.data?.map((order) => (
                <tr key={order.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '14px 24px' }}><span className="pk-mono">{order.id.slice(0, 8).toUpperCase()}</span></td>
                  <td style={{ padding: '14px 24px', fontWeight: 500 }}>{formatIDR(order.total)}</td>
                  <td style={{ padding: '14px 24px' }}><StatusBadge status={order.status} /></td>
                  <td style={{ padding: '14px 24px', color: 'var(--pk-text-secondary)' }}>{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
