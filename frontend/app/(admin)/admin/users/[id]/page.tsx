'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Avatar from '@/components/pk/avatar';
import StatusBadge from '@/components/pk/status-badge';
import { adminApi } from '@/lib/api/admin';
import { formatIDR } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const userQuery = useQuery({
    queryKey: queryKeys.admin.user(userId),
    queryFn: async () => (await adminApi.getUserById(userId)).data.data,
    enabled: Boolean(userId),
  });

  const data = userQuery.data;
  const user = data?.user;

  const copyId = async () => {
    await navigator.clipboard.writeText(userId);
    toast.success('User ID disalin');
  };

  if (userQuery.isLoading) {
    return <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat detail user...</div>;
  }

  if (userQuery.isError || !user || !data) {
    return (
      <div className="pk-card" role="alert" style={{ padding: 24 }}>
        <p style={{ marginTop: 0 }}>Detail user tidak dapat dimuat.</p>
        <Link href="/admin/users" className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
          Kembali ke Semua User
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/users" style={{ display: 'inline-block', marginBottom: 18, fontSize: 13, color: 'var(--pk-text-secondary)', textDecoration: 'none' }}>
        ← Kembali ke Semua User
      </Link>

      <div className="pk-card" style={{ background: '#fff', padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar name={user.name} size={48} bg="#F3F4F6" color="#111827" />
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>{user.name}</h1>
              <div style={{ color: 'var(--pk-text-secondary)', fontSize: 13 }}>{user.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`pk-badge ${user.role === 'seller' ? 'pk-badge-blue' : user.role === 'superadmin' ? 'pk-badge-warning' : 'pk-badge-neutral'}`}>
              {user.role}
            </span>
            <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 4 }}>USER ID</div>
            <code style={{ fontSize: 12 }}>{user.id}</code>
          </div>
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={copyId}>Salin ID</button>
          <div>
            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginBottom: 4 }}>TERDAFTAR</div>
            <div style={{ fontSize: 13 }}>{formatDate(user.created_at)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {user.role === 'buyer' && (
          <>
            <StatCard label="Total Order" value={data.stats.total_orders.toLocaleString('id-ID')} />
            <StatCard label="Paid Order" value={data.stats.paid_orders.toLocaleString('id-ID')} />
            <StatCard label="Total Belanja" value={formatIDR(data.stats.total_spent)} />
          </>
        )}
        {user.role === 'seller' && (
          <>
            <StatCard label="Total Produk" value={data.stats.total_products.toLocaleString('id-ID')} />
            <StatCard label="Produk Aktif" value={data.stats.active_products.toLocaleString('id-ID')} />
          </>
        )}
      </div>

      {user.role === 'buyer' && (
        <DataTable
          title="Histori Order"
          headers={['Order ID', 'Status', 'Total', 'Transaksi / Tracking', 'Tanggal']}
          empty="User ini belum memiliki order."
          rows={data.recent_orders.map((order) => [
            <code key="id">{order.id.slice(0, 8).toUpperCase()}</code>,
            <StatusBadge key="status" status={order.status} />,
            formatIDR(order.total),
            <span key="refs" style={{ fontSize: 12 }}>
              {order.transaction_id || '-'}<br />{order.tracking_id || '-'}
            </span>,
            formatDate(order.created_at),
          ])}
        />
      )}

      {user.role === 'seller' && (
        <DataTable
          title="Produk Terbaru"
          headers={['Produk', 'Kategori', 'Harga', 'Stok', 'Status']}
          empty="Seller ini belum memiliki produk."
          rows={data.recent_products.map((product) => [
            product.name,
            product.category,
            formatIDR(product.price),
            product.stock.toLocaleString('id-ID'),
            <StatusBadge key="status" status={product.is_active ? 'active' : 'inactive'} />,
          ])}
        />
      )}

      <div style={{ marginTop: 18 }}>
        <DataTable
          title="Tindakan Admin"
          subtitle={data.audit_history.available ? '20 tindakan terbaru terhadap user ini' : data.audit_history.message}
          headers={['Tindakan', 'Admin', 'Alasan', 'Waktu']}
          empty="Belum ada tindakan admin terhadap user ini."
          rows={data.audit_history.data.map((log) => [
            log.action,
            log.actor?.name || '-',
            log.reason || '-',
            formatDate(log.created_at),
          ])}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="pk-card" style={{ background: '#fff', padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function DataTable({
  title,
  subtitle,
  headers,
  rows,
  empty,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ marginTop: 3, fontSize: 12, color: 'var(--pk-text-hint)' }}>{subtitle}</div>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {headers.map((header) => (
                <th key={header} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} style={{ padding: 28, textAlign: 'center', color: 'var(--pk-text-hint)' }}>{empty}</td></tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ borderTop: '1px solid var(--pk-border)' }}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ padding: '12px 20px', fontSize: 13, color: cellIndex === 0 ? 'inherit' : 'var(--pk-text-secondary)' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
