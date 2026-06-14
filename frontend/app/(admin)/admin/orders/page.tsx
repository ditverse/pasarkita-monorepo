'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { useDebounce } from '@/lib/hooks/useDebounce';

const STATUS_TABS = [
  { id: '', label: 'Semua' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'processing', label: 'Diproses' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'delivered', label: 'Selesai' },
  { id: 'payment_failed', label: 'Gagal' },
];
const VALID_STATUSES = STATUS_TABS.map((tab) => tab.id);
const VALID_SORTS = ['created_desc', 'created_asc', 'total_desc', 'total_asc', 'status_asc', 'status_desc', 'updated_desc', 'updated_asc'] as const;
type OrderSort = (typeof VALID_SORTS)[number];

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat order...</div>}>
      <AdminOrdersContent />
    </Suspense>
  );
}

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') ?? '';
  const initialSort = searchParams.get('sort') ?? 'created_desc';
  const [statusFilter, setStatusFilter] = useState(VALID_STATUSES.includes(initialStatus) ? initialStatus : '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [createdFrom, setCreatedFrom] = useState(searchParams.get('from') ?? '');
  const [createdTo, setCreatedTo] = useState(searchParams.get('to') ?? '');
  const [sort, setSort] = useState<OrderSort>(
    VALID_SORTS.includes(initialSort as OrderSort) ? initialSort as OrderSort : 'created_desc'
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 20);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);
  const queryClient = useQueryClient();

  const syncUrl = (updates: Record<string, string | number>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === 0 || (key === 'page' && value === 1) || (key === 'limit' && value === 20) || (key === 'sort' && value === 'created_desc')) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    router.replace(`/admin/orders${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list('admin', statusFilter, debouncedSearch, createdFrom, createdTo, sort, page, limit),
    queryFn: async () => {
      const response = await ordersApi.getAll({
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        sort,
        page,
        limit,
      });
      return { orders: response.data.data ?? [], pagination: response.data.pagination };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status, reason }: { orderId: string; status: string; reason: string }) =>
      ordersApi.updateStatus(orderId, { status, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const reason = window.prompt(`Alasan mengubah status order menjadi "${newStatus}":`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Yakin mengubah status order ${orderId.slice(0, 8).toUpperCase()} menjadi "${newStatus}"?`)) return;
    setUpdatingId(orderId);
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: newStatus, reason: reason.trim() });
      toast.success(`Status order ${orderId.slice(0, 8).toUpperCase()} berhasil diperbarui`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal memperbarui status order'));
    } finally {
      setUpdatingId(null);
    }
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSearch('');
    setCreatedFrom('');
    setCreatedTo('');
    setSort('created_desc');
    setPage(1);
    setLimit(20);
    router.replace('/admin/orders', { scroll: false });
  };

  const pagination = ordersQuery.data?.pagination;
  const orders = ordersQuery.data?.orders ?? [];
  const total = pagination?.total ?? 0;
  const resultStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const resultEnd = Math.min(page * limit, total);
  const hasFilters = Boolean(statusFilter || search || createdFrom || createdTo || sort !== 'created_desc' || limit !== 20);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Semua Order</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            {ordersQuery.isLoading ? '...' : `${total.toLocaleString('id-ID')} order sesuai filter`}
          </p>
        </div>
        <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={ordersQuery.isFetching} onClick={() => ordersQuery.refetch()}>
          <Icon name={ordersQuery.isFetching ? 'loader' : 'trending'} size={14} style={ordersQuery.isFetching ? { animation: 'pk-spin 0.8s linear infinite' } : undefined} />
          Refresh
        </button>
      </div>

      <div style={{ borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto' }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatusFilter(tab.id);
              setPage(1);
              syncUrl({ status: tab.id, page: 1 });
            }}
            style={{ padding: '10px 14px', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: statusFilter === tab.id ? 'var(--pk-text)' : 'var(--pk-text-secondary)', borderBottom: statusFilter === tab.id ? '2px solid var(--pk-text)' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 380 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input
              className="pk-input"
              placeholder="Order, buyer, transaction, tracking..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                syncUrl({ search: event.target.value, page: 1 });
              }}
              style={{ height: 36, paddingLeft: 36, fontSize: 13 }}
            />
          </div>
          <input className="pk-input" type="date" aria-label="Tanggal order mulai" value={createdFrom} max={createdTo || undefined} onChange={(event) => { setCreatedFrom(event.target.value); setPage(1); syncUrl({ from: event.target.value, page: 1 }); }} style={{ width: 145, height: 36, fontSize: 12 }} />
          <input className="pk-input" type="date" aria-label="Tanggal order akhir" value={createdTo} min={createdFrom || undefined} onChange={(event) => { setCreatedTo(event.target.value); setPage(1); syncUrl({ to: event.target.value, page: 1 }); }} style={{ width: 145, height: 36, fontSize: 12 }} />
          <select className="pk-select" value={sort} onChange={(event) => { const value = event.target.value as OrderSort; setSort(value); setPage(1); syncUrl({ sort: value, page: 1 }); }} style={{ width: 165, height: 36, fontSize: 12 }}>
            <option value="created_desc">Terbaru</option>
            <option value="created_asc">Terlama</option>
            <option value="updated_desc">Aktivitas terbaru</option>
            <option value="total_desc">Total terbesar</option>
            <option value="total_asc">Total terkecil</option>
            <option value="status_asc">Status A-Z</option>
            <option value="status_desc">Status Z-A</option>
          </select>
          {hasFilters && <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={resetFilters}>Reset</button>}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Order', 'Buyer', 'Total', 'Status', 'Tanggal', 'Aksi'].map((heading) => <th key={heading} style={{ textAlign: heading === 'Aksi' ? 'right' : 'left', padding: '10px 20px', fontSize: 11, color: 'var(--pk-text-hint)', position: heading === 'Order' ? 'sticky' : undefined, left: heading === 'Order' ? 0 : undefined, background: 'var(--pk-bg-subtle)', zIndex: heading === 'Order' ? 1 : undefined }}>{heading}</th>)}</tr></thead>
            <tbody>
              {ordersQuery.isLoading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}>Memuat data...</td></tr>}
              {!ordersQuery.isLoading && ordersQuery.isError && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}>Order gagal dimuat.</td></tr>}
              {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--pk-text-hint)' }}>{hasFilters ? 'Tidak ada order yang cocok dengan filter.' : 'Belum ada order di marketplace.'}</td></tr>}
              {!ordersQuery.isError && orders.map((order) => (
                <tr key={order.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: '12px 20px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                    <Link href={`/admin/orders/${order.id}?return=${encodeURIComponent(`/admin/orders${searchParams.size ? `?${searchParams.toString()}` : ''}`)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      <code style={{ fontSize: 12 }}>{order.id.slice(0, 8).toUpperCase()}</code>
                    </Link>
                    <div style={{ marginTop: 3, fontSize: 10, color: 'var(--pk-text-hint)' }}>{order.transaction_id || 'Belum ada transaction ID'}</div>
                  </td>
                  <td style={{ padding: '12px 20px' }}><strong style={{ fontSize: 13 }}>{order.buyer?.name || '-'}</strong><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{order.buyer?.email || '-'}</span></td>
                  <td style={{ padding: '12px 20px', fontWeight: 600 }}>{formatIDR(order.total)}</td>
                  <td style={{ padding: '12px 20px' }}><StatusBadge status={order.status} /></td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--pk-text-secondary)' }}>{new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Link href={`/admin/orders/${order.id}?return=${encodeURIComponent(`/admin/orders${searchParams.size ? `?${searchParams.toString()}` : ''}`)}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>Detail</Link>
                      <select className="pk-select" style={{ height: 32, fontSize: 12, width: 135 }} value={order.status} disabled={updatingId === order.id} onChange={(event) => handleStatusChange(order.id, event.target.value)}>
                        {VALID_STATUSES.filter(Boolean).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{resultStart}-{resultEnd} dari {total.toLocaleString('id-ID')} order</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="pk-select" value={limit} onChange={(event) => { const value = Number(event.target.value); setLimit(value); setPage(1); syncUrl({ limit: value, page: 1 }); }} style={{ height: 32, width: 90, fontSize: 12 }}>
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/hal</option>)}
            </select>
            <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); syncUrl({ page: page - 1 }); }}>Sebelumnya</button>
            <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= (pagination?.total_pages || 1)} onClick={() => { setPage(page + 1); syncUrl({ page: page + 1 }); }}>Berikutnya</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, textAlign: 'right', fontSize: 11, color: 'var(--pk-text-hint)' }}>
        Terakhir diperbarui {new Date(ordersQuery.dataUpdatedAt).toLocaleTimeString('id-ID')}
      </div>
    </div>
  );
}
