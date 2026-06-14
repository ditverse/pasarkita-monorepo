'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { complaintsApi } from '@/lib/api/complaints';
import { toast } from 'sonner';

export default function SellerComplaintsPage() {
  const queryClient = useQueryClient();
  const { data: complaints, isLoading } = useQuery({
    queryKey: ['seller-complaints'],
    queryFn: async () => {
      const res = await complaintsApi.getAll();
      return res.data.data;
    },
  });

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const replyMutation = useMutation({
    mutationFn: (id: string) => complaintsApi.reply(id, { reply: replyText }),
    onSuccess: () => {
      toast.success('Tanggapan berhasil dikirim');
      setReplyingTo(null);
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['seller-complaints'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Gagal mengirim tanggapan');
    }
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat komplain...</div>;

  if (!complaints || complaints.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 12 }}>Tidak ada komplain aktif.</h2>
        <p style={{ color: 'var(--pk-text-secondary)' }}>Semua transaksi berjalan lancar.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, marginInline: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Komplain & Sengketa</h1>
          <p style={{ color: 'var(--pk-text-secondary)', fontSize: 13 }}>Selesaikan masalah pesanan dengan pembeli.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {complaints.map((c) => (
          <div key={c.id} className="pk-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: 'var(--pk-bg-subtle)', color: 'var(--pk-text-secondary)' }}>
                    Order: {c.order_id.slice(0, 8)}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                    background: c.status === 'open' ? 'var(--pk-warning-soft)' : c.status === 'seller_replied' ? 'var(--pk-accent-soft)' : c.status === 'resolved' ? 'var(--pk-success-soft)' : 'var(--pk-danger-soft)',
                    color: c.status === 'open' ? 'var(--pk-warning)' : c.status === 'seller_replied' ? 'var(--pk-accent)' : c.status === 'resolved' ? 'var(--pk-success)' : 'var(--pk-danger)',
                  }}>
                    {c.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pk-text)' }}>Jenis: {c.type}</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>{new Date(c.created_at).toLocaleString('id-ID')}</div>
              </div>
              <Link href={`/seller/orders/${c.order_id}`} className="pk-btn pk-btn-ghost pk-btn-sm">
                Lihat Pesanan
              </Link>
            </div>

            <div style={{ background: 'var(--pk-bg-subtle)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pesan Pembeli ({c.buyer?.name}):</div>
              <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{c.description}</div>
            </div>

            {c.seller_response && (
              <div style={{ background: 'var(--pk-accent-soft)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-accent)', marginBottom: 4 }}>Tanggapan Anda:</div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{c.seller_response}</div>
              </div>
            )}

            {c.admin_notes && (
              <div style={{ background: 'var(--pk-danger-soft)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-danger)', marginBottom: 4 }}>Keputusan Admin:</div>
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5 }}>{c.admin_notes}</div>
              </div>
            )}

            {c.status === 'open' && replyingTo !== c.id && (
              <button className="pk-btn pk-btn-primary" onClick={() => setReplyingTo(c.id)}>
                Beri Tanggapan / Solusi
              </button>
            )}

            {replyingTo === c.id && (
              <div style={{ marginTop: 16 }}>
                <textarea 
                  className="pk-textarea" 
                  rows={4} 
                  placeholder="Tawarkan solusi seperti penukaran barang, refund, atau klarifikasi..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button className="pk-btn pk-btn-secondary" onClick={() => { setReplyingTo(null); setReplyText(''); }} disabled={replyMutation.isPending}>
                    Batal
                  </button>
                  <button className="pk-btn pk-btn-primary" onClick={() => replyMutation.mutate(c.id)} disabled={replyMutation.isPending || replyText.length < 10}>
                    {replyMutation.isPending ? 'Mengirim...' : 'Kirim Tanggapan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
