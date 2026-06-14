'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { sellerApi } from '@/lib/api/seller';
import { useAuthStore } from '@/store/auth';
import { getApiErrorMessage } from '@/lib/api-error';
import type { Order } from '@/types/api';

function CopyButton({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} berhasil disalin`);
    } catch {
      toast.error(`Gagal menyalin ${label.toLowerCase()}`);
    }
  };
  return (
    <button
      type="button"
      className="pk-btn pk-btn-secondary pk-btn-sm"
      onClick={copy}
      title={`Salin ${label.toLowerCase()}`}
      style={{ minHeight: 28, padding: '3px 10px', fontSize: 12, gap: 5 }}
    >
      <Icon name="clipboard" size={12} />
      {label}
    </button>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--pk-border)', alignItems: 'flex-start' }}>
      <span style={{ minWidth: 160, fontSize: 13, color: 'var(--pk-text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-all', fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </span>
    </div>
  );
}

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Menunggu Pembayaran',
  paid: 'Perlu Diproses',
  processing: 'Sedang Dikemas',
  shipped: 'Sedang Dikirim',
  delivered: 'Selesai',
  payment_failed: 'Pembayaran Gagal',
  cancelled: 'Dibatalkan',
};

const STATUS_COLOR: Record<Order['status'], string> = {
  pending: '#6b7280',
  paid: '#d97706',
  processing: '#2563eb',
  shipped: '#7c3aed',
  delivered: '#059669',
  payment_failed: '#dc2626',
  cancelled: '#dc2626',
};

export default function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: async () => (await ordersApi.getById(id)).data.data,
    enabled: Boolean(id && user),
  });

  const profileQuery = useQuery({
    queryKey: ['seller', 'profile'],
    queryFn: async () => (await sellerApi.getProfile()).data.data,
    enabled: Boolean(user),
  });

  const startProcessingMutation = useMutation({
    mutationFn: ({ orderId, pickupAddress }: { orderId: string; pickupAddress: string }) =>
      ordersApi.startProcessing(orderId, pickupAddress),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] }),
  });

  const markShippedMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.ship(orderId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] }),
  });

  const retryShippingMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.retryShipping(orderId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] }),
  });

  const handleStartProcessing = async (order: Order) => {
    if (!order.seller_can_process) {
      toast.error(order.seller_action_reason || 'Pesanan belum dapat diproses');
      return;
    }
    const pickupAddress = window
      .prompt('Konfirmasi alamat pickup untuk pesanan ini:', profileQuery.data?.pickup_address || '')
      ?.trim();
    if (!pickupAddress) return;
    if (pickupAddress.length < 10) {
      toast.error('Alamat pickup minimal 10 karakter');
      return;
    }
    setIsProcessing(true);
    try {
      await startProcessingMutation.mutateAsync({ orderId: order.id, pickupAddress });
      toast.success('Pesanan mulai diproses. Siapkan barang dan packing list.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal memulai proses pesanan'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkShipped = async (order: Order) => {
    if (!order.seller_can_ship) {
      toast.error(order.seller_action_reason || 'Pesanan belum dapat ditandai dikirim');
      return;
    }
    if (!window.confirm(`Tandai order ${order.id.slice(0, 8).toUpperCase()} sebagai sudah dikirim?`)) return;
    setIsProcessing(true);
    try {
      await markShippedMutation.mutateAsync(order.id);
      toast.success('Pesanan ditandai sebagai dikirim');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal memperbarui status pesanan'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryShipping = async (order: Order) => {
    setIsProcessing(true);
    try {
      await retryShippingMutation.mutateAsync(order.id);
      toast.success('Sinkronisasi LogistiKita berhasil');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Sinkronisasi LogistiKita masih gagal'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (orderQuery.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
        Memuat detail order...
      </div>
    );
  }

  // Error state
  if (orderQuery.isError) {
    return (
      <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ color: 'var(--pk-danger)', marginBottom: 12 }}>Gagal memuat detail order.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            className="pk-btn pk-btn-secondary pk-btn-sm"
            onClick={() => void orderQuery.refetch()}
          >
            Coba Lagi
          </button>
          <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => router.back()}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const order = orderQuery.data;
  if (!order) return null;

  const shortId = order.id.slice(0, 8).toUpperCase();
  const statusColor = STATUS_COLOR[order.status] ?? '#6b7280';
  const itemSubtotal = order.items.reduce((sum, item) => sum + item.qty * item.price_at_purchase, 0);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--pk-text-secondary)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
              }}
            >
              <Icon name="chevronLeft" size={16} />
              Kembali
            </button>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Order{' '}
            <span className="pk-mono" style={{ color: 'var(--pk-accent)' }}>
              {shortId}
            </span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>
              {new Date(order.created_at).toLocaleString('id-ID', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'Asia/Jakarta',
              })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['processing', 'shipped', 'delivered'].includes(order.status) && (
            <Link
              href={`/seller/orders/${order.id}/packing-list`}
              className="pk-btn pk-btn-secondary pk-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <Icon name="printer" size={14} />
              Packing List
            </Link>
          )}
          {order.status === 'paid' && (
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              disabled={!order.seller_can_process || isProcessing}
              title={order.seller_action_reason || 'Konfirmasi pickup dan mulai siapkan pesanan'}
              onClick={() => void handleStartProcessing(order)}
            >
              {isProcessing ? 'Memproses...' : 'Mulai Proses'}
            </button>
          )}
          {order.status === 'processing' && (
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              disabled={!order.seller_can_ship || isProcessing}
              title={order.seller_action_reason || 'Sinkronkan dan tandai pesanan sebagai dikirim'}
              onClick={() => void handleMarkShipped(order)}
            >
              {isProcessing ? 'Menyinkronkan...' : 'Serahkan ke Kurir'}
            </button>
          )}
          {order.status === 'processing' && order.shipping_sync_status === 'failed' && (
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              disabled={isProcessing}
              onClick={() => void handleRetryShipping(order)}
            >
              Retry Logistik
            </button>
          )}
        </div>
      </div>

      {/* Alasan disabled */}
      {!order.seller_can_process && !order.seller_can_ship && order.seller_action_reason && (
        <div
          role="alert"
          style={{
            background: 'var(--pk-warning-soft, #fffbeb)',
            border: '1px solid #fbbf24',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            color: '#92400e',
            marginBottom: 16,
          }}
        >
          {order.seller_action_reason}
        </div>
      )}

      {/* Error sinkronisasi */}
      {order.shipping_sync_status === 'failed' && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid var(--pk-danger)',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            color: 'var(--pk-danger)',
            marginBottom: 16,
          }}
        >
          Sinkronisasi pengiriman gagal: {order.shipping_sync_error || 'LogistiKita tidak merespons'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 18 }}>
        {/* Ringkasan status + ID */}
        <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--pk-text-hint)',
              marginBottom: 14,
            }}
          >
            Informasi Order
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <CopyButton label="Order ID" value={order.id} />
            <CopyButton label="Transaksi" value={order.transaction_id} />
            <CopyButton label="Resi" value={order.tracking_id} />
            <CopyButton label="Alamat" value={order.shipping_address} />
          </div>
          <InfoRow label="Status" value={STATUS_LABEL[order.status]} />
          <InfoRow label="Order ID" value={order.id} mono />
          <InfoRow label="Transaksi SmartBank" value={order.transaction_id ?? '-'} mono />
          <InfoRow label="Nomor Resi" value={order.tracking_id ?? 'Belum tersedia'} mono />
          <InfoRow label="Tanggal Order" value={new Date(order.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} />
          {order.processing_at && (
            <InfoRow
              label="Mulai Diproses"
              value={new Date(order.processing_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
            />
          )}
          {order.shipped_at && (
            <InfoRow
              label="Diserahkan ke Kurir"
              value={new Date(order.shipped_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
            />
          )}
          {order.pickup_address_snapshot && (
            <InfoRow label="Alamat Pickup" value={order.pickup_address_snapshot} />
          )}
        </div>

        {/* Pembeli + Pengiriman */}
        <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--pk-text-hint)',
              marginBottom: 14,
            }}
          >
            Pembeli &amp; Pengiriman
          </div>
          <InfoRow label="Nama Pembeli" value={order.buyer?.name ?? 'Tidak tersedia'} />
          <InfoRow label="Alamat Pengiriman" value={order.shipping_address} />
        </div>

        {/* Item produk */}
        <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--pk-text-hint)',
              marginBottom: 14,
            }}
          >
            Item Produk Toko Anda ({order.items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {order.items.map((item, idx) => (
              <div
                key={`${item.product_id}-${idx}`}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  paddingBottom: idx < order.items.length - 1 ? 14 : 0,
                  borderBottom: idx < order.items.length - 1 ? '1px solid var(--pk-border)' : 'none',
                }}
              >
                <ProductImage
                  src={null}
                  alt={item.product_name}
                  height={52}
                  style={{ width: 52, borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.product_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>
                    {item.qty} pcs &times; {formatIDR(item.price_at_purchase)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {formatIDR(item.qty * item.price_at_purchase)}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '2px solid var(--pk-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--pk-text-secondary)' }}>Subtotal item toko</span>
              <span>{formatIDR(itemSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--pk-text-secondary)' }}>Fee marketplace (~2%)</span>
              <span style={{ color: 'var(--pk-text-hint)' }}>– {formatIDR(order.fee_marketplace)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 15,
                paddingTop: 6,
                borderTop: '1px solid var(--pk-border)',
              }}
            >
              <span>Estimasi Bersih Toko</span>
              <span style={{ color: statusColor }}>{formatIDR(itemSubtotal - order.fee_marketplace)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 2 }}>
              * Estimasi bersih bukan saldo SmartBank. Pendapatan aktual ditentukan oleh SmartBank.
            </div>
          </div>
        </div>

        {/* Timeline status */}
        {order.status_history && order.status_history.length > 0 && (
          <div className="pk-card" style={{ padding: 20, background: '#fff' }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--pk-text-hint)',
                marginBottom: 16,
              }}
            >
              Timeline Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[...order.status_history].reverse().map((event, idx) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    gap: 14,
                    position: 'relative',
                    paddingBottom: idx < order.status_history!.length - 1 ? 20 : 0,
                  }}
                >
                  {/* Dot & line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: idx === 0 ? statusColor : 'var(--pk-border-strong)',
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    />
                    {idx < order.status_history!.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--pk-border)', marginTop: 4 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: idx < order.status_history!.length - 1 ? 0 : 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {STATUS_LABEL[event.status as Order['status']] ?? event.status}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                      {new Date(event.created_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {event.note && (
                        <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{event.note}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
