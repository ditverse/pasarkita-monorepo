import StatusBadge from '@/components/pk/status-badge';
import { formatIDR } from '@/lib/format';

const ORDERS = [
  { id: 'PK-2048-A9F2', date: '21 Apr 2026', total: 303000, status: 'shipped', seller: 'Kopi Rakyat' },
  { id: 'PK-2047-B1C4', date: '20 Apr 2026', total: 290700, status: 'paid', seller: 'Batik Nusantara' },
  { id: 'PK-2045-K7M1', date: '18 Apr 2026', total: 75480, status: 'delivered', seller: 'Warung Bu Sari' },
  { id: 'PK-2041-Z8N3', date: '16 Apr 2026', total: 147900, status: 'pending', seller: 'Kriya Bali' },
  { id: 'PK-2039-Q3R8', date: '14 Apr 2026', total: 224400, status: 'payment_failed', seller: 'Toko Elektro ID' },
];

function MetricCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
      <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, color: 'var(--pk-success)', marginTop: 10 }}>
          {delta}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Overview</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Data per 22 April 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="pk-select" style={{ width: 160, height: 36, fontSize: 13 }} defaultValue="7">
            <option value="1">Hari ini</option>
            <option value="7">7 hari terakhir</option>
            <option value="30">30 hari terakhir</option>
            <option value="90">90 hari terakhir</option>
          </select>
          <button className="pk-btn pk-btn-secondary pk-btn-sm">Export CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard label="Total User" value="48.219" delta="+2.3% vs minggu lalu" />
        <MetricCard label="Total Produk" value="128.450" delta="+5.1% vs minggu lalu" />
        <MetricCard label="Order Hari Ini" value="1.284" delta="+12% vs kemarin" />
        <MetricCard label="Revenue Total" value="Rp 2,4M" delta="+8.7% vs minggu lalu" />
      </div>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Order Terbaru</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>5 order terakhir</div>
          </div>
          <a style={{ fontSize: 13, color: 'var(--pk-accent)', cursor: 'pointer' }}>Lihat semua →</a>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Order ID', 'Pembeli', 'Seller', 'Total', 'Status', 'Tanggal'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 24px', fontSize: 12, fontWeight: 500, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDERS.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '14px 24px' }}>
                  <span className="pk-mono" style={{ color: 'var(--pk-text)' }}>{o.id}</span>
                </td>
                <td style={{ padding: '14px 24px', fontSize: 13 }}>Rani Kusuma</td>
                <td style={{ padding: '14px 24px', fontSize: 13 }}>{o.seller}</td>
                <td style={{ padding: '14px 24px', fontSize: 13, fontWeight: 500 }}>{formatIDR(o.total)}</td>
                <td style={{ padding: '14px 24px' }}><StatusBadge status={o.status} /></td>
                <td style={{ padding: '14px 24px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>{o.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
