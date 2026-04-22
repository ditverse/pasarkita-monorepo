import Link from 'next/link';
import Icon from '@/components/pk/icon';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';

const ORDER = {
  id: 'PK-2048-A9F2',
  date: '21 Apr 2026',
  items: [
    { name: 'Kopi Arabika Gayo 250g', qty: 2, price: 89000 },
    { name: 'Madu Hutan Flores 500ml', qty: 1, price: 125000 },
  ],
  total: 303000,
  status: 'shipped',
  tracking: 'JNE-29817726',
  address: 'Jl. Kemang Raya No. 42, Jakarta Selatan, 12730',
};

const STEPS = [
  { label: 'Pending', date: '21 Apr · 09:12' },
  { label: 'Dibayar', date: '21 Apr · 09:14' },
  { label: 'Dikirim', date: '21 Apr · 15:40' },
  { label: 'Selesai', date: 'Estimasi 24 Apr' },
];
const ACTIVE_IDX = 2;

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 15 : 13, color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, color: 'var(--pk-text)', fontWeight: bold ? 600 : 500 }}>{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const o = ORDER;
  const sub = o.items.reduce((s, i) => s + i.qty * i.price, 0);
  const fee = Math.round(sub * 0.02);

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
      <Link href="/orders" style={{ fontSize: 13, color: 'var(--pk-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, textDecoration: 'none' }}>
        <Icon name="arrowLeft" size={14} /> Kembali ke Pesanan
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Order {o.id}
            </h1>
            <StatusBadge status={o.status} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>Dipesan {o.date}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pk-btn pk-btn-secondary pk-btn-sm">Hubungi Seller</button>
          <button className="pk-btn pk-btn-primary pk-btn-sm">Lacak Paket</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="pk-card" style={{ padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
          {STEPS.map((s, i) => {
            const done = i <= ACTIVE_IDX;
            const isLast = i === STEPS.length - 1;
            return (
              <div key={s.label} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: done ? 'var(--pk-text)' : '#fff',
                    border: done ? 'none' : '1.5px solid var(--pk-border-strong)',
                    color: done ? '#fff' : 'var(--pk-text-hint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, flexShrink: 0, zIndex: 1,
                  }}>
                    {i < ACTIVE_IDX ? <Icon name="check" size={14} stroke={3} /> : i + 1}
                  </div>
                  {!isLast && (
                    <div style={{ flex: 1, height: 2, background: i < ACTIVE_IDX ? 'var(--pk-text)' : 'var(--pk-border)', marginInline: 4 }} />
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: done ? 'var(--pk-text)' : 'var(--pk-text-hint)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>{s.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Items */}
        <div className="pk-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Item Pesanan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {o.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                    Qty {it.qty} · {formatIDR(it.price)} per item
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(it.qty * it.price)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pengiriman
            </div>
            <div style={{ fontSize: 13, color: 'var(--pk-text)', lineHeight: 1.55, marginBottom: 8 }}>{o.address}</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Resi pengiriman</div>
            <div className="pk-mono" style={{ color: 'var(--pk-accent)' }}>{o.tracking}</div>
          </div>

          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pembayaran
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Subtotal" value={formatIDR(sub)} />
              <Row label="Fee marketplace (2%)" value={formatIDR(fee)} muted />
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(sub + fee)} bold />
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pk-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Transaction ID</div>
              <div className="pk-mono" style={{ fontSize: 11 }}>txn_3NkP9a2DfGh8XzL4mKq7rVb</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
