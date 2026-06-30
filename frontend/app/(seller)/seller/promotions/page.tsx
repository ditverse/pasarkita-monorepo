'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { promotionsApi, DiscountPayload, VoucherPayload } from '@/lib/api/promotions';
import { formatIDR } from '@/lib/format';

const toIso = (value: string) => new Date(value).toISOString();
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function SellerPromotionsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'discounts' | 'vouchers'>('discounts');
  const [discountForm, setDiscountForm] = useState<{
    product_id: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: string;
    start_time: string;
    end_time: string;
  }>({
    product_id: '',
    discount_type: 'percentage',
    discount_value: '10',
    start_time: nowLocal(),
    end_time: nowLocal(),
  });
  const [voucherForm, setVoucherForm] = useState<{
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: string;
    min_purchase: string;
    max_discount: string;
    quota: string;
    category: string;
    start_time: string;
    end_time: string;
  }>({
    code: '',
    discount_type: 'percentage',
    discount_value: '10',
    min_purchase: '0',
    max_discount: '',
    quota: '50',
    category: '',
    start_time: nowLocal(),
    end_time: nowLocal(),
  });

  const promotionsQuery = useQuery({
    queryKey: ['seller', 'promotions'],
    queryFn: async () => (await promotionsApi.getSellerPromotions()).data.data,
  });

  const products = useMemo(() => promotionsQuery.data?.products ?? [], [promotionsQuery.data?.products]);
  const discounts = useMemo(() => promotionsQuery.data?.discounts ?? [], [promotionsQuery.data?.discounts]);
  const vouchers = useMemo(() => promotionsQuery.data?.vouchers ?? [], [promotionsQuery.data?.vouchers]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'promotions'] });

  const createDiscountMutation = useMutation({
    mutationFn: (body: DiscountPayload) => promotionsApi.createSellerDiscount(body),
    onSuccess: () => {
      toast.success('Diskon produk dibuat');
      void invalidate();
    },
    onError: (error: unknown) => toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Gagal membuat diskon'),
  });

  const toggleDiscountMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => promotionsApi.updateSellerDiscount(id, { is_active }),
    onSuccess: () => void invalidate(),
  });

  const createVoucherMutation = useMutation({
    mutationFn: (body: Omit<VoucherPayload, 'discount_type'> & { discount_type: 'percentage' | 'fixed_amount' }) => promotionsApi.createSellerVoucher(body),
    onSuccess: () => {
      toast.success('Voucher toko dibuat');
      void invalidate();
    },
    onError: (error: unknown) => toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Gagal membuat voucher'),
  });

  const toggleVoucherMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => promotionsApi.updateSellerVoucher(id, { is_active }),
    onSuccess: () => void invalidate(),
  });

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))], [products]);

  const submitDiscount = () => {
    if (!discountForm.product_id) {
      toast.error('Pilih produk terlebih dahulu');
      return;
    }
    createDiscountMutation.mutate({
      product_id: discountForm.product_id,
      discount_type: discountForm.discount_type,
      discount_value: Number(discountForm.discount_value),
      start_time: toIso(discountForm.start_time),
      end_time: toIso(discountForm.end_time),
    });
  };

  const submitVoucher = () => {
    createVoucherMutation.mutate({
      code: voucherForm.code.trim().toUpperCase(),
      discount_type: voucherForm.discount_type,
      discount_value: Number(voucherForm.discount_value),
      min_purchase: Number(voucherForm.min_purchase || 0),
      max_discount: voucherForm.max_discount ? Number(voucherForm.max_discount) : null,
      quota: Number(voucherForm.quota),
      category: voucherForm.category || null,
      start_time: toIso(voucherForm.start_time),
      end_time: toIso(voucherForm.end_time),
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>Promosi</h1>
          <p style={{ margin: 0, color: 'var(--pk-text-secondary)', fontSize: 14 }}>Kelola flashsale produk dan voucher toko.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={tab === 'discounts' ? 'pk-btn pk-btn-primary' : 'pk-btn pk-btn-secondary'} onClick={() => setTab('discounts')}>Flashsale</button>
          <button className={tab === 'vouchers' ? 'pk-btn pk-btn-primary' : 'pk-btn pk-btn-secondary'} onClick={() => setTab('vouchers')}>Voucher</button>
        </div>
      </div>

      {tab === 'discounts' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
          <section className="pk-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Buat Flashsale</h2>
            <label className="pk-label">Produk</label>
            <select className="pk-select" value={discountForm.product_id} onChange={(event) => setDiscountForm((form) => ({ ...form, product_id: event.target.value }))}>
              <option value="">Pilih produk</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatIDR(product.price)}</option>)}
            </select>
            <label className="pk-label" style={{ marginTop: 12 }}>Tipe</label>
            <select className="pk-select" value={discountForm.discount_type} onChange={(event) => setDiscountForm((form) => ({ ...form, discount_type: event.target.value as 'percentage' | 'fixed_amount' }))}>
              <option value="percentage">Persentase</option>
              <option value="fixed_amount">Nominal</option>
            </select>
            <label className="pk-label" style={{ marginTop: 12 }}>Nilai</label>
            <input className="pk-input" type="number" min={1} value={discountForm.discount_value} onChange={(event) => setDiscountForm((form) => ({ ...form, discount_value: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Mulai</label>
            <input className="pk-input" type="datetime-local" value={discountForm.start_time} onChange={(event) => setDiscountForm((form) => ({ ...form, start_time: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Selesai</label>
            <input className="pk-input" type="datetime-local" value={discountForm.end_time} onChange={(event) => setDiscountForm((form) => ({ ...form, end_time: event.target.value }))} />
            <button className="pk-btn pk-btn-primary pk-btn-block" style={{ marginTop: 16 }} disabled={createDiscountMutation.isPending} onClick={submitDiscount}>Buat Diskon</button>
          </section>

          <section className="pk-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--pk-border)', fontWeight: 600 }}>Daftar Flashsale</div>
            {promotionsQuery.isLoading ? <div style={{ padding: 24 }}>Memuat...</div> : discounts.length === 0 ? <div style={{ padding: 24, color: 'var(--pk-text-hint)' }}>Belum ada flashsale.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>{discounts.map((discount) => (
                  <tr key={discount.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                    <td style={{ padding: 14 }}>{discount.product?.name || discount.product_id}<br /><span style={{ color: 'var(--pk-text-hint)' }}>{discount.discount_type === 'percentage' ? `${discount.discount_value}%` : formatIDR(discount.discount_value)}</span></td>
                    <td style={{ padding: 14, color: 'var(--pk-text-hint)' }}>{new Date(discount.start_time).toLocaleString('id-ID')} - {new Date(discount.end_time).toLocaleString('id-ID')}</td>
                    <td style={{ padding: 14, textAlign: 'right' }}><button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => toggleDiscountMutation.mutate({ id: discount.id, is_active: !discount.is_active })}>{discount.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </section>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
          <section className="pk-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Buat Voucher Toko</h2>
            <label className="pk-label">Kode</label>
            <input className="pk-input" value={voucherForm.code} onChange={(event) => setVoucherForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Tipe</label>
            <select className="pk-select" value={voucherForm.discount_type} onChange={(event) => setVoucherForm((form) => ({ ...form, discount_type: event.target.value as 'percentage' | 'fixed_amount' }))}>
              <option value="percentage">Persentase</option>
              <option value="fixed_amount">Nominal</option>
            </select>
            <label className="pk-label" style={{ marginTop: 12 }}>Nilai</label>
            <input className="pk-input" type="number" min={1} value={voucherForm.discount_value} onChange={(event) => setVoucherForm((form) => ({ ...form, discount_value: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Minimum Belanja</label>
            <input className="pk-input" type="number" min={0} value={voucherForm.min_purchase} onChange={(event) => setVoucherForm((form) => ({ ...form, min_purchase: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Maks Diskon</label>
            <input className="pk-input" type="number" min={1} value={voucherForm.max_discount} onChange={(event) => setVoucherForm((form) => ({ ...form, max_discount: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Kuota</label>
            <input className="pk-input" type="number" min={1} value={voucherForm.quota} onChange={(event) => setVoucherForm((form) => ({ ...form, quota: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Kategori</label>
            <select className="pk-select" value={voucherForm.category} onChange={(event) => setVoucherForm((form) => ({ ...form, category: event.target.value }))}>
              <option value="">Semua kategori</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <label className="pk-label" style={{ marginTop: 12 }}>Mulai</label>
            <input className="pk-input" type="datetime-local" value={voucherForm.start_time} onChange={(event) => setVoucherForm((form) => ({ ...form, start_time: event.target.value }))} />
            <label className="pk-label" style={{ marginTop: 12 }}>Selesai</label>
            <input className="pk-input" type="datetime-local" value={voucherForm.end_time} onChange={(event) => setVoucherForm((form) => ({ ...form, end_time: event.target.value }))} />
            <button className="pk-btn pk-btn-primary pk-btn-block" style={{ marginTop: 16 }} disabled={createVoucherMutation.isPending} onClick={submitVoucher}>Buat Voucher</button>
          </section>

          <section className="pk-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--pk-border)', fontWeight: 600 }}>Daftar Voucher</div>
            {promotionsQuery.isLoading ? <div style={{ padding: 24 }}>Memuat...</div> : vouchers.length === 0 ? <div style={{ padding: 24, color: 'var(--pk-text-hint)' }}>Belum ada voucher.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>{vouchers.map((voucher) => (
                  <tr key={voucher.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                    <td style={{ padding: 14, fontWeight: 600 }}>{voucher.code}<br /><span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>{voucher.category || 'Semua kategori'}</span></td>
                    <td style={{ padding: 14 }}>{voucher.discount_type === 'percentage' ? `${voucher.discount_value}%` : formatIDR(voucher.discount_value)}</td>
                    <td style={{ padding: 14, color: 'var(--pk-text-hint)' }}>{voucher.used_count}/{voucher.quota}</td>
                    <td style={{ padding: 14, textAlign: 'right' }}><button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => toggleVoucherMutation.mutate({ id: voucher.id, is_active: !voucher.is_active })}>{voucher.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
