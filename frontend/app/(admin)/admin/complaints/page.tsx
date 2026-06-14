'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { complaintsApi } from '@/lib/api/complaints';
import { toast } from 'sonner';
import { Complaint } from '@/types/api';

export default function AdminComplaintsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('admin_review');

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['admin-complaints', filter],
    queryFn: async () => {
      const params: Record<string, string> = filter === 'all' ? {} : { status: filter };
      const res = await complaintsApi.getAll(params);
      return res.data.data;
    },
  });

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [action, setAction] = useState<'resolved' | 'rejected'>('resolved');
  const [notes, setNotes] = useState('');

  const resolveMutation = useMutation({
    mutationFn: (id: string) => complaintsApi.adminResolve(id, { action, notes }),
    onSuccess: () => {
      toast.success('Keputusan berhasil disimpan');
      setResolvingId(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Gagal menyimpan keputusan');
    }
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data komplain...</div>;

  return (
    <div style={{ maxWidth: 1000, marginInline: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Komplain & Sengketa</h1>
          <p style={{ color: 'var(--pk-text-secondary)', fontSize: 13 }}>Review dan putuskan sengketa antara pembeli dan penjual.</p>
        </div>
        <select className="pk-input" style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="open">Open (Menunggu Penjual)</option>
          <option value="seller_replied">Telah Direspons Penjual</option>
          <option value="admin_review">Butuh Keputusan Admin</option>
          <option value="resolved">Selesai / Diterima</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>

      {!complaints || complaints.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid var(--pk-border)' }}>
          <p style={{ color: 'var(--pk-text-secondary)' }}>Tidak ada data komplain ditemukan.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complaints.map((c: Complaint) => (
            <div key={c.id} className="pk-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: 'var(--pk-bg-subtle)', color: 'var(--pk-text-secondary)' }}>
                      Order: {c.order_id.slice(0, 8)}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                      background: c.status === 'admin_review' ? 'var(--pk-danger-soft)' : 'var(--pk-bg-subtle)',
                      color: c.status === 'admin_review' ? 'var(--pk-danger)' : 'var(--pk-text)',
                    }}>
                      {c.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pk-text)' }}>Jenis: {c.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>{new Date(c.created_at).toLocaleString('id-ID')}</div>
                </div>
                <Link href={`/admin/orders/${c.order_id}`} className="pk-btn pk-btn-ghost pk-btn-sm">
                  Lihat Detail Pesanan
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'var(--pk-bg-subtle)', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Keluhan Pembeli ({c.buyer?.name}):</div>
                  <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{c.description}</div>
                </div>

                <div style={{ background: c.seller_response ? 'var(--pk-accent-soft)' : 'var(--pk-bg-subtle)', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.seller_response ? 'var(--pk-accent)' : 'var(--pk-text-hint)', marginBottom: 4 }}>Tanggapan Penjual ({c.seller?.name}):</div>
                  <div style={{ fontSize: 13, color: c.seller_response ? 'var(--pk-text-secondary)' : 'var(--pk-text-hint)', lineHeight: 1.5 }}>
                    {c.seller_response || 'Belum ada tanggapan'}
                  </div>
                </div>
              </div>

              {c.admin_notes && (
                <div style={{ background: 'var(--pk-danger-soft)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-danger)', marginBottom: 4 }}>Catatan Admin:</div>
                  <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{c.admin_notes}</div>
                </div>
              )}

              {c.status === 'admin_review' && resolvingId !== c.id && (
                <button className="pk-btn pk-btn-primary" onClick={() => setResolvingId(c.id)}>
                  Berikan Keputusan Final
                </button>
              )}

              {resolvingId === c.id && (
                <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--pk-border)', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Keputusan Final</h4>
                  
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="action" checked={action === 'resolved'} onChange={() => setAction('resolved')} />
                      Terima Komplain Pembeli (Refund/Retur)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="action" checked={action === 'rejected'} onChange={() => setAction('rejected')} />
                      Tolak Komplain (Lanjut ke Penjual)
                    </label>
                  </div>

                  <textarea 
                    className="pk-textarea" 
                    rows={3} 
                    placeholder="Berikan alasan keputusan ini (wajib, min 5 karakter)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <button className="pk-btn pk-btn-secondary" onClick={() => { setResolvingId(null); setNotes(''); }} disabled={resolveMutation.isPending}>
                      Batal
                    </button>
                    <button className="pk-btn pk-btn-primary" onClick={() => resolveMutation.mutate(c.id)} disabled={resolveMutation.isPending || notes.length < 5}>
                      {resolveMutation.isPending ? 'Menyimpan...' : 'Simpan Keputusan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
