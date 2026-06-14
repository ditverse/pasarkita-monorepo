'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { useAuthStore } from '@/store/auth';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';

type ProductSort =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'status_asc'
  | 'status_desc';

function Toggle({
  on,
  onChange,
  label,
  title,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-label={label}
      aria-pressed={on}
      title={title}
      style={{ width: 36, height: 20, borderRadius: 999, background: on ? 'var(--pk-success)' : 'var(--pk-border-strong)', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 150ms ease', padding: 0 }}
    >
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left 150ms ease' }} />
    </button>
  );
}

export default function SellerProductsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState<ProductSort>('created_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounce(search, 400);

  const productsQuery = useQuery({
    queryKey: queryKeys.products.seller(user?.id, debouncedSearch, status, stock, sort, page, limit),
    queryFn: async () => {
      const response = await productsApi.getMine({
        search: debouncedSearch || undefined,
        status: status === 'active' || status === 'inactive' ? status : undefined,
        stock: stock === 'low' || stock === 'out' ? stock : undefined,
        sort,
        page,
        limit,
      });
      return {
        products: response.data.data ?? [],
        pagination: response.data.pagination,
      };
    },
    enabled: Boolean(user?.id),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.update(id, { is_active: isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', 'seller'] });
    },
  });

  const toggleActive = async (id: string, newStatus: boolean, productStock: number) => {
    if (productStock <= 0 && newStatus) {
      toast.error('Tidak bisa mengaktifkan produk yang stoknya habis. Silakan edit stok terlebih dahulu.');
      return;
    }
    if (!window.confirm(`Yakin ingin ${newStatus ? 'mengaktifkan' : 'menonaktifkan'} produk ini?`)) return;

    try {
      await updateProductMutation.mutateAsync({ id, isActive: newStatus });
      toast.success(`Produk berhasil di${newStatus ? 'aktifkan' : 'nonaktifkan'}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengubah status produk'));
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setStock('');
    setSort('created_desc');
    setPage(1);
    setLimit(20);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await productsApi.exportMine({
        search: debouncedSearch || undefined,
        status: status || undefined,
        stock: stock || undefined,
      });
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `produk-toko-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File CSV produk berhasil diunduh');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengekspor produk'));
    } finally {
      setIsExporting(false);
    }
  };

  const products = productsQuery.data?.products ?? [];
  const pagination = productsQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const resultStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const resultEnd = Math.min(page * limit, total);
  const hasFilters = Boolean(search || status || stock || sort !== 'created_desc' || limit !== 20);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Produk Saya</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            {productsQuery.isLoading ? 'Memuat produk...' : `${total.toLocaleString('id-ID')} produk sesuai filter`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pk-btn pk-btn-secondary pk-btn-sm"
            onClick={() => void handleExport()}
            disabled={isExporting || productsQuery.isLoading}
            title="Unduh produk dalam format CSV"
          >
            <Icon name="download" size={14} />
            {isExporting ? 'Mengekspor...' : 'Export CSV'}
          </button>
          <Link href="/seller/products/add" className="pk-btn pk-btn-primary" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={14} stroke={2.5} /> Tambah Produk
          </Link>
        </div>
      </div>

      <div className="pk-card" style={{ overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input
              className="pk-input"
              placeholder="Cari nama produk..."
              style={{ height: 36, paddingLeft: 36, fontSize: 13 }}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="pk-select"
            aria-label="Filter status produk"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            style={{ width: 140, height: 36, fontSize: 12 }}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Draf / Nonaktif</option>
          </select>
          <select
            className="pk-select"
            aria-label="Filter kondisi stok"
            value={stock}
            onChange={(event) => {
              setStock(event.target.value);
              setPage(1);
            }}
            style={{ width: 145, height: 36, fontSize: 12 }}
          >
            <option value="">Semua Stok</option>
            <option value="low">Stok Menipis</option>
            <option value="out">Stok Habis</option>
          </select>
          <select
            className="pk-select"
            aria-label="Urutkan produk"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ProductSort);
              setPage(1);
            }}
            style={{ width: 165, height: 36, fontSize: 12 }}
          >
            <option value="created_desc">Terbaru</option>
            <option value="created_asc">Terlama</option>
            <option value="name_asc">Nama A-Z</option>
            <option value="name_desc">Nama Z-A</option>
            <option value="price_asc">Harga terendah</option>
            <option value="price_desc">Harga tertinggi</option>
            <option value="stock_asc">Stok terendah</option>
            <option value="stock_desc">Stok tertinggi</option>
            <option value="status_desc">Aktif lebih dulu</option>
            <option value="status_asc">Nonaktif lebih dulu</option>
          </select>
          {hasFilters && <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={resetFilters}>Reset</button>}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                {['Nama Produk', 'Harga', 'Stok', 'Status', 'Aksi'].map((heading, index) => (
                  <th key={heading} style={{ textAlign: index === 0 ? 'left' : index === 4 ? 'right' : 'left', padding: '10px 20px', fontSize: 12, fontWeight: 500, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--pk-border)' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productsQuery.isLoading && (
                <tr><td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat etalase produk Anda...</td></tr>
              )}
              {!productsQuery.isLoading && productsQuery.isError && (
                <tr>
                  <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
                    <div>Produk gagal dimuat. Periksa koneksi backend dan token login.</div>
                    <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void productsQuery.refetch()} style={{ marginTop: 12 }}>Coba Lagi</button>
                  </td>
                </tr>
              )}
              {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                    {hasFilters ? 'Tidak ada produk yang sesuai dengan pencarian atau filter.' : 'Anda belum memiliki produk. Tambahkan produk pertama sekarang.'}
                  </td>
                </tr>
              )}
              {!productsQuery.isError && products.map((product) => {
                const isOut = product.stock <= 0;
                const isLow = Boolean(product.is_low_stock);
                return (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--pk-border)', background: !product.is_active || isOut ? 'var(--pk-bg-subtle)' : 'transparent', opacity: !product.is_active ? 0.72 : 1 }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ProductImage src={product.image_url} alt={product.name} height={40} style={{ width: 40, borderRadius: 6, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{product.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{product.category || 'Belanja'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500 }}>{formatIDR(product.price)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13 }}>
                      <div style={{ fontWeight: isOut || isLow ? 700 : 500, color: isOut ? 'var(--pk-danger)' : isLow ? '#b45309' : 'var(--pk-text)' }}>
                        {product.stock}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 11, color: 'var(--pk-text-hint)' }}>
                        {isOut ? 'Stok habis' : isLow ? `Menipis, batas ${product.minimum_stock ?? 5}` : `Batas ${product.minimum_stock ?? 5}`}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Toggle
                          on={product.is_active}
                          onChange={(value) => void toggleActive(product.id, value, product.stock)}
                          label={`${product.is_active ? 'Nonaktifkan' : 'Aktifkan'} produk ${product.name}`}
                          title={!product.is_active && isOut ? 'Isi stok terlebih dahulu sebelum mengaktifkan produk' : undefined}
                        />
                        <span style={{ fontSize: 13, color: product.is_active ? 'var(--pk-success)' : 'var(--pk-text-hint)', fontWeight: product.is_active ? 600 : 500 }}>
                          {product.is_active ? 'Aktif' : 'Draf'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
                        <Link href={`/products/${product.id}`} target="_blank" style={{ fontSize: 13, color: 'var(--pk-text-secondary)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="eye" size={14} />
                          Lihat
                        </Link>
                        <Link href={`/seller/products/edit/${product.id}`} style={{ fontSize: 13, color: 'var(--pk-accent)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="edit" size={14} />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!productsQuery.isLoading && !productsQuery.isError && total > 0 && (
          <div style={{ padding: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
              {resultStart}-{resultEnd} dari {total.toLocaleString('id-ID')} produk · Halaman {page} dari {pagination?.total_pages || 1}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                className="pk-select"
                aria-label="Jumlah produk per halaman"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                style={{ height: 32, width: 90, fontSize: 12 }}
              >
                {[10, 20, 50].map((value) => <option key={value} value={value}>{value}/hal</option>)}
              </select>
              <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelumnya</button>
              <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= (pagination?.total_pages || 1)} onClick={() => setPage((current) => current + 1)}>Berikutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
