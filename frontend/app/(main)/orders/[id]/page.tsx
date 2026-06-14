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
import ComplaintPanel from './complaint-panel';

const STEPS_MAP: Record<string, number> = {
  pending: 0,
  paid: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
  payment_failed: -1,
};

const TRACKING_STATUS_LABEL: Record<string, string> = {
  created: 'Menunggu pickup',
  picked_up: 'Sudah diambil kurir',
  in_transit: 'Dalam perjalanan',
  delivered: 'Terkirim',
};
const TRACKING_STEPS = ['created', 'picked_up', 'in_transit', 'delivered'];

function TransparencyPanel({ order }: { order: Order }) {
  const paymentFailed = order.status === 'payment_failed';
  const paymentConfirmed = Boolean(order.transaction_id);
  const shippingConfirmed = Boolean(order.tracking_id);
  const nodes = [
    {
      name: 'PasarKita',
      state: 'Tercatat',
      detail: `Order dibuat ${new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}.`,
      tone: 'success',
    },
    {
      name: 'SmartBank',
      state: paymentFailed ? 'Pembayaran gagal' : paymentConfirmed ? 'Terkonfirmasi' : 'Menunggu bukti',
      detail: paymentFailed
        ? 'SmartBank menolak atau tidak menyelesaikan payment request.'
        : paymentConfirmed
          ? `Transaction ID ${order.transaction_id}.`
          : 'Transaction ID belum diterima oleh PasarKita.',
      tone: paymentFailed ? 'danger' : paymentConfirmed ? 'success' : 'warning',
    },
    {
      name: 'LogistiKita',
      state: shippingConfirmed ? 'Pengiriman terbentuk' : 'Belum terverifikasi',
      detail: shippingConfirmed
        ? `Tracking ID ${order.tracking_id}.`
        : paymentConfirmed
          ? 'Pembayaran tercatat, tetapi tracking ID belum tersedia.'
          : 'Pengiriman dibuat setelah pembayaran berhasil dikonfirmasi.',
      tone: shippingConfirmed ? 'success' : paymentConfirmed ? 'warning' : 'neutral',
    },
  ];

  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    success: { bg: 'var(--pk-success-soft)', text: 'var(--pk-success)', dot: 'var(--pk-success)' },
    warning: { bg: 'var(--pk-warning-soft)', text: 'var(--pk-warning)', dot: 'var(--pk-warning)' },
    danger: { bg: 'var(--pk-danger-soft)', text: 'var(--pk-danger)', dot: 'var(--pk-danger)' },
    neutral: { bg: 'var(--pk-bg-subtle)', text: 'var(--pk-text-secondary)', dot: 'var(--pk-border-strong)' },
  };

  return (
    <div className="pk-card" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pk-text-hint)' }}>
        Pusat Transparansi Pesanan
      </div>
      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.55, margin: '8px 0 18px' }}>
        Ringkasan ini hanya menampilkan bukti ID yang telah diterima PasarKita dari setiap layanan.
      </p>
      <div className="pk-store-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {nodes.map((node, index) => {
          const color = colors[node.tone];
          return (
            <div key={node.name} style={{ position: 'relative', padding: 16, border: '1px solid var(--pk-border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color.dot, flexShrink: 0 }} />
                <strong style={{ fontSize: 14 }}>{node.name}</strong>
                {index < nodes.length - 1 && (
                  <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--pk-text-hint)' }}>→</span>
                )}
              </div>
              <div style={{ display: 'inline-block', marginTop: 12, padding: '3px 8px', borderRadius: 999, background: color.bg, color: color.text, fontSize: 11, fontWeight: 600 }}>
                {node.state}
              </div>
              <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', lineHeight: 1.5, marginTop: 9, overflowWrap: 'anywhere' }}>
                {node.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [trackingUpdatedAt, setTrackingUpdatedAt] = useState<string | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    if (!id) return;
    ordersApi.getById(id as string)
      .then((res) => {
        const order = res.data.data;
        setOrder(order);
        if (order.tracking_id) {
          setTrackingLoading(true);
          ordersApi.getTracking(id as string)
            .then((r) => {
              setTrackingStatus(r.data.data?.status ?? null);
              setTrackingUpdatedAt(r.data.data?.updated_at ?? new Date().toISOString());
              setEstimatedDelivery(r.data.data?.estimated_delivery ?? null);
            })
            .catch(() => null)
            .finally(() => setTrackingLoading(false));
        }
      })
      .catch((err) => console.error('Gagal get order detail:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshTracking = async () => {
    if (!o?.tracking_id) return;
    setTrackingLoading(true);
    try {
      const response = await ordersApi.getTracking(o.id);
      setTrackingStatus(response.data.data?.status ?? null);
      setTrackingUpdatedAt(response.data.data?.updated_at ?? new Date().toISOString());
      setEstimatedDelivery(response.data.data?.estimated_delivery ?? null);
      toast.success('Status pengiriman diperbarui');
    } catch {
      toast.error('Status pengiriman gagal diperbarui');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!o) return;
    if (!window.confirm('Pastikan barang sudah diterima dalam kondisi baik. Tandai pesanan sebagai selesai?')) {
      return;
    }
    setConfirming(true);
    try {
      await ratingsApi.confirmDelivered(o.id);
      const refreshedOrder = await ordersApi.getById(o.id);
      setOrder(refreshedOrder.data.data);
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
  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin`);
  };

  const historyByStatus = new Map(
    (o.status_history ?? []).map((event) => [event.status, event])
  );
  const formatStatusTime = (status: Order['status'], fallback?: string) => {
    const value = historyByStatus.get(status)?.created_at ?? fallback;
    return value
      ? new Date(value).toLocaleString('id-ID', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
        })
      : '-';
  };
  const STEPS = [
    { label: 'Pending', date: formatStatusTime('pending', o.created_at) },
    { label: 'Dibayar', date: formatStatusTime('paid') },
    { label: 'Diproses', date: formatStatusTime('processing', o.processing_at ?? undefined) },
    { label: 'Dikirim', date: formatStatusTime('shipped') },
    { label: 'Selesai', date: formatStatusTime('delivered') },
  ];

  return (
    <div className="pk-page-shell" style={{ padding: '32px 80px 64px', maxWidth: 1100, marginInline: 'auto' }}>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="pk-btn pk-btn-secondary" onClick={() => window.print()}>
            <Icon name="clipboard" size={14} /> Cetak Invoice
          </button>
          {/* Tombol batal pesanan — hanya buyer, hanya saat pending */}
          {user?.role === 'buyer' && o.status === 'pending' && (
            <button
              className="pk-btn pk-btn-ghost"
              style={{ color: 'var(--pk-danger)' }}
              disabled={confirming}
              onClick={async () => {
                if (!window.confirm('Yakin ingin membatalkan pesanan ini? Stok akan dikembalikan.')) return;
                setConfirming(true);
                try {
                  await ordersApi.cancel(o.id);
                  const refreshed = await ordersApi.getById(o.id);
                  setOrder(refreshed.data.data);
                  toast.success('Pesanan berhasil dibatalkan');
                } catch (e: unknown) {
                  const error = e as { response?: { data?: { message?: string } } };
                  toast.error(error.response?.data?.message || 'Gagal membatalkan pesanan');
                } finally {
                  setConfirming(false);
                }
              }}
            >
              Batalkan Pesanan
            </button>
          )}
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

      {o.status === 'payment_failed' && (
        <div className="pk-card" style={{ padding: 20, marginBottom: 24, borderColor: 'var(--pk-danger)' }}>
          <div style={{ fontWeight: 600, color: 'var(--pk-danger)' }}>Pembayaran gagal</div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 5 }}>
            Tercatat {formatStatusTime('payment_failed')}. Stok yang direservasi telah dikembalikan.
          </div>
        </div>
      )}

      <TransparencyPanel order={o} />
      
      <ComplaintPanel order={o} userRole={user?.role} />

      <div className="pk-order-detail-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, marginTop: 24 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pengiriman
              </div>
              {o.tracking_id && (
                <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={() => void refreshTracking()} disabled={trackingLoading}>
                  {trackingLoading ? 'Memuat...' : 'Refresh'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--pk-text)', lineHeight: 1.55, marginBottom: 12 }}>
              {o.shipping_address}
            </div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 4 }}>Nomor Resi</div>
            {o.tracking_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pk-mono" style={{ color: 'var(--pk-text)', fontSize: 12 }}>{o.tracking_id}</span>
                <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={() => void copyValue('Nomor resi', o.tracking_id as string)}>
                  Salin
                </button>
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
              <div style={{ padding: 10, borderRadius: 8, background: o.status === 'paid' ? 'var(--pk-warning-soft)' : 'var(--pk-bg-subtle)', color: o.status === 'paid' ? 'var(--pk-warning)' : 'var(--pk-text-hint)', fontSize: 12 }}>
                {o.status === 'paid'
                  ? 'Pembayaran berhasil, tetapi pengiriman belum terbentuk. Admin perlu memeriksa integrasi LogistiKita.'
                  : 'Nomor tracking belum tersedia.'}
              </div>
            )}

            {trackingStatus && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TRACKING_STEPS.map((status, index) => {
                  const currentIndex = TRACKING_STEPS.indexOf(trackingStatus);
                  const reached = index <= currentIndex;
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: reached ? 'var(--pk-text)' : 'var(--pk-text-hint)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: reached ? 'var(--pk-success)' : 'var(--pk-border-strong)', flexShrink: 0 }} />
                      {TRACKING_STATUS_LABEL[status]}
                    </div>
                  );
                })}
                {trackingUpdatedAt && (
                  <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 4 }}>
                    Terakhir diperiksa {new Date(trackingUpdatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
                {estimatedDelivery && (
                  <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)' }}>
                    Estimasi tiba {new Date(estimatedDelivery).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
              </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="pk-mono" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{o.id}</div>
                  <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={() => void copyValue('Order ID', o.id)}>Salin</button>
                </div>
              </div>
              {o.transaction_id && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 2 }}>Transaction ID</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="pk-mono" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{o.transaction_id}</div>
                    <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={() => void copyValue('Transaction ID', o.transaction_id as string)}>Salin</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {o.status === 'delivered' && items[0] && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Link href={`/products/${items[0].product_id}`} className="pk-btn pk-btn-primary">
            Beli Lagi
          </Link>
        </div>
      )}

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
