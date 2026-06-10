'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { Product } from '@/types/api';

function Toggle({
  on,
  onChange,
  label,
  title,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
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
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: on ? 'var(--pk-success)' : 'var(--pk-border-strong)',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 150ms ease', padding: 0,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 19 : 3,
        transition: 'left 150ms ease',
      }} />
    </button>
  );
}

export default function SellerProductsPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const debouncedSearch = useDebounce(search, 400);

  const { data: products = [], isLoading: loading, isFetching, isError } = useQuery({
    queryKey: queryKeys.products.seller(user?.id, debouncedSearch),
    queryFn: async (): Promise<Product[]> => {
      const res = await productsApi.getMine({
        search: debouncedSearch || undefined,
        limit: 100,
      });
      return res.data.data ?? [];
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

  const toggleActive = async (id: string, newStatus: boolean, stock: number) => {
    if (stock <= 0 && newStatus) {
      toast.error('Tidak bisa mengaktifkan produk yang stoknya habis. Silakan edit stok terlebih dahulu.');
      return;
    }

    const action = newStatus ? 'mengaktifkan' : 'menonaktifkan';
    if (!window.confirm(`Yakin ingin ${action} produk ini?`)) return;

    try {
      await updateProductMutation.mutateAsync({ id, isActive: newStatus });
      toast.success(`Produk berhasil di${newStatus ? 'aktifkan' : 'nonaktifkan'}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gagal mengubah status produk'));
    }
  };

  const filteredProducts = products.filter((p) => {
    if (filterStatus === 'Aktif') return p.is_active;
    if (filterStatus === 'Nonaktif') return !p.is_active;
    return true;
  });

  const activeCount = products.filter((p) => p.is_active).length;
  const hasActiveFilters = Boolean(search) || filterStatus !== 'Semua';

  if (loading && products.length === 0 && !debouncedSearch) {
     return <div style={{ padding: '40px', color: 'var(--pk-text-hint)' }}>Memuat etalase produk Anda...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Produk Saya</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            {products.length} produk · {activeCount} aktif
          </p>
        </div>
        <Link href="/seller/products/add" style={{ textDecoration: 'none' }}>
          <button className="pk-btn pk-btn-primary">
            <Icon name="plus" size={14} stroke={2.5} /> Tambah Produk
          </button>
        </Link>
      </div>

      <div className="pk-card" style={{ overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input 
              className="pk-input" 
              placeholder="Cari produk..." 
              style={{ height: 36, paddingLeft: 36, fontSize: 13 }} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <select
              style={{ 
                height: 36, 
                padding: '0 32px 0 16px', 
                fontSize: 13, 
                minWidth: 140, 
                appearance: 'none', 
                background: '#fff', 
                border: '1px solid var(--pk-border)', 
                borderRadius: 8,
                color: 'var(--pk-text)',
                cursor: 'pointer'
              }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
            <Icon name="chevronDown" size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--pk-text-hint)' }} />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              onClick={() => {
                setSearch('');
                setFilterStatus('Semua');
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                {['Nama Produk', 'Harga', 'Stok', 'Status', 'Aksi'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'left',
                    padding: '10px 20px', fontSize: 12, fontWeight: 500,
                    color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--pk-border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isFetching && products.length > 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                    Mencari...
                  </td>
                </tr>
              )}
              {!loading && isError && (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
                    Produk gagal dimuat. Periksa koneksi backend dan token login.
                  </td>
                </tr>
              )}
              {!loading && !isError && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                    {hasActiveFilters ? 'Tidak ada produk yang sesuai dengan pencarian atau filter.' : 'Catatan: Anda belum memiliki produk di database. Tambah sekarang!'}
                  </td>
                </tr>
              )}
              {!loading && !isError && filteredProducts.map((p) => {
                const isGreyedOut = !p.is_active || p.stock <= 0;
                return (
                  <tr key={p.id} style={{
                    borderBottom: '1px solid var(--pk-border)',
                    background: isGreyedOut ? 'var(--pk-bg-subtle)' : 'transparent',
                    opacity: isGreyedOut ? 0.7 : 1,
                    transition: 'background 150ms ease, opacity 150ms ease'
                  }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ProductImage
                          src={p.image_url}
                          alt={p.name}
                          height={40}
                          style={{ width: 40, borderRadius: 6, flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{p.category || 'Belanja'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500 }}>{formatIDR(p.price)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14 }}>
                      <span style={{ color: p.stock <= 0 ? '#dc2626' : 'inherit', fontWeight: p.stock <= 0 ? 600 : 'normal' }}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Toggle
                        on={p.is_active}
                        onChange={(v) => toggleActive(p.id, v, p.stock)}
                        label={`${p.is_active ? 'Nonaktifkan' : 'Aktifkan'} produk ${p.name}`}
                        title={!p.is_active && p.stock <= 0
                          ? 'Isi stok terlebih dahulu sebelum mengaktifkan produk'
                          : `${p.is_active ? 'Nonaktifkan' : 'Aktifkan'} produk`}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <Link href={`/seller/products/edit/${p.id}`} style={{ fontSize: 13, color: 'var(--pk-accent)', cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
