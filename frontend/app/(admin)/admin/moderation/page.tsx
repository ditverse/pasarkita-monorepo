'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@/components/pk/icon';
import StatusBadge from '@/components/pk/status-badge';
import { getApiErrorMessage } from '@/lib/api-error';
import { adminApi } from '@/lib/api/admin';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatIDR } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { AdminModerationProduct, AdminModerationSeller } from '@/types/api';
import { toast } from 'sonner';

const RULES = [
  ['policy_violation', 'Melanggar kebijakan'],
  ['misleading_information', 'Informasi menyesatkan'],
  ['prohibited_product', 'Produk dilarang'],
  ['quality_risk', 'Risiko kualitas/keamanan'],
  ['seller_request', 'Permintaan seller'],
  ['stock_restored', 'Stok sudah dipulihkan'],
  ['review_completed', 'Review selesai'],
  ['other', 'Alasan lain'],
] as const;

type Rule = (typeof RULES)[number][0];
type DialogState = { product: AdminModerationProduct; nextActive: boolean } | null;

export default function AdminModerationPage() {
  return (
    <Suspense fallback={<div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Memuat moderasi...</div>}>
      <AdminModerationContent />
    </Suspense>
  );
}

function AdminModerationContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'products' | 'sellers'>('products');
  const [productSearch, setProductSearch] = useState(searchParams.get('search') ?? '');
  const [productStatus, setProductStatus] = useState(searchParams.get('status') ?? '');
  const [stockFilter, setStockFilter] = useState(searchParams.get('stock') ?? '');
  const [productPage, setProductPage] = useState(1);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatus, setSellerStatus] = useState('');
  const [sellerPage, setSellerPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [rule, setRule] = useState<Rule>('policy_violation');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const debouncedProductSearch = useDebounce(productSearch, 400);
  const debouncedSellerSearch = useDebounce(sellerSearch, 400);

  const productsQuery = useQuery({
    queryKey: queryKeys.admin.moderationProducts(
      debouncedProductSearch,
      productStatus,
      stockFilter,
      productPage
    ),
    queryFn: async () => {
      const response = await adminApi.getModerationProducts({
        search: debouncedProductSearch || undefined,
        status: productStatus || undefined,
        stock: stockFilter || undefined,
        page: productPage,
        limit: 20,
      });
      return { products: response.data.data ?? [], pagination: response.data.pagination };
    },
    enabled: tab === 'products',
  });

  const sellersQuery = useQuery({
    queryKey: queryKeys.admin.moderationSellers(debouncedSellerSearch, sellerStatus, sellerPage),
    queryFn: async () => {
      const response = await adminApi.getModerationSellers({
        search: debouncedSellerSearch || undefined,
        status: sellerStatus || undefined,
        page: sellerPage,
        limit: 20,
      });
      return { sellers: response.data.data ?? [], pagination: response.data.pagination };
    },
    enabled: tab === 'sellers',
  });

  const historyQuery = useQuery({
    queryKey: ['admin', 'moderation', 'history'],
    queryFn: async () =>
      (await adminApi.getAuditLogs({ target_type: 'product', page: 1, limit: 10 })).data.data ?? [],
    enabled: tab === 'products',
  });

  const moderationMutation = useMutation({
    mutationFn: async () => {
      if (!dialog) throw new Error('Produk moderasi tidak dipilih');
      return adminApi.moderateProduct(dialog.product.id, {
        is_active: dialog.nextActive,
        rule,
        reason: reason.trim(),
      });
    },
    onSuccess: async () => {
      const targetName = dialog?.product.name ?? 'Produk';
      setDialog(null);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      toast.success(`Status ${targetName} berhasil diperbarui`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal memoderasi produk')),
  });

  const openDialog = (product: AdminModerationProduct) => {
    const nextActive = !product.is_active;
    setDialog({ product, nextActive });
    setRule(nextActive ? 'review_completed' : 'policy_violation');
    setReason(nextActive ? 'Produk telah selesai ditinjau dan memenuhi kebijakan.' : '');
  };

  const submitModeration = () => {
    if (reason.trim().length < 5) {
      toast.error('Alasan moderasi minimal 5 karakter');
      return;
    }
    moderationMutation.mutate();
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Moderasi Marketplace
        </h1>
        <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
          Kendalikan kualitas listing dan pantau kesehatan katalog seller
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--pk-border)', marginBottom: 20 }}>
        {[
          ['products', 'Produk'],
          ['sellers', 'Seller'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: tab === id ? '2px solid var(--pk-text)' : '2px solid transparent',
              background: 'transparent',
              color: tab === id ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <>
          <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
            <FilterBar
              search={productSearch}
              onSearch={(value) => { setProductSearch(value); setProductPage(1); }}
              placeholder="Cari nama produk..."
            >
              <select className="pk-select" style={{ width: 145, height: 36 }} value={productStatus} onChange={(event) => { setProductStatus(event.target.value); setProductPage(1); }}>
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
              <select className="pk-select" style={{ width: 145, height: 36 }} value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setProductPage(1); }}>
                <option value="">Semua stok</option>
                <option value="low">Stok kritis</option>
                <option value="empty">Stok habis</option>
              </select>
              {(productSearch || productStatus || stockFilter) && (
                <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => { setProductSearch(''); setProductStatus(''); setStockFilter(''); setProductPage(1); }}>
                  Reset
                </button>
              )}
            </FilterBar>
            <ProductTable
              products={productsQuery.data?.products ?? []}
              loading={productsQuery.isLoading}
              error={productsQuery.isError}
              onModerate={openDialog}
            />
            <Pagination
              page={productPage}
              total={productsQuery.data?.pagination.total ?? 0}
              totalPages={productsQuery.data?.pagination.total_pages ?? 1}
              onPage={setProductPage}
            />
          </div>

          <div className="pk-card" style={{ background: '#fff', marginTop: 18, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}>
              <div style={{ fontWeight: 600 }}>Riwayat Keputusan Terbaru</div>
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--pk-text-hint)' }}>Bersumber dari audit log admin</div>
            </div>
            {historyQuery.isError ? (
              <div style={{ padding: 22, color: 'var(--pk-text-secondary)' }}>Audit log belum aktif. Jalankan migration observability.</div>
            ) : (historyQuery.data?.length ?? 0) === 0 ? (
              <div style={{ padding: 22, color: 'var(--pk-text-hint)' }}>Belum ada keputusan moderasi produk.</div>
            ) : (
              historyQuery.data?.map((log) => (
                <div key={log.id} style={{ padding: '12px 20px', borderTop: '1px solid var(--pk-border)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, fontSize: 12 }}>
                  <span><strong>{log.action}</strong><br />{log.reason || '-'}</span>
                  <span style={{ color: 'var(--pk-text-secondary)' }}>{log.actor?.name || 'Admin'}<br />Target: {log.target_id?.slice(0, 8).toUpperCase()}</span>
                  <span style={{ color: 'var(--pk-text-hint)' }}>{new Date(log.created_at).toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
          <FilterBar
            search={sellerSearch}
            onSearch={(value) => { setSellerSearch(value); setSellerPage(1); }}
            placeholder="Cari nama atau email seller..."
          >
            <select className="pk-select" style={{ width: 145, height: 36 }} value={sellerStatus} onChange={(event) => { setSellerStatus(event.target.value); setSellerPage(1); }}>
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </FilterBar>
          <SellerTable sellers={sellersQuery.data?.sellers ?? []} loading={sellersQuery.isLoading} error={sellersQuery.isError} />
          <Pagination
            page={sellerPage}
            total={sellersQuery.data?.pagination.total ?? 0}
            totalPages={sellersQuery.data?.pagination.total_pages ?? 1}
            onPage={setSellerPage}
          />
        </div>
      )}

      {dialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(17, 24, 39, 0.42)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div className="pk-card" role="dialog" aria-modal="true" style={{ width: 'min(520px, 100%)', background: '#fff', padding: 24 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>{dialog.nextActive ? 'Aktifkan listing' : 'Nonaktifkan listing'}</h2>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>
              {dialog.product.name} · {dialog.product.seller.name} · Stok {dialog.product.stock}
            </p>
            <label className="pk-label">Aturan keputusan</label>
            <select className="pk-select" value={rule} onChange={(event) => setRule(event.target.value as Rule)}>
              {RULES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="pk-label" style={{ marginTop: 16 }}>Alasan untuk audit</label>
            <textarea className="pk-textarea" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Jelaskan bukti atau pertimbangan keputusan..." />
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="pk-btn pk-btn-secondary" disabled={moderationMutation.isPending} onClick={() => setDialog(null)}>Batal</button>
              <button className="pk-btn pk-btn-primary" disabled={moderationMutation.isPending} onClick={submitModeration}>
                {moderationMutation.isPending ? 'Menyimpan...' : 'Konfirmasi Keputusan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBar({ search, onSearch, placeholder, children }: { search: string; onSearch: (value: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--pk-border)' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
        <input className="pk-input" value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} style={{ height: 36, paddingLeft: 36 }} />
      </div>
      {children}
    </div>
  );
}

function ProductTable({ products, loading, error, onModerate }: { products: AdminModerationProduct[]; loading: boolean; error: boolean; onModerate: (product: AdminModerationProduct) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Produk', 'Seller', 'Harga', 'Stok', 'Status', 'Aksi'].map((header) => <th key={header} style={{ padding: '10px 20px', textAlign: header === 'Aksi' ? 'right' : 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>{header}</th>)}</tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Memuat produk...</td></tr>}
          {!loading && error && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Produk gagal dimuat.</td></tr>}
          {!loading && !error && products.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Tidak ada produk sesuai filter.</td></tr>}
          {!error && products.map((product) => (
            <tr key={product.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
              <td style={{ padding: '12px 20px' }}><Link href={`/admin/products/${product.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><strong style={{ fontSize: 13 }}>{product.name}</strong></Link><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{product.category}</span></td>
              <td style={{ padding: '12px 20px' }}><Link href={`/admin/users/${product.seller.id}`} style={{ color: 'inherit', fontSize: 13 }}>{product.seller.name}</Link><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{product.seller.email}</span></td>
              <td style={{ padding: '12px 20px', fontSize: 13 }}>{formatIDR(product.price)}</td>
              <td style={{ padding: '12px 20px', color: product.stock <= 5 ? 'var(--pk-danger)' : 'inherit', fontWeight: product.stock <= 5 ? 600 : 400 }}>{product.stock}</td>
              <td style={{ padding: '12px 20px' }}><StatusBadge status={product.is_active ? 'active' : 'inactive'} /></td>
              <td style={{ padding: '12px 20px', textAlign: 'right' }}><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Link href={`/admin/products/${product.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>Detail</Link><button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={product.stock <= 0 && !product.is_active} onClick={() => onModerate(product)}>{product.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SellerTable({ sellers, loading, error }: { sellers: AdminModerationSeller[]; loading: boolean; error: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Seller', 'Status Akun', 'Verifikasi', 'Produk', 'Stok Kritis', 'Detail'].map((header) => <th key={header} style={{ padding: '10px 20px', textAlign: header === 'Detail' ? 'right' : 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>{header}</th>)}</tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Memuat seller...</td></tr>}
          {!loading && error && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Seller gagal dimuat.</td></tr>}
          {!loading && !error && sellers.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Tidak ada seller sesuai filter.</td></tr>}
          {!error && sellers.map((seller) => (
            <tr key={seller.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
              <td style={{ padding: '12px 20px' }}><strong>{seller.name}</strong><br /><span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{seller.email}</span></td>
              <td style={{ padding: '12px 20px' }}><StatusBadge status={seller.is_active ? 'active' : 'inactive'} /></td>
              <td style={{ padding: '12px 20px' }}><span className="pk-badge pk-badge-warning">Belum dikonfigurasi</span></td>
              <td style={{ padding: '12px 20px', fontSize: 12 }}>{seller.product_summary.total_products} total<br />{seller.product_summary.active_products} aktif · {seller.product_summary.inactive_products} nonaktif</td>
              <td style={{ padding: '12px 20px', color: seller.product_summary.low_stock_products ? 'var(--pk-danger)' : 'inherit' }}>{seller.product_summary.low_stock_products}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right' }}><Link href={`/admin/users/${seller.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>Buka</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, total, totalPages, onPage }: { page: number; total: number; totalPages: number; onPage: (page: number) => void }) {
  const start = total === 0 ? 0 : (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);
  return (
    <div style={{ padding: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{start}-{end} dari {total.toLocaleString('id-ID')}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
        <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Berikutnya</button>
      </div>
    </div>
  );
}
