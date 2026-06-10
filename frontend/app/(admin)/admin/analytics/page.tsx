'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionCenter,
  FunnelChart,
  HealthBars,
  IntegrationHealth,
  MetricCard,
  PeriodFilter,
  RankingBars,
  StatusDonut,
  TrendChart,
  PulseHeatmap,
  UserGrowthChart,
} from '@/components/pk/admin-analytics';
import { adminApi } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';
import { formatIDR } from '@/lib/format';

type Period = 'today' | '7d' | '30d' | 'custom';

function toApiDate(value: string, endOfDay = false) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const customReady = period !== 'custom' || Boolean(start && end);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.admin.analytics(period, start, end),
    enabled: customReady,
    queryFn: async () => {
      const params = period === 'custom'
        ? { start: toApiDate(start), end: toApiDate(end, true) }
        : { period };
      const response = await adminApi.getAnalytics(params);
      return response.data.data;
    },
  });

  const data = analyticsQuery.data;
  const summary = data?.summary;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            Performa operasional marketplace dalam zona waktu Asia/Jakarta
          </p>
        </div>
        <PeriodFilter
          period={period}
          start={start}
          end={end}
          onPeriodChange={setPeriod}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
      </div>

      {period === 'custom' && !customReady && (
        <div className="pk-card" style={{ padding: 16, marginBottom: 20, color: 'var(--pk-text-secondary)' }}>
          Pilih tanggal mulai dan akhir untuk memuat analytics.
        </div>
      )}

      {analyticsQuery.isError && (
        <div className="pk-card" role="alert" style={{ padding: 20, marginBottom: 20, borderColor: 'var(--pk-danger)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Analytics gagal dimuat</div>
          <div style={{ color: 'var(--pk-text-secondary)', marginBottom: 12 }}>Periksa koneksi backend lalu coba lagi.</div>
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => analyticsQuery.refetch()}>
            Coba Lagi
          </button>
        </div>
      )}

      {data && (analyticsQuery.isStale || analyticsQuery.isFetching) && (
        <div
          className="pk-card"
          style={{
            padding: '10px 14px',
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background: 'var(--pk-warning-soft)',
            borderColor: 'var(--pk-warning)',
            color: 'var(--pk-warning)',
            fontSize: 12,
          }}
        >
          <span>{analyticsQuery.isFetching ? 'Data sedang diperbarui di latar belakang.' : 'Data melewati batas freshness 30 detik.'}</span>
          {!analyticsQuery.isFetching && (
            <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => analyticsQuery.refetch()}>
              Perbarui
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricCard
          label="GMV"
          value={formatIDR(summary?.gmv)}
          change={data?.comparison.gmv}
          hint="Total nilai order dengan pembayaran sukses."
          loading={analyticsQuery.isLoading}
          href="/admin/orders"
        />
        <MetricCard
          label="Revenue Marketplace"
          value={formatIDR(summary?.marketplace_revenue)}
          change={data?.comparison.marketplace_revenue}
          hint="Fee marketplace dari order yang pembayaran sudah sukses."
          loading={analyticsQuery.isLoading}
          href="/admin/orders"
        />
        <MetricCard
          label="Paid Orders"
          value={(summary?.paid_orders ?? 0).toLocaleString('id-ID')}
          change={data?.comparison.paid_orders}
          hint="Order berstatus paid, shipped, atau delivered."
          loading={analyticsQuery.isLoading}
          href="/admin/orders?status=paid"
        />
        <MetricCard
          label="Average Order Value"
          value={formatIDR(summary?.average_order_value)}
          hint="Rata-rata GMV per paid order."
          loading={analyticsQuery.isLoading}
          href="/admin/orders"
        />
        <MetricCard
          label="Payment Failure"
          value={`${summary?.payment_failure_rate ?? 0}%`}
          hint="Proporsi payment_failed dibanding payment yang telah diproses."
          loading={analyticsQuery.isLoading}
          href="/admin/orders?status=payment_failed"
        />
        <MetricCard
          label="Buyer Aktif"
          value={(summary?.active_buyers ?? 0).toLocaleString('id-ID')}
          hint="Buyer unik yang membuat order pada periode."
          loading={analyticsQuery.isLoading}
          href="/admin/users?role=buyer"
        />
        <MetricCard
          label="Seller Aktif"
          value={(summary?.active_sellers ?? 0).toLocaleString('id-ID')}
          hint="Seller unik dengan item yang dipesan pada periode."
          loading={analyticsQuery.isLoading}
          href="/admin/users?role=seller"
        />
        <MetricCard
          label="User Baru"
          value={(summary?.new_users ?? 0).toLocaleString('id-ID')}
          change={data?.comparison.new_users}
          hint="Akun baru yang terdaftar pada periode."
          loading={analyticsQuery.isLoading}
          href="/admin/users"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 18 }}>
        <TrendChart data={data?.timeseries ?? []} />
        <FunnelChart data={data?.transaction_funnel ?? []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
        <StatusDonut data={data?.orders_by_status ?? []} />
        <RankingBars
          title="Top Produk"
          subtitle="Berdasarkan unit terjual dari paid order"
          data={(data?.top_products ?? []) as unknown as Array<Record<string, string | number>>}
          valueKey="sold"
        />
        <RankingBars
          title="Top Kategori"
          subtitle="Berdasarkan GMV"
          data={(data?.top_categories ?? []) as unknown as Array<Record<string, string | number>>}
          valueKey="gmv"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
        <HealthBars
          title="Payment Health"
          subtitle="Perbandingan payment sukses dan gagal"
          data={data?.timeseries ?? []}
          series={[
            { key: 'payment_success', label: 'Sukses', color: '#16A34A' },
            { key: 'payment_failed', label: 'Gagal', color: '#DC2626' },
          ]}
        />
        <HealthBars
          title="Shipping Health"
          subtitle="Pengiriman dibuat, dikirim, dan selesai"
          data={data?.timeseries ?? []}
          series={[
            { key: 'shipping_created', label: 'Dibuat', color: '#2563EB' },
            { key: 'shipped', label: 'Dikirim', color: '#0D9488' },
            { key: 'delivered', label: 'Selesai', color: '#16A34A' },
          ]}
        />
        <UserGrowthChart data={data?.timeseries ?? []} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <PulseHeatmap data={data?.marketplace_pulse ?? []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        <IntegrationHealth data={data?.integration_health ?? { available: false, services: [], message: 'Memuat data...' }} />
        <ActionCenter data={data?.action_center ?? []} />
      </div>

      {data && (
        <div style={{ marginTop: 14, textAlign: 'right', fontSize: 11, color: 'var(--pk-text-hint)' }}>
          Diperbarui {new Date(data.period.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
        </div>
      )}
    </div>
  );
}
