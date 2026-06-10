'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import StatusBadge from '@/components/pk/status-badge';
import { adminApi } from '@/lib/api/admin';
import { formatIDR } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productQuery = useQuery({
    queryKey: queryKeys.admin.moderationProduct(id),
    queryFn: async () => (await adminApi.getModerationProductById(id)).data.data,
  });

  const copyId = async () => {
    await navigator.clipboard.writeText(id);
    toast.success('Product ID disalin');
  };

  if (productQuery.isLoading) return <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat detail produk...</div>;
  if (productQuery.isError || !productQuery.data) return <div className="pk-card" style={{ padding: 24 }}>Detail produk tidak dapat dimuat.</div>;

  const data = productQuery.data;
  const product = data.product;
  return (
    <div>
      <Link href="/admin/moderation" style={{ display: 'inline-block', marginBottom: 16, color: 'var(--pk-text-secondary)', textDecoration: 'none' }}>← Kembali ke moderasi</Link>
      <div className="pk-card" style={{ background: '#fff', padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div><h1 style={{ margin: '0 0 6px', fontSize: 24 }}>{product.name}</h1><div style={{ color: 'var(--pk-text-secondary)' }}>{product.category} · {formatIDR(product.price)}</div></div>
          <StatusBadge status={product.is_active ? 'active' : 'inactive'} />
        </div>
        <p style={{ margin: '18px 0', lineHeight: 1.7, color: 'var(--pk-text-secondary)' }}>{product.description || 'Tidak ada deskripsi.'}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--pk-border)', paddingTop: 14 }}>
          <div><div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>PRODUCT ID</div><code style={{ fontSize: 11 }}>{product.id}</code></div>
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={copyId}>Salin ID</button>
          <div><div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>STOK</div><strong style={{ color: product.stock <= 5 ? 'var(--pk-danger)' : undefined }}>{product.stock}</strong></div>
          <div><div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>DIBUAT</div><span>{formatDate(product.created_at)}</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Unit Terjual" value={data.stats.sold_units.toLocaleString('id-ID')} />
        <Metric label="Paid Order" value={data.stats.paid_order_count.toLocaleString('id-ID')} />
        <Metric label="GMV Produk" value={formatIDR(data.stats.gmv)} />
        <Metric label="Rating" value={data.stats.average_rating === null ? 'Belum ada' : `${data.stats.average_rating}/5 (${data.stats.rating_count})`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Seller" />
          <InfoRow label="Nama" value={product.seller.name} />
          <InfoRow label="Email" value={product.seller.email} />
          <InfoRow label="Status akun" value={product.seller.is_active ? 'Active' : 'Inactive'} />
          <Link href={`/admin/users/${product.seller.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ marginTop: 12, textDecoration: 'none' }}>Buka Seller</Link>
        </section>
        <section className="pk-card" style={{ background: '#fff', padding: 20 }}>
          <SectionTitle title="Ulasan Terbaru" />
          {data.ratings.length === 0 ? <p style={{ color: 'var(--pk-text-hint)' }}>Belum ada ulasan.</p> : data.ratings.slice(0, 5).map((rating) => <div key={rating.id} style={{ padding: '9px 0', borderTop: '1px solid var(--pk-border)', fontSize: 12 }}><strong>{rating.rating}/5 · {rating.buyer?.name || 'Buyer'}</strong><div style={{ marginTop: 3, color: 'var(--pk-text-secondary)' }}>{rating.comment || 'Tanpa komentar'}</div></div>)}
        </section>
      </div>

      <DataTable
        title="Order Produk Terbaru"
        headers={['Order', 'Buyer', 'Qty', 'Harga', 'Status', 'Tanggal']}
        empty="Belum ada paid order untuk produk ini."
        rows={data.recent_orders.map((order) => [
          <Link key="order" href={`/admin/orders/${order.id}`}><code>{order.id.slice(0, 8).toUpperCase()}</code></Link>,
          order.buyer ? <Link key="buyer" href={`/admin/users/${order.buyer.id}`}>{order.buyer.name}</Link> : '-',
          order.qty,
          formatIDR(order.price_at_purchase),
          <StatusBadge key="status" status={order.status} />,
          formatDate(order.created_at),
        ])}
      />

      <div style={{ marginTop: 18 }}>
        <DataTable
          title="Riwayat Moderasi"
          subtitle={data.audit_history.available ? 'Keputusan admin terhadap produk ini' : data.audit_history.message}
          headers={['Tindakan', 'Admin', 'Alasan', 'Waktu']}
          empty="Belum ada keputusan moderasi."
          rows={data.audit_history.data.map((log) => [log.action, log.actor?.name || 'Admin', log.reason || '-', formatDate(log.created_at)])}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="pk-card" style={{ background: '#fff', padding: 18 }}><div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{label.toUpperCase()}</div><div style={{ marginTop: 8, fontSize: 21, fontWeight: 700 }}>{value}</div></div>;
}
function SectionTitle({ title }: { title: string }) { return <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13 }}><span style={{ color: 'var(--pk-text-secondary)' }}>{label}</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{value}</span></div>; }
function DataTable({ title, subtitle, headers, rows, empty }: { title: string; subtitle?: string; headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  return <section className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}><div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}><strong>{title}</strong>{subtitle && <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 3 }}>{subtitle}</div>}</div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}><thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{headers.map((header) => <th key={header} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>{header}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={headers.length} style={{ padding: 28, textAlign: 'center', color: 'var(--pk-text-hint)' }}>{empty}</td></tr> : rows.map((row, index) => <tr key={index} style={{ borderTop: '1px solid var(--pk-border)' }}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '11px 18px', fontSize: 12 }}>{cell}</td>)}</tr>)}</tbody></table></div></section>;
}
function formatDate(iso: string) { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }); }
