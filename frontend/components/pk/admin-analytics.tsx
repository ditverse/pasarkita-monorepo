'use client';

import Link from 'next/link';
import { formatIDR } from '@/lib/format';
import type { AnalyticsSummary } from '@/types/api';

type SummaryKey = keyof AnalyticsSummary['summary'];

export function MetricCard({
  label,
  value,
  change,
  hint,
  loading,
  href,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint: string;
  loading?: boolean;
  href?: string;
}) {
  const content = (
    <div className="pk-card" style={{ padding: 20, background: '#fff', minWidth: 0 }}>
      <div title={hint} style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginBottom: 10 }}>
        {label} <span aria-label={hint} style={{ cursor: 'help', color: 'var(--pk-text-hint)' }}>ⓘ</span>
      </div>
      {loading ? (
        <div className="pk-skeleton" style={{ width: '80%', height: 28 }} />
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            {value}
          </div>
          {change !== undefined && (
            <div style={{
              marginTop: 9,
              fontSize: 12,
              color: change == null ? 'var(--pk-text-hint)' : change >= 0 ? 'var(--pk-success)' : 'var(--pk-danger)',
            }}>
              {change == null ? 'Tidak ada pembanding' : `${change >= 0 ? '+' : ''}${change}% dari periode lalu`}
            </div>
          )}
        </>
      )}
    </div>
  );
  return href ? <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{content}</Link> : content;
}

export function PeriodFilter({
  period,
  start,
  end,
  onPeriodChange,
  onStartChange,
  onEndChange,
}: {
  period: string;
  start: string;
  end: string;
  onPeriodChange: (value: 'today' | '7d' | '30d' | 'custom') => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="pk-label" style={{ margin: 0 }} htmlFor="analytics-period">Periode</label>
      <select
        id="analytics-period"
        className="pk-select"
        value={period}
        onChange={(event) => onPeriodChange(event.target.value as 'today' | '7d' | '30d' | 'custom')}
        style={{ width: 140, height: 36 }}
      >
        <option value="today">Hari ini</option>
        <option value="7d">7 hari</option>
        <option value="30d">30 hari</option>
        <option value="custom">Custom</option>
      </select>
      {period === 'custom' && (
        <>
          <input
            aria-label="Tanggal mulai"
            className="pk-input"
            type="date"
            value={start}
            max={end || undefined}
            onChange={(event) => onStartChange(event.target.value)}
            style={{ width: 145, height: 36 }}
          />
          <span style={{ color: 'var(--pk-text-hint)' }}>s.d.</span>
          <input
            aria-label="Tanggal akhir"
            className="pk-input"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(event) => onEndChange(event.target.value)}
            style={{ width: 145, height: 36 }}
          />
        </>
      )}
    </div>
  );
}

const compactIDR = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function TrendChart({ data }: { data: AnalyticsSummary['timeseries'] }) {
  const width = 720;
  const height = 240;
  const padding = 38;
  const maxValue = Math.max(1, ...data.map((point) => Math.max(point.gmv, point.marketplace_revenue)));
  const maxOrders = Math.max(1, ...data.map((point) => point.orders));
  const points = data.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, data.length - 1);
    const y = height - padding - (point.gmv / maxValue) * (height - padding * 2);
    const revenueY = height - padding - (point.marketplace_revenue / maxValue) * (height - padding * 2);
    return { ...point, x, y, revenueY };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const revenuePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.revenueY}`).join(' ');

  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Tren GMV dan Order</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>
        GMV hanya menghitung order yang pembayaran sudah sukses
      </div>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik tren GMV" style={{ width: '100%', minWidth: 560 }}>
            {[0, 0.5, 1].map((ratio) => {
              const y = height - padding - ratio * (height - padding * 2);
              return (
                <g key={ratio}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E7EB" />
                  <text x={padding - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6B7280">
                    {compactIDR.format(maxValue * ratio)}
                  </text>
                </g>
              );
            })}
            {points.map((point) => {
              const barHeight = (point.orders / maxOrders) * (height - padding * 2);
              return (
                <rect
                  key={`orders-${point.bucket}`}
                  x={point.x - 7}
                  y={height - padding - barHeight}
                  width="14"
                  height={barHeight}
                  rx="3"
                  fill="rgba(17,24,39,0.12)"
                >
                  <title>{`${point.orders} order`}</title>
                </rect>
              );
            })}
            <path d={path} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinejoin="round" />
            <path d={revenuePath} fill="none" stroke="#0D9488" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
            {points.map((point) => (
              <g key={point.bucket}>
                <circle cx={point.x} cy={point.y} r="4" fill="#2563EB">
                  <title>{`${point.bucket}: ${formatIDR(point.gmv)}, ${point.orders} order`}</title>
                </circle>
              </g>
            ))}
            <text x={padding} y={height - 8} fontSize="10" fill="#6B7280">{data[0]?.bucket}</text>
            <text x={width - padding} y={height - 8} textAnchor="end" fontSize="10" fill="#6B7280">
              {data[data.length - 1]?.bucket}
            </text>
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 11, color: 'var(--pk-text-secondary)' }}>
            <span><b style={{ color: '#2563EB' }}>━</b> GMV</span>
            <span><b style={{ color: '#0D9488' }}>┄</b> Revenue</span>
            <span><b style={{ color: '#9CA3AF' }}>■</b> Order</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HealthBars({
  title,
  subtitle,
  data,
  series,
}: {
  title: string;
  subtitle: string;
  data: AnalyticsSummary['timeseries'];
  series: Array<{ key: keyof AnalyticsSummary['timeseries'][number]; label: string; color: string }>;
}) {
  const max = Math.max(
    1,
    ...data.map((point) => series.reduce((sum, item) => sum + Number(point[item.key] || 0), 0))
  );
  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>{subtitle}</div>
      {data.length === 0 ? <EmptyChart /> : (
        <>
          <div style={{ height: 170, display: 'flex', alignItems: 'flex-end', gap: 5, overflowX: 'auto' }}>
            {data.map((point) => (
              <div key={point.bucket} title={point.bucket} style={{ minWidth: 16, flex: 1, height: '100%', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-start' }}>
                {series.map((item) => {
                  const value = Number(point[item.key] || 0);
                  return (
                    <div
                      key={String(item.key)}
                      style={{ height: `${(value / max) * 100}%`, minHeight: value ? 3 : 0, background: item.color }}
                    >
                      <span className="sr-only">{item.label}: {value}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontSize: 11 }}>
            {series.map((item) => (
              <span key={String(item.key)}><b style={{ color: item.color }}>■</b> {item.label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function UserGrowthChart({ data }: { data: AnalyticsSummary['timeseries'] }) {
  return (
    <HealthBars
      title="Pertumbuhan Pengguna"
      subtitle="Buyer dan seller baru per bucket waktu"
      data={data}
      series={[
        { key: 'new_buyers', label: 'Buyer baru', color: '#2563EB' },
        { key: 'new_sellers', label: 'Seller baru', color: '#0D9488' },
      ]}
    />
  );
}

export function PulseHeatmap({ data }: { data: AnalyticsSummary['marketplace_pulse'] }) {
  const categories = [...new Set(data.map((item) => item.category))].slice(0, 6);
  const buckets = [...new Set(data.map((item) => item.bucket))].sort().slice(-14);
  const max = Math.max(1, ...data.map((item) => item.value));
  const lookup = new Map(data.map((item) => [`${item.category}::${item.bucket}`, item.value]));

  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff', overflow: 'hidden' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Marketplace Pulse</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>
        Intensitas unit terjual per kategori dan waktu
      </div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: Math.max(520, buckets.length * 38), display: 'grid', gridTemplateColumns: `120px repeat(${buckets.length}, 1fr)`, gap: 4, alignItems: 'center' }}>
            <span />
            {buckets.map((bucket) => <span key={bucket} style={{ fontSize: 9, color: 'var(--pk-text-hint)', writingMode: 'vertical-rl', height: 68 }}>{bucket}</span>)}
            {categories.flatMap((category) => [
              <span key={`${category}-label`} style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{category}</span>,
              ...buckets.map((bucket) => {
                const value = lookup.get(`${category}::${bucket}`) || 0;
                const opacity = value ? 0.15 + (value / max) * 0.85 : 0.04;
                return (
                  <div
                    key={`${category}-${bucket}`}
                    title={`${category}, ${bucket}: ${value} unit`}
                    style={{ height: 25, borderRadius: 4, background: `rgba(37,99,235,${opacity})` }}
                  />
                );
              }),
            ])}
          </div>
        </div>
      )}
    </div>
  );
}

export function FunnelChart({ data }: { data: AnalyticsSummary['transaction_funnel'] }) {
  const max = Math.max(1, data[0]?.count || 0);
  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Funnel Transaksi</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>
        Klik tahap melalui Action Center untuk melihat order terkait
      </div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((step, index) => {
            const pct = Math.round((step.count / max) * 100);
            return (
              <div key={step.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span>{index + 1}. {step.label}</span>
                  <strong>{step.count.toLocaleString('id-ID')} ({pct}%)</strong>
                </div>
                <div style={{ height: 12, borderRadius: 4, background: 'var(--pk-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: index < 2 ? '#2563EB' : '#0D9488' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#9CA3AF',
  paid: '#2563EB',
  shipped: '#0D9488',
  delivered: '#16A34A',
  payment_failed: '#DC2626',
};

export function StatusDonut({ data }: { data: AnalyticsSummary['orders_by_status'] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const gradient = data.reduce(
    (result, item) => {
      const end = result.total + item.pct;
      return {
        total: end,
        stops: [
          ...result.stops,
          `${STATUS_COLORS[item.key] || '#6B7280'} ${result.total}% ${end}%`,
        ],
      };
    },
    { total: 0, stops: [] as string[] }
  ).stops.join(', ');

  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Distribusi Status</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>
        Komposisi seluruh order pada periode
      </div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: `conic-gradient(${gradient})`,
            display: 'grid',
            placeItems: 'center',
          }}>
            <div style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
            }}>
              <div><strong style={{ fontSize: 22 }}>{total}</strong><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>order</span></div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180, display: 'grid', gap: 9 }}>
            {data.map((item) => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLORS[item.key] || '#6B7280' }} />
                  {item.key.replace('_', ' ')}
                </span>
                <strong>{item.count} ({item.pct}%)</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RankingBars({
  title,
  subtitle,
  data,
  valueKey,
}: {
  title: string;
  subtitle: string;
  data: Array<Record<string, string | number>>;
  valueKey: string;
}) {
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey] || 0)));
  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>{subtitle}</div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ display: 'grid', gap: 13 }}>
          {data.map((item, index) => {
            const label = String(item.name || item.category || '-');
            const value = Number(item[valueKey] || 0);
            return (
              <div key={`${label}-${index}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {label}</span>
                  <strong>{valueKey === 'gmv' ? formatIDR(value) : value.toLocaleString('id-ID')}</strong>
                </div>
                <div style={{ height: 8, background: 'var(--pk-bg-subtle)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: '#111827' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function IntegrationHealth({ data }: { data: AnalyticsSummary['integration_health'] }) {
  return (
    <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: 24, borderBottom: '1px solid var(--pk-border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Integration Health</div>
        <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
          Keberhasilan dan latency SmartBank, Gateway, serta LogistiKita
        </div>
      </div>
      {!data.available ? (
        <div style={{ padding: 24, color: 'var(--pk-text-secondary)', fontSize: 13 }}>
          {data.message}
        </div>
      ) : data.services.length === 0 ? (
        <div style={{ padding: 24, color: 'var(--pk-text-hint)' }}>Belum ada request integrasi pada periode ini.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                {['Service', 'Request', 'Success', 'Error', 'P50', 'P95'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '10px 18px', fontSize: 11, color: 'var(--pk-text-hint)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.services.map((service) => (
                <tr key={service.service} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '13px 18px', fontWeight: 600 }}>{service.service}</td>
                  <td style={{ padding: '13px 18px' }}>{service.total_requests}</td>
                  <td style={{ padding: '13px 18px', color: service.success_rate >= 95 ? 'var(--pk-success)' : 'var(--pk-warning)' }}>{service.success_rate}%</td>
                  <td style={{ padding: '13px 18px', color: service.errors ? 'var(--pk-danger)' : 'inherit' }}>{service.errors}</td>
                  <td style={{ padding: '13px 18px' }}>{service.latency_p50_ms ?? '-'} ms</td>
                  <td style={{ padding: '13px 18px' }}>{service.latency_p95_ms ?? '-'} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ActionCenter({
  data,
  detailed = false,
}: {
  data: AnalyticsSummary['action_center'];
  detailed?: boolean;
}) {
  const colors = { high: '#DC2626', medium: '#D97706', low: '#2563EB', ok: '#16A34A' };
  const urgency = { high: 'Mendesak', medium: 'Perlu ditinjau', low: 'Pantau', ok: 'Aman' };
  return (
    <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--pk-border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Action Center</div>
        <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>Masalah yang membutuhkan perhatian admin</div>
      </div>
      <div>
        {data.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            style={{
              display: detailed ? 'grid' : 'flex',
              gridTemplateColumns: detailed ? 'minmax(0, 1fr) auto' : undefined,
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              padding: '13px 24px',
              borderTop: '1px solid var(--pk-border)',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[item.severity], marginTop: 5, flexShrink: 0 }} />
              <span>
                <span style={{ fontWeight: 600 }}>{item.title}</span>
                {detailed && (
                  <>
                    <span style={{ display: 'block', marginTop: 4, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>
                      {item.description}
                    </span>
                    <span style={{ display: 'block', marginTop: 6, color: 'var(--pk-text-hint)', fontSize: 11 }}>
                      Pemilik: {item.owner} · Urgensi: {urgency[item.severity]}
                    </span>
                  </>
                )}
              </span>
            </span>
            <strong style={{ color: colors[item.severity], fontSize: detailed ? 20 : 13 }}>{item.count}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function formatSummaryValue(summary: AnalyticsSummary['summary'], key: SummaryKey) {
  const value = summary[key];
  if (['gmv', 'marketplace_revenue', 'average_order_value'].includes(key)) return formatIDR(value);
  if (key === 'payment_failure_rate') return `${value}%`;
  return value.toLocaleString('id-ID');
}

function EmptyChart() {
  return (
    <div style={{ minHeight: 120, display: 'grid', placeItems: 'center', color: 'var(--pk-text-hint)', fontSize: 13 }}>
      Belum ada data pada periode ini.
    </div>
  );
}
