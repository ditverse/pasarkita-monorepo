'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { promotionsApi, VoucherPayload } from '@/lib/api/promotions';
import { formatIDR } from '@/lib/format';

const toIso = (value: string) => new Date(value).toISOString();
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const CATEGORIES = ['', 'Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

export default function AdminPromotionsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as VoucherPayload['discount_type'],
    discount_value: '10',
    min_purchase: '0',
    max_discount: '',
    quota: '100',
    category: '',
    start_time: nowLocal(),
    end_time: nowLocal(),
  });

  const vouchersQuery = useQuery({
    queryKey: ['admin', 'promotions', 'vouchers'],
    queryFn: async () => (await promotionsApi.getMarketplaceVouchers()).data.data ?? [],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions', 'vouchers'] });
  const createMutation = useMutation({
    mutationFn: (body: VoucherPayload) => promotionsApi.createMarketplaceVoucher(body),
    onSuccess: () => {
      toast.success('Voucher marketplace dibuat');
      void invalidate();
    },
    onError: (error: unknown) => toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Gagal membuat voucher'),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => promotionsApi.updateMarketplaceVoucher(id, { is_active }),
    onSuccess: () => void invalidate(),
  });

  const submit = () => {
    createMutation.mutate({
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_purchase: Number(form.min_purchase || 0),
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      quota: Number(form.quota),
      category: form.category || null,
      start_time: toIso(form.start_time),
      end_time: toIso(form.end_time),
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>Promosi Marketplace</h1>
        <p style={{ margin: 0, color: 'var(--pk-text-secondary)', fontSize: 14 }}>Kelola voucher marketplace yang bisa digabung dengan voucher seller.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <section className="pk-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Buat Voucher</h2>
          <label className="pk-label">Kode</label>
          <input className="pk-input" value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Tipe</label>
          <select className="pk-select" value={form.discount_type} onChange={(event) => setForm((value) => ({ ...value, discount_type: event.target.value as VoucherPayload['discount_type'] }))}>
            <option value="percentage">Persentase</option>
            <option value="fixed_amount">Nominal</option>
            <option value="free_marketplace_fee">Gratis fee marketplace</option>
          </select>
          <label className="pk-label" style={{ marginTop: 12 }}>Nilai</label>
          <input className="pk-input" type="number" min={1} value={form.discount_value} onChange={(event) => setForm((value) => ({ ...value, discount_value: event.target.value }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Minimum Belanja</label>
          <input className="pk-input" type="number" min={0} value={form.min_purchase} onChange={(event) => setForm((value) => ({ ...value, min_purchase: event.target.value }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Maks Diskon</label>
          <input className="pk-input" type="number" min={1} value={form.max_discount} onChange={(event) => setForm((value) => ({ ...value, max_discount: event.target.value }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Kuota</label>
          <input className="pk-input" type="number" min={1} value={form.quota} onChange={(event) => setForm((value) => ({ ...value, quota: event.target.value }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Kategori</label>
          <select className="pk-select" value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}>
            {CATEGORIES.map((category) => <option key={category || 'all'} value={category}>{category || 'Semua kategori'}</option>)}
          </select>
          <label className="pk-label" style={{ marginTop: 12 }}>Mulai</label>
          <input className="pk-input" type="datetime-local" value={form.start_time} onChange={(event) => setForm((value) => ({ ...value, start_time: event.target.value }))} />
          <label className="pk-label" style={{ marginTop: 12 }}>Selesai</label>
          <input className="pk-input" type="datetime-local" value={form.end_time} onChange={(event) => setForm((value) => ({ ...value, end_time: event.target.value }))} />
          <button className="pk-btn pk-btn-primary pk-btn-block" style={{ marginTop: 16 }} disabled={createMutation.isPending} onClick={submit}>Buat Voucher</button>
        </section>

        <section className="pk-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 18, borderBottom: '1px solid var(--pk-border)', fontWeight: 600 }}>Voucher Marketplace</div>
          {vouchersQuery.isLoading ? <div style={{ padding: 24 }}>Memuat...</div> : (vouchersQuery.data ?? []).length === 0 ? <div style={{ padding: 24, color: 'var(--pk-text-hint)' }}>Belum ada voucher marketplace.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>{(vouchersQuery.data ?? []).map((voucher) => (
                <tr key={voucher.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                  <td style={{ padding: 14, fontWeight: 600 }}>{voucher.code}<br /><span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>{voucher.category || 'Semua kategori'}</span></td>
                  <td style={{ padding: 14 }}>{voucher.discount_type === 'percentage' ? `${voucher.discount_value}%` : voucher.discount_type === 'free_marketplace_fee' ? 'Gratis fee' : formatIDR(voucher.discount_value)}</td>
                  <td style={{ padding: 14, color: 'var(--pk-text-hint)' }}>{voucher.used_count}/{voucher.quota}</td>
                  <td style={{ padding: 14, textAlign: 'right' }}><button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => toggleMutation.mutate({ id: voucher.id, is_active: !voucher.is_active })}>{voucher.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
