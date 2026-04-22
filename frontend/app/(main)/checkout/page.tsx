'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/pk/icon';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';

const ORDER_ITEMS = [
  { name: 'Kopi Arabika Gayo 250g', qty: 2, price: 89000 },
  { name: 'Madu Hutan Flores 500ml', qty: 1, price: 125000 },
];

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'pk-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 15 : 13, color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, color: 'var(--pk-text)', fontWeight: bold ? 600 : 500 }}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sub = ORDER_ITEMS.reduce((s, i) => s + i.qty * i.price, 0);
  const fee = Math.round(sub * 0.02);

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/orders');
    }, 2000);
  };

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1200, marginInline: 'auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 32px' }}>
        Checkout
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 32 }}>
        {/* Left: Summary */}
        <div>
          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Ringkasan Pesanan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ORDER_ITEMS.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Placeholder label="item" height={64} style={{ width: 64, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                      Qty {it.qty} × {formatIDR(it.price)}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(it.qty * it.price)}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--pk-border)', margin: '20px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Subtotal" value={formatIDR(sub)} />
              <Row label="Fee marketplace (2%)" value={formatIDR(fee)} muted />
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(sub + fee)} bold />
            </div>
          </div>
        </div>

        {/* Right: Shipping & payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Alamat Pengiriman
            </div>
            <label className="pk-label">Nama penerima</label>
            <input className="pk-input" defaultValue="Rani Kusuma" style={{ marginBottom: 14 }} />
            <label className="pk-label">Alamat lengkap</label>
            <textarea
              className="pk-textarea"
              rows={4}
              defaultValue="Jl. Kemang Raya No. 42, RT 03/RW 04, Bangka, Mampang Prapatan, Jakarta Selatan, 12730"
            />
            <label className="pk-label" style={{ marginTop: 14 }}>No. Telepon</label>
            <input className="pk-input" defaultValue="+62 812-3456-7890" />
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Pembayaran
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1.5px solid var(--pk-text)', borderRadius: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--pk-text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11 }}>
                SB
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>SmartBank Transfer</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Otomatis · Dana ditahan sampai barang diterima</div>
              </div>
              <Icon name="check" size={16} stroke={2.5} />
            </div>
            <div style={{ background: 'var(--pk-accent-soft)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '10px 12px', marginTop: 16, fontSize: 12, color: 'var(--pk-accent)', display: 'flex', gap: 8 }}>
              <Icon name="bell" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>Anda akan diarahkan ke SmartBank untuk menyelesaikan pembayaran. Transaksi aman dengan escrow.</div>
            </div>
          </div>

          <button
            className="pk-btn pk-btn-primary pk-btn-lg pk-btn-block"
            disabled={loading}
            onClick={handlePay}
          >
            {loading ? (
              <>
                <Spinner /> Memproses...
              </>
            ) : (
              `Bayar ${formatIDR(sub + fee)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
