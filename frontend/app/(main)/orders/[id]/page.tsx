'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Icon from '@/components/pk/icon';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import RatingModal from '@/components/pk/rating-modal';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { ratingsApi } from '@/lib/api/ratings';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Order } from '@/types/api';

const STEPS_MAP: Record<string, number> = {
  pending: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
  payment_failed: -1,
};

const TRACKING_STATUS_LABEL: Record<string, string> = {
  created: 'Menunggu pickup',
  picked_up: 'Sudah diambil kurir',
  in_transit: 'Dalam perjalanan',
  delivered: 'Terkirim',
};

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 15 : 13, color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 17 : 14, color: 'var(--pk-text)', fontWeight: bold ? 600 : 500 }}>
        {value}
      </span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const [o, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    if (!id) return;
    ordersApi.getById(id as string)
      .then((res) => {
        const order = res.data.data;
        setOrder(order);
        if (order.tracking_id) {
          ordersApi.getTracking(id as string)
            .then((r) => setTrackingStatus(r.data.data?.status ?? null))
            .catch(() => null);
        }
      })
      .catch((err) => console.error('Gagal get order detail:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirmDelivered = async () => {
    if (!o) return;
    setConfirming(true);
    try {
      await ratingsApi.confirmDelivered(o.id);
      setOrder((prev) => prev ? { ...prev, status: 'delivered' } : prev);
      toast.success('Pesanan dikonfirmasi selesai!');
      // Tampilkan modal rating setelah konfirmasi
      setShowRating(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message ?? 'Gagal konfirmasi pesanan');
    } finally {
      setConfirming(false);
    }
  };

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
  const dateStr = new Date(o.created_at).toLocaleString('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const activeIdx = STEPS_MAP[o.status] ?? 0;

  const STEPS = [
    { label: 'Pending', date: dateStr },
    { label: 'Dibayar', date: o.status !== 'pending' ? dateStr : '-' },
    { label: 'Dikirim', date: activeIdx >= 2 ? (trackingStatus ? TRACKING_STATUS_LABEL[trackingStatus] ?? trackingStatus : 'Dalam pengiriman') : '-' },
    { label: 'Selesai', date: activeIdx >= 3 ? 'Pesanan diterima' : '-' },
  ];

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
      <Link href="/orders" style={{ fontSize: 13, color: 'var(--pk-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, textDecoration: 'none' }}>
        <Icon name="arrowLeft" size={14} /> Kembali ke Pesanan
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Order {o.id.slice(0, 8).toUpperCase()}
            </h1>
            <StatusBadge status={o.status} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>Dipesan {dateStr}</div>
        </div>
        {/* Tombol konfirmasi diterima — hanya buyer, hanya saat shipped */}
        {user?.role === 'buyer' && o.status === 'shipped' && (
          <button
            className="pk-btn pk-btn-primary"
            disabled={confirming}
            onClick={handleConfirmDelivered}
          >
            {confirming ? 'Memproses...' : 'Konfirmasi Pesanan Diterima'}
          </button>
        )}
        {/* Tombol beri ulasan — jika sudah delivered */}
        {user?.role === 'buyer' && o.status === 'delivered' && (
          <button
            className="pk-btn pk-btn-secondary"
            onClick={() => setShowRating(true)}
          >
            <Icon name="sparkle" size={14} /> Beri Ulasan
          </button>
        )}
      </div>

      {/* Progress stepper */}
      {o.status !== 'payment_failed' && (
        <div className="pk-card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {STEPS.map((s, i) => {
              const done = i <= activeIdx;
              const isLast = i === STEPS.length - 1;
              return (
                <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Placeholder label="item" height={56} style={{ width: 56, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.product_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                    Qty {it.qty} · {formatIDR(it.price_at_purchase)} per item
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(it.qty * it.price_at_purchase)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pengiriman */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pengiriman
            </div>
            <div style={{ fontSize: 13, color: 'var(--pk-text)', lineHeight: 1.55, marginBottom: 12 }}>
              {o.shipping_address}
            </div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 4 }}>Nomor Resi</div>
            {o.tracking_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pk-mono" style={{ color: 'var(--pk-text)', fontSize: 12 }}>{o.tracking_id}</span>
                {trackingStatus && (
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4,
                    background: trackingStatus === 'delivered' ? 'var(--pk-success-soft)' : 'var(--pk-accent-soft)',
                    color: trackingStatus === 'delivered' ? 'var(--pk-success)' : 'var(--pk-accent)',
                  }}>
                    {TRACKING_STATUS_LABEL[trackingStatus] ?? trackingStatus}
                  </span>
                )}
              </div>
            ) : (
              <span className="pk-mono" style={{ color: 'var(--pk-text-hint)' }}>Belum tersedia</span>
            )}
          </div>

          {/* Pembayaran */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Pembayaran
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Subtotal" value={formatIDR(o.subtotal)} />
              <Row label="Fee marketplace (2%)" value={formatIDR(o.fee_marketplace)} muted />
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(o.total)} bold />
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Order ID</div>
                <div className="pk-mono" style={{ fontSize: 11 }}>{o.id}</div>
              </div>
              {o.transaction_id && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Transaction ID</div>
                  <div className="pk-mono" style={{ fontSize: 11 }}>{o.transaction_id}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {showRating && o.items.length > 0 && (
        <RatingModal
          orderId={o.id}
          items={o.items}
          onClose={() => setShowRating(false)}
          onSubmitted={() => setShowRating(false)}
        />
      )}
    </div>
  );
}
