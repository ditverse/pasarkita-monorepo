'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Icon from '@/components/pk/icon';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';
import { api } from '@/lib/api';

const STEPS_MAP: Record<string, number> = {
  pending: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
  payment_failed: -1
};

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 15 : 13, color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, color: 'var(--pk-text)', fontWeight: bold ? 600 : 500 }}>{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [o, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.data || res.data); // Support both nested data or flat
      } catch (err) {
        console.error("Gagal get order detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat detail pesanan...</div>;
  }

  if (!o) {
    return (
      <div style={{ padding: '64px', textAlign: 'center' }}>
        <h2>Pesanan tidak ditemukan.</h2>
        <Link href="/orders"><button className="pk-btn pk-btn-primary">Kembali ke Daftar</button></Link>
      </div>
    );
  }

  const items = o.items || [];
  const sub = items.reduce((s: number, i: any) => s + (i.quantity * i.price_at_time), 0);
  const fee = o.app_fee || Math.round(sub * 0.02);
  const dateStr = new Date(o.created_at).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });

  const activeIdx = STEPS_MAP[o.status] ?? 0;
  
  const STEPS = [
    { label: 'Pending', date: dateStr },
    { label: 'Dibayar', date: o.status !== 'pending' ? dateStr : '-' },
    { label: 'Dikirim', date: activeIdx >= 2 ? 'Lacak via resi' : '-' },
    { label: 'Selesai', date: activeIdx >= 3 ? 'Pesanan diterima' : '-' },
  ];

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
      <Link href="/orders" style={{ fontSize: 13, color: 'var(--pk-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, textDecoration: 'none' }}>
        <Icon name="arrowLeft" size={14} /> Kembali ke Pesanan
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Order {o.id.split('-').shift()?.toUpperCase()}
            </h1>
            <StatusBadge status={o.status} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>Dipesan {dateStr}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pk-btn pk-btn-secondary pk-btn-sm">Hubungi Seller</button>
          <button className="pk-btn pk-btn-primary pk-btn-sm" disabled={activeIdx < 2}>Lacak Paket</button>
        </div>
      </div>

      {o.status !== 'cancelled' && o.status !== 'payment_failed' && (
        <div className="pk-card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {STEPS.map((s, i) => {
              const done = i <= activeIdx;
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
                      {i < activeIdx ? <Icon name="check" size={14} stroke={3} /> : i + 1}
                    </div>
                    {!isLast && (
                      <div style={{ flex: 1, height: 2, background: i < activeIdx ? 'var(--pk-text)' : 'var(--pk-border)', marginInline: 4 }} />
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
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Items */}
        <div className="pk-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Item Pesanan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((it: any, i: number) => (
              <div key={it.id || i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.product?.name || "Produk Dihapus"}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                    Qty {it.quantity} · {formatIDR(it.price_at_time)} per item
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(it.quantity * it.price_at_time)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pengiriman
            </div>
            <div style={{ fontSize: 13, color: 'var(--pk-text)', lineHeight: 1.55, marginBottom: 8 }}>{o.shipping_address}</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Resi pengiriman</div>
            <div className="pk-mono" style={{ color: 'var(--pk-text-hint)' }}>Belum tersedia</div>
          </div>

          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pembayaran
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Subtotal" value={formatIDR(sub)} />
              <Row label="Ongkos Kirim" value={formatIDR(o.shipping_fee)} />
              <Row label="Fee marketplace" value={formatIDR(fee)} muted />
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(o.total_amount)} bold />
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pk-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Order ID</div>
              <div className="pk-mono" style={{ fontSize: 11 }}>{o.id}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
