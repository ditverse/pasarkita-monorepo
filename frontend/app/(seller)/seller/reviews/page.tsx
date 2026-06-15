'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/lib/api/seller';
import { ratingsApi } from '@/lib/api/ratings';
import { Stars } from '@/components/pk/rating-modal';
import Avatar from '@/components/pk/avatar';
import Icon from '@/components/pk/icon';
import { toast } from 'sonner';
import type { SellerReview } from '@/types/api';

type ReplyFilter = 'all' | 'unreplied' | 'replied';

export default function SellerReviewsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReplyFilter>('all');
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const params: { replied?: boolean; rating?: number; page: number; limit: number } = {
    page,
    limit: 15,
  };
  if (filter === 'replied') params.replied = true;
  if (filter === 'unreplied') params.replied = false;
  if (starFilter) params.rating = starFilter;

  const reviewsQuery = useQuery({
    queryKey: ['seller-reviews', filter, starFilter, page],
    queryFn: async () => (await sellerApi.getReviews(params)).data.data,
  });

  const data = reviewsQuery.data;
  const reviews = data?.reviews ?? [];
  const pagination = data?.pagination;

  const replyMutation = useMutation({
    mutationFn: ({ ratingId, reply }: { ratingId: string; reply: string }) =>
      ratingsApi.replyToRating(ratingId, reply),
    onSuccess: () => {
      toast.success('Balasan berhasil dikirim');
      setReplyingTo(null);
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['seller-reviews'] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Gagal membalas ulasan';
      toast.error(message);
    },
  });

  const handleReplySubmit = useCallback(
    (ratingId: string) => {
      const trimmed = replyText.trim();
      if (!trimmed) {
        toast.error('Balasan tidak boleh kosong');
        return;
      }
      if (trimmed.length > 500) {
        toast.error('Balasan maksimal 500 karakter');
        return;
      }
      replyMutation.mutate({ ratingId, reply: trimmed });
    },
    [replyText, replyMutation]
  );

  const handleFilterChange = (newFilter: ReplyFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleStarFilterChange = (star: number | null) => {
    setStarFilter(star);
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Ulasan Produk
        </h1>
        <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
          Lihat dan balas ulasan dari pembeli untuk produk toko Anda
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Reply filter tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--pk-bg-subtle)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          {([
            { value: 'all' as const, label: 'Semua' },
            { value: 'unreplied' as const, label: 'Belum Dibalas' },
            { value: 'replied' as const, label: 'Sudah Dibalas' },
          ]).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleFilterChange(tab.value)}
              style={{
                height: 30,
                padding: '0 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === tab.value ? '#fff' : 'transparent',
                color: filter === tab.value ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                boxShadow: filter === tab.value ? 'var(--pk-shadow-sm)' : 'none',
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Star filter */}
        <select
          className="pk-select"
          value={starFilter ?? ''}
          onChange={(e) => handleStarFilterChange(e.target.value ? Number(e.target.value) : null)}
          aria-label="Filter bintang"
          style={{ width: 150 }}
        >
          <option value="">Semua Bintang</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={s}>{s} Bintang</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {reviewsQuery.isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
          <Icon name="loader" size={24} style={{ animation: 'pk-spin 0.8s linear infinite', marginBottom: 8 }} />
          <div>Memuat ulasan...</div>
        </div>
      )}

      {/* Error */}
      {reviewsQuery.isError && (
        <div className="pk-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Gagal memuat ulasan</div>
          <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void reviewsQuery.refetch()}>
            Coba Lagi
          </button>
        </div>
      )}

      {/* Reviews list */}
      {!reviewsQuery.isLoading && !reviewsQuery.isError && (
        <>
          {reviews.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                border: '1px dashed var(--pk-border)',
                borderRadius: 12,
                color: 'var(--pk-text-hint)',
                fontSize: 13,
              }}
            >
              {filter === 'unreplied'
                ? 'Semua ulasan sudah dibalas. Bagus!'
                : 'Belum ada ulasan untuk produk toko Anda.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviews.map((review: SellerReview) => (
                <div key={review.id} className="pk-card" style={{ padding: 18 }}>
                  {/* Review header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Avatar name={review.buyer_name} size={36} bg="#F3F4F6" color="#111827" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{review.buyer_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <Stars rating={review.rating} size={12} />
                            <span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>
                              {new Date(review.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <span className="pk-badge pk-badge-neutral" style={{ fontSize: 10, flexShrink: 0 }}>
                          {review.product_name}
                        </span>
                      </div>

                      {/* Review comment */}
                      {review.comment && (
                        <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '10px 0 0', lineHeight: 1.55 }}>
                          {review.comment}
                        </p>
                      )}

                      {/* Review photos */}
                      {review.image_urls && review.image_urls.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {review.image_urls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Review photo ${idx + 1}`}
                              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--pk-border)' }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Existing seller reply */}
                      {review.seller_reply ? (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '10px 14px',
                            background: 'var(--pk-bg-subtle)',
                            borderRadius: 8,
                            borderLeft: '3px solid var(--pk-accent)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Icon name="checkCircle" size={12} style={{ color: 'var(--pk-accent)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pk-accent)' }}>
                              Balasan Anda
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--pk-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            {review.seller_reply}
                          </p>
                          {review.seller_replied_at && (
                            <div style={{ fontSize: 10, color: 'var(--pk-text-hint)', marginTop: 4 }}>
                              {new Date(review.seller_replied_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Reply form */
                        <div style={{ marginTop: 12 }}>
                          {replyingTo === review.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <textarea
                                className="pk-textarea"
                                rows={2}
                                placeholder="Tulis balasan Anda..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                maxLength={500}
                                style={{ minHeight: 60, fontSize: 12 }}
                                disabled={replyMutation.isPending}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: 'var(--pk-text-hint)' }}>
                                  {replyText.length}/500
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-ghost pk-btn-sm"
                                    onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                    disabled={replyMutation.isPending}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-primary pk-btn-sm"
                                    onClick={() => handleReplySubmit(review.id)}
                                    disabled={replyMutation.isPending || !replyText.trim()}
                                  >
                                    {replyMutation.isPending ? 'Mengirim...' : 'Kirim Balasan'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="pk-btn pk-btn-secondary pk-btn-sm"
                              onClick={() => { setReplyingTo(review.id); setReplyText(''); }}
                              style={{ gap: 6 }}
                            >
                              <Icon name="message" size={12} /> Balas Ulasan
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevronLeft" size={14} /> Sebelumnya
              </button>
              <span style={{ fontSize: 12, color: 'var(--pk-text-secondary)', padding: '0 8px' }}>
                Halaman {pagination.page} dari {pagination.total_pages}
              </span>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-sm"
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Selanjutnya <Icon name="chevronRight" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
