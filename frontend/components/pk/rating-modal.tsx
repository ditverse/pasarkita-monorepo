'use client';

import { useState, useEffect } from 'react';
import Icon from './icon';
import Placeholder from './placeholder';
import { ratingsApi } from '@/lib/api/ratings';
import { toast } from 'sonner';
import { OrderItem } from '@/types/api';

// ── Stars component ───────────────────────────────────────────

function Stars({
  rating,
  size = 20,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || rating;

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={s <= active ? '#F59E0B' : 'none'}
          stroke={s <= active ? '#F59E0B' : '#D1D5DB'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ cursor: interactive ? 'pointer' : 'default', transition: 'fill 100ms, stroke 100ms' }}
          onClick={() => interactive && onChange?.(s)}
          onMouseEnter={() => interactive && setHovered(s)}
          onMouseLeave={() => interactive && setHovered(0)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export { Stars };

// ── Rating Modal ──────────────────────────────────────────────

interface RatingModalProps {
  orderId: string;
  items: OrderItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

const LABELS: Record<number, string> = {
  1: 'Sangat Buruk',
  2: 'Buruk',
  3: 'Cukup',
  4: 'Bagus',
  5: 'Sangat Bagus',
};

export default function RatingModal({ orderId, items, onClose, onSubmitted }: RatingModalProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Init semua item dengan rating 4
  useEffect(() => {
    const init: Record<string, number> = {};
    items.forEach((item) => { init[item.product_id] = 4; });
    setRatings(init);
  }, [items]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Submit rating untuk setiap item
      await Promise.all(
        items.map((item) =>
          ratingsApi.submit({
            order_id: orderId,
            product_id: item.product_id,
            rating: ratings[item.product_id] ?? 4,
            comment: comments[item.product_id]?.trim() || undefined,
          }).catch(() => null) // skip jika sudah pernah rating
        )
      );
      toast.success('Ulasan berhasil dikirim. Terima kasih!');
      onSubmitted();
    } catch {
      toast.error('Gagal mengirim ulasan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(17,24,39,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="pk-card"
        style={{ width: '100%', maxWidth: 480, padding: 28, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Beri Ulasan</h2>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
              <span className="pk-mono">{orderId.slice(0, 8).toUpperCase()}</span> · Pesanan selesai
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--pk-text-hint)', padding: 4 }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Per item */}
        {items.map((item, idx) => (
          <div key={item.product_id}>
            {idx > 0 && <div style={{ height: 1, background: 'var(--pk-border)', margin: '20px 0' }} />}

            {/* Product preview */}
            <div style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--pk-bg-subtle)', borderRadius: 10, marginBottom: 20 }}>
              <Placeholder label="produk" height={56} style={{ width: 56, flexShrink: 0, borderRadius: 8 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 2 }}>
                  Qty {item.qty}
                </div>
              </div>
            </div>

            {/* Stars */}
            <div style={{ textAlign: 'center', paddingBottom: 20, borderBottom: '1px solid var(--pk-border)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginBottom: 12 }}>
                Bagaimana pengalaman Anda?
              </div>
              <Stars
                rating={ratings[item.product_id] ?? 4}
                size={40}
                interactive
                onChange={(r) => setRatings((prev) => ({ ...prev, [item.product_id]: r }))}
              />
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pk-text)', marginTop: 12, height: 18 }}>
                {LABELS[ratings[item.product_id] ?? 4]}
              </div>
            </div>

            {/* Comment */}
            <label className="pk-label">
              Tulis ulasan{' '}
              <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>(opsional)</span>
            </label>
            <textarea
              className="pk-textarea"
              rows={3}
              placeholder="Ceritakan pengalamanmu..."
              value={comments[item.product_id] ?? ''}
              onChange={(e) => setComments((prev) => ({ ...prev, [item.product_id]: e.target.value }))}
              style={{ minHeight: 80 }}
            />
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="pk-btn pk-btn-ghost" onClick={onClose} disabled={submitting}>
            Lewati
          </button>
          <button className="pk-btn pk-btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
          </button>
        </div>
      </div>
    </div>
  );
}
