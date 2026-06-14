'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from '@/components/pk/admin-analytics';
import { CriticalStockTable, SellerStatusDonut, SellerTopProducts, SellerTrendChart } from '@/components/pk/seller-analytics';
import { sellerApi } from '@/lib/api/seller';
import { queryKeys } from '@/lib/query-keys';
import { formatIDR } from '@/lib/format';
import Icon from '@/components/pk/icon';

type PeriodMode = '7d' | '30d' | '90d' | 'custom';

const PRESETS: { value: PeriodMode; label: string }[] = [
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '90d', label: '90 Hari' },
  { value: 'custom', label: 'Custom' },
];

/** Format tanggal ke YYYY-MM-DD WIB untuk input[type=date] */
function toInputDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Hitung tanggal default berdasarkan preset */
function getPresetDates(mode: PeriodMode): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const days = mode === '7d' ? 7 : mode === '90d' ? 90 : 30;
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { dateFrom: toInputDate(from), dateTo: toInputDate(now) };
}

export default function SellerDashboardPage() {
  const today = toInputDate(new Date());
  const [mode, setMode] = useState<PeriodMode>('30d');
  // Custom date inputs (tidak langsung trigger query sampai klik Terapkan)
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // Applied filter — yang benar-benar dikirim ke API
  const [appliedMode, setAppliedMode] = useState<PeriodMode>('30d');
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>(undefined);
  const [appliedTo, setAppliedTo] = useState<string | undefined>(undefined);

  const isCustomMode = mode === 'custom';
  const canApplyCustom = isCustomMode && customFrom && customTo && customFrom <= customTo;

  // Hitung parameter API
  const apiParams =
    appliedMode === '90d'
      ? (() => {
          const { dateFrom, dateTo } = getPresetDates('90d');
          return { date_from: dateFrom, date_to: dateTo };
        })()
      : appliedMode === 'custom'
        ? { date_from: appliedFrom, date_to: appliedTo }
        : { period: appliedMode as '7d' | '30d' };

  const analyticsQuery = useQuery({
    queryKey: queryKeys.seller.analytics(appliedMode, appliedFrom, appliedTo),
    queryFn: async () => (await sellerApi.getAnalytics(apiParams)).data.data,
  });
  const data = analyticsQuery.data;
  const summary = data?.summary;

  const handlePreset = (preset: PeriodMode) => {
    setMode(preset);
    if (preset !== 'custom') {
      setAppliedMode(preset);
      setAppliedFrom(undefined);
      setAppliedTo(undefined);
    }
  };

  const handleApplyCustom = () => {
    if (!canApplyCustom) return;
    setAppliedMode('custom');
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
  };

  // Label periode yang sedang aktif untuk header
  const activePeriodLabel = (() => {
    if (appliedMode === 'custom' && appliedFrom && appliedTo) {
      const fmt = (d: string) =>
        new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Jakarta',
        });
      return `${fmt(appliedFrom)} – ${fmt(appliedTo)}`;
    }
    return PRESETS.find((p) => p.value === appliedMode)?.label ?? '30 Hari';
  })();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Dashboard Toko</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            Ringkasan penjualan · <span style={{ fontWeight: 500 }}>{activePeriodLabel}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Preset pill buttons */}
          <div
            style={{
              display: 'flex',
              background: 'var(--pk-bg-subtle)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePreset(preset.value)}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: mode === preset.value ? '#fff' : 'transparent',
                  color: mode === preset.value ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                  boxShadow: mode === preset.value ? 'var(--pk-shadow-sm)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs — tampil jika mode custom */}
          {isCustomMode && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                id="custom-date-from"
                aria-label="Tanggal mulai"
                className="pk-input"
                value={customFrom}
                max={customTo || today}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ height: 36, width: 148, fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>–</span>
              <input
                type="date"
                id="custom-date-to"
                aria-label="Tanggal akhir"
                className="pk-input"
                value={customTo}
                min={customFrom || undefined}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ height: 36, width: 148, fontSize: 12 }}
              />
              <button
                type="button"
                className="pk-btn pk-btn-primary pk-btn-sm"
                disabled={!canApplyCustom || analyticsQuery.isFetching}
                onClick={handleApplyCustom}
                style={{ height: 36, gap: 6 }}
              >
                <Icon name="check" size={13} stroke={2.5} />
                Terapkan
              </button>
            </div>
          )}

          <button
            type="button"
            className="pk-btn pk-btn-secondary pk-btn-sm"
            disabled={analyticsQuery.isFetching}
            onClick={() => void analyticsQuery.refetch()}
          >
            <Icon
              name={analyticsQuery.isFetching ? 'loader' : 'trending'}
              size={14}
              style={analyticsQuery.isFetching ? { animation: 'pk-spin 0.8s linear infinite' } : undefined}
            />
            {analyticsQuery.isFetching ? 'Memperbarui...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {analyticsQuery.isError && (
        <div className="pk-card" role="alert" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Dashboard gagal dimuat</div>
          <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void analyticsQuery.refetch()}>Coba Lagi</button>
        </div>
      )}

      {/* Hint: custom mode belum diterapkan */}
      {isCustomMode && appliedMode !== 'custom' && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            color: '#1d4ed8',
            marginBottom: 16,
          }}
        >
          <Icon name="sparkle" size={14} />
          Pilih tanggal mulai dan akhir, lalu klik <strong style={{ marginLeft: 2 }}>Terapkan</strong> untuk melihat data.
          {' '}Data saat ini masih periode&nbsp;<strong>{PRESETS.find((p) => p.value === appliedMode)?.label}</strong>.
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 14, marginBottom: 20 }}>
        <MetricCard label="Omzet Kotor" value={formatIDR(summary?.gross_sales)} hint="Nilai item toko dari order paid, shipped, dan delivered." loading={analyticsQuery.isLoading} />
        <MetricCard label="Fee Marketplace" value={formatIDR(summary?.marketplace_fee)} hint="Bagian fee marketplace yang dialokasikan proporsional ke item toko." loading={analyticsQuery.isLoading} />
        <MetricCard label="Estimasi Bersih" value={formatIDR(summary?.estimated_net)} hint="Omzet kotor dikurangi fee marketplace. Bukan saldo SmartBank." loading={analyticsQuery.isLoading} />
        <MetricCard label="Order Sukses" value={(summary?.paid_orders ?? 0).toLocaleString('id-ID')} hint="Order paid, shipped, dan delivered yang memuat produk toko." loading={analyticsQuery.isLoading} href="/seller/orders" />
        <MetricCard label="Perlu Dikirim" value={(summary?.new_orders ?? 0).toLocaleString('id-ID')} hint="Order berstatus paid yang perlu diproses." loading={analyticsQuery.isLoading} href="/seller/orders" />
        <MetricCard label="Terlambat Diproses" value={(summary?.overdue_orders ?? 0).toLocaleString('id-ID')} hint="Order paid yang belum dikirim lebih dari dua hari." loading={analyticsQuery.isLoading} href="/seller/orders" />
        <MetricCard label="Stok Kritis" value={`${(summary?.low_stock ?? 0) + (summary?.out_of_stock ?? 0)}`} hint="Produk stok menipis dan habis." loading={analyticsQuery.isLoading} href="/seller/products" />
        <MetricCard label="Rating Toko" value={summary?.average_rating == null ? '-' : `${summary.average_rating}/5`} hint={`${summary?.new_reviews ?? 0} ulasan baru pada periode.`} loading={analyticsQuery.isLoading} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, marginBottom: 18 }}>
        <SellerTrendChart data={data?.timeseries ?? []} />
        <SellerStatusDonut data={data?.orders_by_status ?? []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18 }}>
        <SellerTopProducts data={data?.top_products ?? []} />
        <CriticalStockTable data={data?.critical_stock ?? []} />
      </div>

      {!analyticsQuery.isLoading && data?.top_products.length === 0 && data.critical_stock.length === 0 && (
        <div className="pk-card" style={{ marginTop: 18, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Mulai bangun performa toko</div>
          <div style={{ color: 'var(--pk-text-secondary)', fontSize: 13, marginBottom: 14 }}>Tambahkan produk lengkap agar dashboard mulai menghasilkan insight.</div>
          <Link href="/seller/products/add" className="pk-btn pk-btn-primary pk-btn-sm" style={{ textDecoration: 'none' }}>Tambah Produk</Link>
        </div>
      )}

      {data && (
        <div style={{ marginTop: 14, textAlign: 'right', fontSize: 11, color: 'var(--pk-text-hint)' }}>
          Diperbarui {new Date(data.period.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
          {' '}· Periode: {data.period.days} hari
        </div>
      )}
    </div>
  );
}
