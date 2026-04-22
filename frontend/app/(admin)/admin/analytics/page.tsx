'use client';

import { useState, useEffect } from 'react';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { api } from '@/lib/api';

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

const barColor: Record<string, string> = {
  paid: 'var(--pk-accent)',
  shipped: 'var(--pk-teal)',
  delivered: 'var(--pk-success)',
  pending: 'var(--pk-border-strong)',
  payment_failed: 'var(--pk-danger)',
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get('/admin/analytics');
        setData(res.data);
      } catch(err) {
        console.error("Gagal get analytics admin", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const m = data?.metrics || { total_orders: 0, total_revenue: 0, marketplace_fee: 0, new_users: 0 };
  const breakdown = data?.orders_by_status || [];
  const topProducts = data?.top_products || []; // We left this empty physically in backend, but will map if exist

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Performa marketplace keseluruhan</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 36, border: '1px solid var(--pk-border)', borderRadius: 8, background: '#fff', fontSize: 13 }}>
          <Icon name="clipboard" size={14} style={{ color: 'var(--pk-text-hint)' }} />
          <span>Keseluruhan Waktu</span>
          <Icon name="chevronDown" size={14} style={{ color: 'var(--pk-text-hint)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard label="Total Orders Transaksi" value={m.total_orders.toString()} loading={loading} />
        <MetricCard label="Total Revenue Transaksi" value={formatIDR(m.total_revenue)} loading={loading} />
        <MetricCard label="Revenue Admin (Fee)" value={formatIDR(m.marketplace_fee)} loading={loading} />
        <MetricCard label="Total Users" value={m.new_users.toString()} loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Order by Status</div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 20 }}>Distribusi order seluruh waktu</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!loading && breakdown.length === 0 && <div style={{ color: 'var(--pk-text-hint)' }}>Belum ada transaksi di platform.</div>}
            {breakdown.map((b: any) => (
              <div key={b.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={b.key} />
                    <span style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>{b.count.toLocaleString('id-ID')} order</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{b.pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--pk-bg-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${b.pct}%`, height: '100%', background: barColor[b.key] ?? 'var(--pk-border-strong)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pk-card" style={{ padding: 0, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: 24, paddingBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Top 5 Products</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Berdasarkan jumlah terjual (Membutuhkan complex query)</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                {['#', 'Produk', 'Terjual'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 2 ? 'right' : 'left', padding: '10px 24px', fontSize: 11, fontWeight: 500, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>{loading ? 'Memuat...' : 'Data belum tersedia (Backend RPC Required)'}</td></tr>
              )}
              {topProducts.map((t: any) => (
                <tr key={t.rank} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '14px 24px', width: 40 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: t.rank === 1 ? 'var(--pk-text)' : 'var(--pk-bg-subtle)',
                      color: t.rank === 1 ? '#fff' : 'var(--pk-text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                    }}>{t.rank}</div>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{t.seller}</div>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right', fontSize: 14, fontWeight: 500 }}>
                    {t.sold.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
