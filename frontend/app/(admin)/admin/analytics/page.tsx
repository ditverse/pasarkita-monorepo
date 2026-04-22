import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';

const BREAKDOWN = [
  { key: 'paid', label: 'Dibayar', count: 842, pct: 47 },
  { key: 'shipped', label: 'Dikirim', count: 401, pct: 23 },
  { key: 'delivered', label: 'Selesai', count: 389, pct: 22 },
  { key: 'pending', label: 'Pending', count: 84, pct: 5 },
  { key: 'payment_failed', label: 'Gagal', count: 48, pct: 3 },
];

const TOP_PRODUCTS = [
  { rank: 1, name: 'Kopi Arabika Gayo 250g', seller: 'Kopi Rakyat', sold: 1284 },
  { rank: 2, name: 'Batik Tulis Pekalongan', seller: 'Batik Nusantara', sold: 892 },
  { rank: 3, name: 'Keripik Singkong Balado', seller: 'Warung Bu Sari', sold: 714 },
  { rank: 4, name: 'Tas Rotan Handwoven', seller: 'Kriya Bali', sold: 548 },
  { rank: 5, name: 'Madu Hutan Flores 500ml', seller: 'Kopi Rakyat', sold: 411 },
];

function MetricCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
      <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
      {delta && <div style={{ fontSize: 12, color: 'var(--pk-success)', marginTop: 10 }}>{delta}</div>}
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
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Performa marketplace keseluruhan</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 36, border: '1px solid var(--pk-border)', borderRadius: 8, background: '#fff', fontSize: 13 }}>
          <Icon name="clipboard" size={14} style={{ color: 'var(--pk-text-hint)' }} />
          <span>1 Apr – 22 Apr 2026</span>
          <Icon name="chevronDown" size={14} style={{ color: 'var(--pk-text-hint)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard label="Total Orders" value="1.764" delta="+14.2% MoM" />
        <MetricCard label="Revenue" value="Rp 484M" delta="+18.7% MoM" />
        <MetricCard label="Fee Marketplace" value="Rp 9,68M" delta="+18.7% MoM" />
        <MetricCard label="New Users" value="2.109" delta="+6.4% MoM" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="pk-card" style={{ padding: 24, background: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Order by Status</div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 20 }}>Distribusi order 30 hari terakhir</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BREAKDOWN.map((b) => (
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
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Berdasarkan jumlah terjual</div>
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
              {TOP_PRODUCTS.map((t) => (
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
