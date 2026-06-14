'use client';

import Link from 'next/link';
import { formatIDR } from '@/lib/format';
import type { SellerAnalytics } from '@/types/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#9CA3AF',
  paid: '#2563EB',
  processing: '#7C3AED',
  shipped: '#0D9488',
  delivered: '#16A34A',
  payment_failed: '#DC2626',
};

function EmptyChart({ text = 'Belum ada data pada periode ini.' }: { text?: string }) {
  return (
    <div style={{ minHeight: 160, display: 'grid', placeItems: 'center', color: 'var(--pk-text-hint)', fontSize: 13, textAlign: 'center' }}>
      {text}
    </div>
  );
}

export function SellerTrendChart({ data }: { data: SellerAnalytics['timeseries'] }) {
  const width = 720;
  const height = 240;
  const padding = 38;
  const maxValue = Math.max(1, ...data.map((point) => Math.max(point.gross_sales, point.estimated_net)));
  const maxOrders = Math.max(1, ...data.map((point) => point.orders));
  const points = data.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, data.length - 1);
    const grossY = height - padding - (point.gross_sales / maxValue) * (height - padding * 2);
    const netY = height - padding - (point.estimated_net / maxValue) * (height - padding * 2);
    return { ...point, x, grossY, netY };
  });
  const grossPath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.grossY}`).join(' ');
  const netPath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.netY}`).join(' ');

  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Tren Omzet dan Order</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>
        Hanya item toko Anda dari order dengan pembayaran sukses
      </div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik tren omzet seller" style={{ width: '100%', minWidth: 560 }}>
            {[0, 0.5, 1].map((ratio) => {
              const y = height - padding - ratio * (height - padding * 2);
              return (
                <g key={ratio}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E7EB" />
                  <text x={padding - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6B7280">
                    {new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(maxValue * ratio)}
                  </text>
                </g>
              );
            })}
            {points.map((point) => {
              const barHeight = (point.orders / maxOrders) * (height - padding * 2);
              return (
                <rect key={point.bucket} x={point.x - 7} y={height - padding - barHeight} width="14" height={barHeight} rx="3" fill="rgba(17,24,39,0.12)">
                  <title>{`${point.bucket}: ${point.orders} order`}</title>
                </rect>
              );
            })}
            <path d={grossPath} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinejoin="round" />
            <path d={netPath} fill="none" stroke="#0D9488" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
            {points.map((point) => (
              <circle key={`point-${point.bucket}`} cx={point.x} cy={point.grossY} r="4" fill="#2563EB">
                <title>{`${point.bucket}: omzet ${formatIDR(point.gross_sales)}, bersih ${formatIDR(point.estimated_net)}`}</title>
              </circle>
            ))}
            <text x={padding} y={height - 8} fontSize="10" fill="#6B7280">{data[0]?.bucket}</text>
            <text x={width - padding} y={height - 8} textAnchor="end" fontSize="10" fill="#6B7280">{data[data.length - 1]?.bucket}</text>
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 11, color: 'var(--pk-text-secondary)' }}>
            <span style={{ color: '#2563EB' }}>━ Omzet kotor</span>
            <span style={{ color: '#0D9488' }}>┄ Estimasi bersih</span>
            <span style={{ color: '#6B7280' }}>■ Order</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SellerStatusDonut({ data }: { data: SellerAnalytics['orders_by_status'] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const gradient = data.reduce(
    (result, item) => {
      const end = result.total + item.pct;
      return {
        total: end,
        stops: [...result.stops, `${STATUS_COLORS[item.key] || '#6B7280'} ${result.total}% ${end}%`],
      };
    },
    { total: 0, stops: [] as string[] }
  ).stops.join(', ');

  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Status Order Toko</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>Komposisi order pada periode terpilih</div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 140, height: 140, borderRadius: '50%', background: `conic-gradient(${gradient})`, display: 'grid', placeItems: 'center' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div><strong style={{ fontSize: 22 }}>{total}</strong><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>order</span></div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 170, display: 'grid', gap: 9 }}>
            {data.map((item) => (
              <Link key={item.key} href="/seller/orders" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'inherit', textDecoration: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLORS[item.key] }} />
                  {item.key.replace('_', ' ')}
                </span>
                <strong>{item.count} ({item.pct}%)</strong>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SellerTopProducts({ data }: { data: SellerAnalytics['top_products'] }) {
  const max = Math.max(1, ...data.map((item) => item.sold));
  return (
    <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Produk Terlaris</div>
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 18px' }}>Berdasarkan unit dari pembayaran sukses</div>
      {data.length === 0 ? <EmptyChart /> : (
        <div style={{ display: 'grid', gap: 13 }}>
          {data.map((item, index) => (
            <Link key={item.product_id} href={`/seller/products/edit/${item.product_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {item.name}</span>
                <strong>{item.sold} unit</strong>
              </div>
              <div style={{ height: 8, background: 'var(--pk-bg-subtle)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${(item.sold / max) * 100}%`, height: '100%', background: '#111827' }} />
              </div>
              <div style={{ marginTop: 4, textAlign: 'right', fontSize: 10, color: 'var(--pk-text-hint)' }}>{formatIDR(item.gross_sales)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CriticalStockTable({ data }: { data: SellerAnalytics['critical_stock'] }) {
  return (
    <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Stok Kritis</div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 3 }}>Produk yang perlu segera ditindaklanjuti</div>
        </div>
        <Link href="/seller/products" style={{ fontSize: 12, color: 'var(--pk-accent)', textDecoration: 'none' }}>Kelola produk</Link>
      </div>
      {data.length === 0 ? <EmptyChart text="Tidak ada stok kritis. Kondisi inventori aman." /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Produk', 'Stok', 'Batas', 'Tindakan'].map((heading) => <th key={heading} style={{ textAlign: heading === 'Tindakan' ? 'right' : 'left', padding: '10px 18px', fontSize: 11, color: 'var(--pk-text-hint)' }}>{heading}</th>)}</tr></thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '12px 18px', color: item.status === 'out' ? 'var(--pk-danger)' : '#b45309', fontWeight: 700 }}>{item.stock}</td>
                  <td style={{ padding: '12px 18px', fontSize: 13 }}>{item.minimum_stock}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}><Link href={`/seller/products/edit/${item.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>Update stok</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
