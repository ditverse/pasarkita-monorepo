'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi } from '@/lib/api/complaints';
import { toast } from 'sonner';
import { Complaint, Order } from '@/types/api';

export default function ComplaintPanel({ order, userRole }: { order: Order, userRole: string | undefined }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('damaged');
  const [description, setDescription] = useState('');

  // Cari komplain yang terkait dengan order ini
  // Karena tidak ada endpoint getByOrderId, kita ambil semua dan filter
  const { data: complaints, isLoading } = useQuery({
    queryKey: ['complaints', 'order', order.id],
    queryFn: async () => {
      const res = await complaintsApi.getAll();
      return res.data.data.filter((c: Complaint) => c.order_id === order.id);
    },
    enabled: !!order.id && userRole === 'buyer',
  });

  const complaint = complaints?.[0];

  const createMutation = useMutation({
    mutationFn: () => complaintsApi.create(order.id, { type, description }),
    onSuccess: () => {
      toast.success('Komplain berhasil diajukan');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['complaints', 'order', order.id] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Gagal mengajukan komplain');
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (accepted: boolean) => complaintsApi.resolve(complaint!.id, { accepted }),
    onSuccess: (_, accepted) => {
      toast.success(accepted ? 'Sengketa diselesaikan' : 'Dieskalasi ke admin');
      queryClient.invalidateQueries({ queryKey: ['complaints', 'order', order.id] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Gagal memproses aksi');
    }
  });

  if (isLoading) return null;

  if (!complaint && !showForm) {
    if (userRole === 'buyer' && (order.status === 'shipped' || order.status === 'delivered')) {
      return (
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="pk-btn pk-btn-ghost" style={{ color: 'var(--pk-warning)' }} onClick={() => setShowForm(true)}>
            Ajukan Komplain
          </button>
        </div>
      );
    }
    return null;
  }

  if (showForm && !complaint) {
    return (
      <div className="pk-card" style={{ padding: 24, marginTop: 24, borderColor: 'var(--pk-warning)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--pk-warning)' }}>Ajukan Komplain</h3>
        <div style={{ marginBottom: 16 }}>
          <label className="pk-label">Masalah Utama</label>
          <select className="pk-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="damaged">Barang Rusak</option>
            <option value="missing_item">Barang Kurang</option>
            <option value="wrong_item">Barang Tidak Sesuai</option>
            <option value="not_received">Paket Tidak Sampai</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="pk-label">Deskripsi Lengkap</label>
          <textarea 
            className="pk-textarea" 
            rows={4} 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan masalah secara detail (min. 10 karakter)..."
          />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="pk-btn pk-btn-secondary" onClick={() => setShowForm(false)} disabled={createMutation.isPending}>Batal</button>
          <button className="pk-btn pk-btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || description.length < 10}>
            {createMutation.isPending ? 'Mengirim...' : 'Kirim Komplain'}
          </button>
        </div>
      </div>
    );
  }

  if (complaint) {
    const STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
      open: { label: 'Menunggu Respons Penjual', color: 'var(--pk-warning)', bg: 'var(--pk-warning-soft)' },
      seller_replied: { label: 'Penjual Telah Merespons', color: 'var(--pk-accent)', bg: 'var(--pk-accent-soft)' },
      admin_review: { label: 'Ditinjau oleh Admin', color: 'var(--pk-danger)', bg: 'var(--pk-danger-soft)' },
      resolved: { label: 'Selesai / Diterima', color: 'var(--pk-success)', bg: 'var(--pk-success-soft)' },
      rejected: { label: 'Ditolak Admin', color: 'var(--pk-text-secondary)', bg: 'var(--pk-bg-subtle)' },
    };

    const st = STATUS_MAP[complaint.status] || STATUS_MAP.open;

    return (
      <div className="pk-card" style={{ padding: 24, marginTop: 24, borderColor: st.color }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: st.color }}>Pusat Resolusi</h3>
          <span style={{ fontSize: 12, fontWeight: 600, color: st.color, background: st.bg, padding: '4px 8px', borderRadius: 6 }}>
            {st.label}
          </span>
        </div>
        
        <div style={{ background: 'var(--pk-bg-subtle)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Komplain Anda ({complaint.type})</div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{complaint.description}</div>
          <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 8 }}>{new Date(complaint.created_at).toLocaleString('id-ID')}</div>
        </div>

        {complaint.seller_response && (
          <div style={{ background: 'var(--pk-accent-soft)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-accent)', marginBottom: 4 }}>Tanggapan Penjual ({complaint.seller?.name})</div>
            <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{complaint.seller_response}</div>
          </div>
        )}

        {complaint.admin_notes && (
          <div style={{ background: 'var(--pk-danger-soft)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-danger)', marginBottom: 4 }}>Keputusan Admin</div>
            <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{complaint.admin_notes}</div>
          </div>
        )}

        {complaint.status === 'seller_replied' && userRole === 'buyer' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="pk-btn pk-btn-ghost" style={{ color: 'var(--pk-danger)' }} onClick={() => resolveMutation.mutate(false)} disabled={resolveMutation.isPending}>
              Tolak & Eskalasi ke Admin
            </button>
            <button className="pk-btn pk-btn-primary" onClick={() => resolveMutation.mutate(true)} disabled={resolveMutation.isPending}>
              Terima Solusi
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
