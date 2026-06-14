'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import StatusBadge from '@/components/pk/status-badge';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import type { Order } from '@/types/api';
import { toast } from 'sonner';

export default function AdminOrderDetailPage() {
  return (
    <Suspense fallback={<div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat detail order...</div>}>
      <AdminOrderDetailContent />
    </Suspense>
  );
}

function AdminOrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requestedReturn = searchParams.get('return') ?? '/admin/orders';
  const returnUrl = requestedReturn.startsWith('/admin/orders') ? requestedReturn : '/admin/orders';
  const orderQuery = useQuery({
    queryKey: ['orders', 'admin-detail', id],
    queryFn: async () => (await ordersApi.getById(id)).data.data,
  });

  const copy = async (label: string, value: string | null) => {
    if (!value) {
      toast.error(`${label} belum tersedia`);
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin`);
  };

  if (orderQuery.isLoading) {
    return <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat detail order...</div>;
  }
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="pk-card" style={{ padding: 24 }}>
        <p style={{ marginTop: 0 }}>Detail order tidak dapat dimuat.</p>
        <Link href={returnUrl} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>Kembali</Link>
      </div>
    );
  }

  const order = orderQuery.data;
  return (
    <div>
      <Link href={returnUrl} style={{ display: 'inline-block', marginBottom: 16, color: 'var(--pk-text-secondary)', fontSize: 13, textDecoration: 'none' }}>
        ← Kembali ke daftar order
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Order {order.id.slice(0, 8).toUpperCase()}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--pk-text-secondary)' }}>
            Dibuat {formatDate(order.created_at)}
          </p>
        </div>
        <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={orderQuery.isFetching} onClick={() => orderQuery.refetch()}>
          {orderQuery.isFetching ? 'Memperbarui...' : 'Refresh Detail'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Identitas Order" />
          <CopyRow label="Order ID" value={order.id} onCopy={() => copy('Order ID', order.id)} />
          <CopyRow label="Transaction ID" value={order.transaction_id} onCopy={() => copy('Transaction ID', order.transaction_id)} />
          <CopyRow label="Tracking ID" value={order.tracking_id} onCopy={() => copy('Tracking ID', order.tracking_id)} />
          <InfoRow label="Aktivitas terakhir" value={formatDate(order.updated_at || order.created_at)} />
        </section>

        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Buyer" />
          {order.buyer ? (
            <>
              <InfoRow label="Nama" value={order.buyer.name} />
              <InfoRow label="Email" value={order.buyer.email} />
              <Link href={`/admin/users/${order.buyer.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ marginTop: 12, textDecoration: 'none' }}>
                Buka Detail Buyer
              </Link>
            </>
          ) : <div style={{ color: 'var(--pk-text-hint)' }}>Data buyer tidak tersedia.</div>}
        </section>

        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Pengiriman" />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--pk-text-secondary)' }}>{order.shipping_address}</div>
          <div style={{ marginTop: 12 }}>
            <InfoRow label="Tracking" value={order.tracking_id || 'Belum tersedia'} />
          </div>
        </section>
      </div>

      <section className="pk-card" style={{ background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}><SectionTitle title="Produk dan Seller" /></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Produk', 'Seller', 'Harga', 'Qty', 'Subtotal'].map((header) => <th key={header} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>{header}</th>)}</tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.product_id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <Link href={`/admin/products/${item.product_id}`} style={{ color: 'inherit', fontWeight: 600 }}>{item.product_name}</Link>
                    <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 3 }}>{item.category || 'Tanpa kategori'} · {item.product_id.slice(0, 8).toUpperCase()}</div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    {item.seller ? <Link href={`/admin/users/${item.seller.id}`} style={{ color: 'inherit' }}>{item.seller.name}</Link> : '-'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>{formatIDR(item.price_at_purchase)}</td>
                  <td style={{ padding: '12px 20px' }}>{item.qty}</td>
                  <td style={{ padding: '12px 20px', fontWeight: 600 }}>{formatIDR(item.qty * item.price_at_purchase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ marginBottom: 18 }}>
        <IntegrationStoryboard order={order} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 18 }}>
        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Ringkasan Pembayaran" />
          <InfoRow label="Subtotal" value={formatIDR(order.subtotal)} />
          <InfoRow label="Fee marketplace" value={formatIDR(order.fee_marketplace)} />
          <div style={{ borderTop: '1px solid var(--pk-border)', marginTop: 10, paddingTop: 10 }}>
            <InfoRow label="Total" value={formatIDR(order.total)} strong />
          </div>
        </section>

        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Timeline Integrasi" />
          {!order.integration_timeline?.available ? (
            <p style={{ color: 'var(--pk-text-secondary)', fontSize: 13 }}>{order.integration_timeline?.message || 'Data belum tersedia.'}</p>
          ) : order.integration_timeline.data.length === 0 ? (
            <p style={{ color: 'var(--pk-text-hint)', fontSize: 13 }}>Belum ada event integrasi untuk order ini.</p>
          ) : order.integration_timeline.data.map((event) => (
            <div key={event.id} style={{ padding: '10px 0', borderTop: '1px solid var(--pk-border)', fontSize: 12 }}>
              <strong>{event.service} · {event.operation}</strong>
              <div style={{ marginTop: 3, color: event.success ? 'var(--pk-success)' : 'var(--pk-danger)' }}>
                {event.success ? 'Berhasil' : `Gagal${event.error_code ? ` (${event.error_code})` : ''}`} · {event.duration_ms} ms
              </div>
              <div style={{ marginTop: 3, color: 'var(--pk-text-hint)' }}>{formatDate(event.created_at)}</div>
            </div>
          ))}
        </section>
      </div>

      <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
        <SectionTitle title="Riwayat Tindakan Admin" />
        {!order.audit_history?.available ? (
          <p style={{ color: 'var(--pk-text-secondary)', fontSize: 13 }}>{order.audit_history?.message || 'Audit belum tersedia.'}</p>
        ) : order.audit_history.data.length === 0 ? (
          <p style={{ color: 'var(--pk-text-hint)', fontSize: 13 }}>Belum ada tindakan admin pada order ini.</p>
        ) : order.audit_history.data.map((log) => (
          <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, padding: '10px 0', borderTop: '1px solid var(--pk-border)', fontSize: 12 }}>
            <span><strong>{log.action}</strong><br />{log.reason || '-'}</span>
            <span>{log.actor?.name || 'Admin'}</span>
            <span style={{ color: 'var(--pk-text-hint)' }}>{formatDate(log.created_at)}</span>
          </div>
        ))}
      </section>

      <div style={{ marginTop: 10, textAlign: 'right', color: 'var(--pk-text-hint)', fontSize: 11 }}>
        Detail diperbarui {new Date(orderQuery.dataUpdatedAt).toLocaleTimeString('id-ID')}
      </div>
    </div>
  );
}

function IntegrationStoryboard({ order }: { order: Order }) {
  const events = order.integration_timeline?.data ?? [];
  const findEvent = (pattern: string) => events.find((event) =>
    `${event.service}.${event.operation}`.toLowerCase().includes(pattern)
  );
  const gatewayEvent = events.find((event) => event.service === 'gateway');
  const paymentEvent = findEvent('payment');
  const shippingEvent = findEvent('shipping');
  const paid = ['paid', 'processing', 'shipped', 'delivered'].includes(order.status);
  const nodes = [
    { label: 'Buyer', status: 'complete', detail: 'Checkout dibuat', time: order.created_at },
    { label: 'PasarKita', status: 'complete', detail: `Order ${order.id.slice(0, 8).toUpperCase()}`, time: order.created_at },
    { label: 'Gateway', status: gatewayEvent ? (gatewayEvent.success ? 'complete' : 'error') : 'unknown', detail: gatewayEvent ? gatewayEvent.operation : 'Event belum tersedia', time: gatewayEvent?.created_at },
    { label: 'SmartBank', status: paymentEvent ? (paymentEvent.success ? 'complete' : 'error') : order.status === 'payment_failed' ? 'error' : paid ? 'complete' : 'unknown', detail: paymentEvent?.operation || (paid ? 'Pembayaran sukses dari status order' : order.status === 'payment_failed' ? 'Pembayaran gagal' : 'Menunggu pembayaran'), time: paymentEvent?.created_at || (paid || order.status === 'payment_failed' ? order.updated_at || order.created_at : undefined) },
    { label: 'PasarKita', status: paid ? 'complete' : order.status === 'payment_failed' ? 'error' : 'unknown', detail: `Status: ${order.status}`, time: order.updated_at || order.created_at },
    { label: 'LogistiKita', status: shippingEvent ? (shippingEvent.success ? 'complete' : 'error') : order.tracking_id ? 'complete' : 'unknown', detail: shippingEvent?.operation || (order.tracking_id ? `Tracking ${order.tracking_id}` : 'Tracking belum tersedia'), time: shippingEvent?.created_at },
  ] as const;
  const colors = { complete: '#16A34A', error: '#DC2626', unknown: '#9CA3AF' };
  return (
    <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
      <SectionTitle title="Integration Storyboard" />
      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 18 }}>
        Buyer → PasarKita → Gateway → SmartBank → PasarKita → LogistiKita
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 6 }}>
        {nodes.map((node, index) => (
          <div key={`${node.label}-${index}`} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 155 }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[node.status], flexShrink: 0 }} />
                <strong style={{ fontSize: 12 }}>{node.label}</strong>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--pk-text-secondary)', minHeight: 32 }}>{node.detail}</div>
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--pk-text-hint)' }}>{node.time ? formatDate(node.time) : 'Belum terverifikasi'}</div>
            </div>
            {index < nodes.length - 1 && <span style={{ color: 'var(--pk-border-strong)', padding: '0 8px', fontSize: 20 }}>→</span>}
          </div>
        ))}
      </div>
      {!order.integration_timeline?.available && (
        <div style={{ marginTop: 14, padding: 10, borderRadius: 7, background: 'var(--pk-warning-soft)', color: 'var(--pk-warning)', fontSize: 11 }}>
          Event Gateway belum tersedia. Storyboard memakai status order sebagai fallback; correlation ID menunggu kontrak Gateway.
        </div>
      )}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>;
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '6px 0', fontSize: 13 }}><span style={{ color: 'var(--pk-text-secondary)' }}>{label}</span><span style={{ fontWeight: strong ? 700 : 500, textAlign: 'right' }}>{value}</span></div>;
}

function CopyRow({ label, value, onCopy }: { label: string; value: string | null; onCopy: () => void }) {
  return (
    <div style={{ padding: '7px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--pk-text-secondary)' }}>{label}</span>
        <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={onCopy}>Salin</button>
      </div>
      <code style={{ display: 'block', marginTop: 4, fontSize: 11, overflowWrap: 'anywhere' }}>{value || 'Belum tersedia'}</code>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
}
