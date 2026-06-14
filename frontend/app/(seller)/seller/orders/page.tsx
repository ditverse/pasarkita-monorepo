'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import StatusBadge from '@/components/pk/status-badge';
import Placeholder from '@/components/pk/placeholder';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { ordersApi } from '@/lib/api/orders';
import { sellerApi } from '@/lib/api/seller';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Order } from '@/types/api';

const TABS = [
  { id: '', label: 'Semua' },
  { id: 'paid', label: 'Perlu Diproses' },
  { id: 'processing', label: 'Siap Dikirim' },
  { id: 'shipped', label: 'Sedang Dikirim' },
  { id: 'delivered', label: 'Selesai' },
  { id: 'payment_failed', label: 'Gagal' },
] as const;

type OrderSort = 'created_desc' | 'created_asc' | 'action_deadline';

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
      style={{ minHeight: 28, padding: '3px 8px', fontSize: 11 }}
    >
      <Icon name="clipboard" size={12} />
      {label}
    </button>
  );
}

export default function SellerOrdersPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sort, setSort] = useState<OrderSort>('created_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounce(search, 400);

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list(
      'seller',
      status,
      debouncedSearch,
      createdFrom,
      createdTo,
      sort,
      page,
      limit
    ),
    queryFn: async () => {
      const response = await ordersApi.getAll({
        status: status || undefined,
        search: debouncedSearch || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        sort,
        page,
        limit,
      });
      return {
        orders: response.data.data ?? [],
        pagination: response.data.pagination,
      };
    },
    enabled: Boolean(user),
  });

  const profileQuery = useQuery({
    queryKey: ['seller', 'profile'],
    queryFn: async () => (await sellerApi.getProfile()).data.data,
    enabled: Boolean(user),
  });

  const startProcessingMutation = useMutation({
    mutationFn: ({ orderId, pickupAddress }: { orderId: string; pickupAddress: string }) =>
      ordersApi.startProcessing(orderId, pickupAddress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const markShippedMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.ship(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const retryShippingMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.retryShipping(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleStartProcessing = async (order: Order) => {
    if (!order.seller_can_process) {
      toast.error(order.seller_action_reason || 'Pesanan belum dapat diproses');
      return;
    }
    const pickupAddress = window.prompt(
      'Konfirmasi alamat pickup untuk pesanan ini:',
      profileQuery.data?.pickup_address || ''
    )?.trim();
    if (!pickupAddress) return;
    if (pickupAddress.length < 10) {
      toast.error('Alamat pickup minimal 10 karakter');
      return;
    }

    setUpdatingId(order.id);
    try {
      await startProcessingMutation.mutateAsync({ orderId: order.id, pickupAddress });
      toast.success('Pesanan mulai diproses. Siapkan barang dan packing list.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal memulai proses pesanan'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkShipped = async (order: Order) => {
    if (!order.seller_can_ship) {
      toast.error(order.seller_action_reason || 'Pesanan belum dapat ditandai dikirim');
      return;
    }
    if (!window.confirm(`Tandai order ${order.id.slice(0, 8).toUpperCase()} sebagai sudah dikirim?`)) {
      return;
    }

    setUpdatingId(order.id);
    try {
      await markShippedMutation.mutateAsync(order.id);
      toast.success('Pesanan ditandai sebagai dikirim');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal memperbarui status pesanan'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRetryShipping = async (order: Order) => {
    setUpdatingId(order.id);
    try {
      await retryShippingMutation.mutateAsync(order.id);
      toast.success('Sinkronisasi LogistiKita berhasil');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Sinkronisasi LogistiKita masih gagal'));
    } finally {
      setUpdatingId(null);
    }
  };

  const resetFilters = () => {
    setStatus('');
    setSearch('');
    setCreatedFrom('');
    setCreatedTo('');
    setSort('created_desc');
    setPage(1);
    setLimit(10);
  };

  const handleSort = (value: OrderSort) => {
    setSort(value);
    setPage(1);
    if (value === 'action_deadline') setStatus('paid');
  };

  const handleExportOrders = async () => {
    setIsExporting(true);
    try {
      const response = await ordersApi.exportSeller({
        status: status || undefined,
        search: debouncedSearch || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
      });
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-toko-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File CSV order berhasil diunduh');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengekspor order'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!user) {
    return <div style={{ padding: 64, textAlign: 'center' }}>Memuat data...</div>;
  }

  const orders = ordersQuery.data?.orders ?? [];
  const pagination = ordersQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const resultStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const resultEnd = Math.min(page * limit, total);
  const hasFilters = Boolean(
    status || search || createdFrom || createdTo || sort !== 'created_desc' || limit !== 10
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            Order Masuk
          </h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            {ordersQuery.isLoading ? 'Memuat pesanan...' : `${total.toLocaleString('id-ID')} order sesuai filter`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pk-btn pk-btn-secondary pk-btn-sm"
            onClick={() => void handleExportOrders()}
            disabled={isExporting || ordersQuery.isLoading}
            title="Unduh order dalam format CSV"
          >
            <Icon name="download" size={14} />
            {isExporting ? 'Mengekspor...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="pk-btn pk-btn-secondary pk-btn-sm"
            disabled={ordersQuery.isFetching}
            onClick={() => void ordersQuery.refetch()}
          >
            <Icon
              name={ordersQuery.isFetching ? 'loader' : 'trending'}
              size={14}
              style={ordersQuery.isFetching ? { animation: 'pk-spin 0.8s linear infinite' } : undefined}
            />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatus(tab.id);
              setPage(1);
              if (sort === 'action_deadline' && tab.id !== 'paid') setSort('created_desc');
            }}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: status === tab.id ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
              borderBottom: status === tab.id ? '2px solid var(--pk-text)' : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {status === tab.id && !ordersQuery.isLoading && (
              <span style={{ marginLeft: 6, color: 'var(--pk-text-hint)' }}>({total})</span>
            )}
          </button>
        ))}
      </div>

      <div className="pk-card" style={{ background: '#fff', padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input
              className="pk-input"
              placeholder="Cari order, produk, transaksi, atau resi..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              style={{ height: 36, paddingLeft: 36, fontSize: 12 }}
            />
          </div>
          <input
            className="pk-input"
            type="date"
            aria-label="Tanggal order mulai"
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(event) => {
              setCreatedFrom(event.target.value);
              setPage(1);
            }}
            style={{ width: 145, height: 36, fontSize: 12 }}
          />
          <input
            className="pk-input"
            type="date"
            aria-label="Tanggal order akhir"
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(event) => {
              setCreatedTo(event.target.value);
              setPage(1);
            }}
            style={{ width: 145, height: 36, fontSize: 12 }}
          />
          <select
            className="pk-select"
            aria-label="Urutkan order"
            value={sort}
            onChange={(event) => handleSort(event.target.value as OrderSort)}
            style={{ width: 185, height: 36, fontSize: 12 }}
          >
            <option value="created_desc">Order terbaru</option>
            <option value="created_asc">Order terlama</option>
            <option value="action_deadline">Prioritas segera diproses</option>
          </select>
          {hasFilters && (
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ordersQuery.isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
            Memuat pesanan...
          </div>
        )}

        {!ordersQuery.isLoading && ordersQuery.isError && (
          <div className="pk-card" style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
            <div>Order gagal dimuat. Periksa koneksi backend dan token login.</div>
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              onClick={() => void ordersQuery.refetch()}
              disabled={ordersQuery.isFetching}
              style={{ marginTop: 12 }}
            >
              {ordersQuery.isFetching ? 'Mencoba lagi...' : 'Coba Lagi'}
            </button>
          </div>
        )}

        {!ordersQuery.isLoading && !ordersQuery.isError && orders.map((order) => (
          <article key={order.id} className="pk-card pk-card-hover" style={{ padding: 20, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="pk-mono" style={{ fontSize: 13, color: 'var(--pk-text)', fontWeight: 600 }}>
                    {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <StatusBadge status={order.status} />
                  <span style={{ fontSize: 12, color: 'var(--pk-text-secondary)' }}>
                    Pembeli: {order.buyer?.name || 'Tidak tersedia'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 5 }}>
                  {new Date(order.created_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <CopyButton label="Order ID" value={order.id} />
                <CopyButton label="Transaksi" value={order.transaction_id} />
                <CopyButton label="Alamat" value={order.shipping_address} />
                <CopyButton label="Resi" value={order.tracking_id} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Placeholder label="item" height={60} style={{ width: 60, flexShrink: 0 }} />
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {order.items?.[0]?.product_name || 'Produk dihapus'}
                  {order.items.length > 1 && (
                    <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>
                      {' '}+ {order.items.length - 1} produk toko Anda
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 4 }}>
                  {order.items.reduce((sum, item) => sum + item.qty, 0)} barang toko Anda · Nilai item{' '}
                  <strong style={{ color: 'var(--pk-text)' }}>{formatIDR(order.subtotal)}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 5, overflowWrap: 'anywhere' }}>
                  Kirim ke: {order.shipping_address}
                </div>
                {order.tracking_id && (
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
                    Resi: <span className="pk-mono" style={{ color: 'var(--pk-accent)' }}>{order.tracking_id}</span>
                  </div>
                )}
                {order.processing_at && (
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
                    Mulai diproses {new Date(order.processing_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
                {order.shipping_sync_status === 'failed' && (
                  <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 6 }}>
                    Sinkronisasi pengiriman gagal: {order.shipping_sync_error || 'LogistiKita tidak merespons'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flex: '0 1 280px', gap: 8, justifyContent: 'flex-end', alignItems: 'flex-end', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {order.status === 'paid' && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-primary pk-btn-sm"
                      disabled={!order.seller_can_process || updatingId === order.id}
                      title={order.seller_action_reason || 'Konfirmasi pickup dan mulai siapkan pesanan'}
                      onClick={() => void handleStartProcessing(order)}
                    >
                      {updatingId === order.id ? 'Memproses...' : 'Mulai Proses'}
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-primary pk-btn-sm"
                      disabled={!order.seller_can_ship || updatingId === order.id}
                      title={order.seller_action_reason || 'Sinkronkan dan tandai pesanan sebagai dikirim'}
                      onClick={() => void handleMarkShipped(order)}
                    >
                      {updatingId === order.id ? 'Menyinkronkan...' : 'Serahkan ke Kurir'}
                    </button>
                  )}
                  {order.status === 'processing' && order.shipping_sync_status === 'failed' && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-secondary pk-btn-sm"
                      disabled={updatingId === order.id}
                      onClick={() => void handleRetryShipping(order)}
                    >
                      Retry Logistik
                    </button>
                  )}
                  {['processing', 'shipped', 'delivered'].includes(order.status) && (
                    <Link href={`/seller/orders/${order.id}/packing-list`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
                      Packing List
                    </Link>
                  )}
                  <Link href={`/seller/orders/${order.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
                    Lihat Detail
                  </Link>
                </div>
                {!order.seller_can_process && !order.seller_can_ship && order.seller_action_reason && (
                  <div style={{ fontSize: 11, lineHeight: 1.45, textAlign: 'right', color: 'var(--pk-text-hint)' }}>
                    {order.seller_action_reason}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}

        {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && (
          <div className="pk-card" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--pk-text-hint)', fontSize: 14 }}>
            {hasFilters
              ? 'Tidak ada pesanan yang cocok dengan pencarian atau filter.'
              : 'Belum ada pesanan untuk produk toko Anda.'}
          </div>
        )}
      </div>

      {!ordersQuery.isLoading && !ordersQuery.isError && total > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
            {resultStart}-{resultEnd} dari {total.toLocaleString('id-ID')} order · Halaman {page} dari {pagination?.total_pages || 1}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="pk-select"
              aria-label="Jumlah order per halaman"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              style={{ height: 32, width: 90, fontSize: 12 }}
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>{value}/hal</option>
              ))}
            </select>
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              disabled={page >= (pagination?.total_pages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
