'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import Avatar from '@/components/pk/avatar';
import { Stars } from '@/components/pk/rating-modal';
import { formatIDR } from '@/lib/format';
import { useParams } from 'next/navigation';
import { productsApi } from '@/lib/api/products';
import { ratingsApi } from '@/lib/api/ratings';
import { Product, RatingSummary } from '@/types/api';
import { useCartStore } from '@/store/cart';
import { useBuyerPreferencesStore } from '@/store/buyer-preferences';
import WishlistButton from '@/components/pk/wishlist-button';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { chatsApi, type ProductChatThread } from '@/lib/api/chats';
import ProductChatPanel from '@/components/pk/product-chat-panel';

export default function ProductDetailPage() {
  const { id } = useParams();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [chatThread, setChatThread] = useState<ProductChatThread | null>(null);
  const [chatStarting, setChatStarting] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);
  const addRecentlyViewed = useBuyerPreferencesStore((state) => state.addRecentlyViewed);
  const recentlyViewed = useBuyerPreferencesStore((state) => state.recentlyViewed);

  useEffect(() => {
    if (!id) return;
    productsApi.getById(id as string)
      .then((res) => {
        setProduct(res.data.data);
        void ratingsApi.getByProduct(id as string)
          .then((ratingResponse) => setRatingSummary(ratingResponse.data.data))
          .catch((error) => console.error('Gagal mendapatkan ulasan:', error));
      })
      .catch((err) => {
        console.error('Gagal mendapatkan produk:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    addRecentlyViewed({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sellerName: product.seller?.name || 'Toko Anonim',
      imageUrl: product.image_url,
      savedAt: new Date().toISOString(),
    });
  }, [product, addRecentlyViewed]);

  if (loading) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat produk...</div>;
  }

  if (loadError) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Produk gagal dimuat</h2>
        <p style={{ color: 'var(--pk-text-secondary)' }}>Periksa koneksi lalu coba kembali.</p>
        <button type="button" className="pk-btn pk-btn-primary" onClick={() => window.location.reload()}>
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!product) {
    return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>Produk tidak ditemukan</div>;
  }

  const p = product;
  const subtotal = p.price * qty;
  const fee = Math.round(subtotal * 0.02);

  const handleAddToCart = () => {
    addItem({
      productId: p.id,
      name: p.name,
      price: p.price,
      qty,
      sellerName: p.seller?.name || 'Toko Anonim',
      stock: p.stock,
      imageUrl: p.image_url,
    });
    toast.success(`${qty} ${p.name} ditambahkan ke keranjang`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, text: `Lihat ${p.name} di PasarKita`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Tautan produk disalin');
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') toast.error('Gagal membagikan produk');
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      toast.error('Login sebagai buyer untuk chat penjual');
      window.location.href = '/auth/login';
      return;
    }
    if (user.role !== 'buyer') {
      toast.error('Chat penjual dari halaman produk hanya tersedia untuk buyer');
      return;
    }

    setChatStarting(true);
    try {
      const response = await chatsApi.startProductChat(p.id);
      setChatThread(response.data.data);
      toast.success('Chat penjual dibuka');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Gagal membuka chat penjual';
      toast.error(message);
    } finally {
      setChatStarting(false);
    }
  };

  return (
    <div className="pk-page-shell" style={{ padding: '20px 80px 64px' }}>
      <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', marginBottom: 16 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Beranda</Link>
        <span style={{ margin: '0 6px' }}>/</span>
        <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>{p.category || 'Belanja'}</Link>
        <span style={{ margin: '0 6px' }}>/</span>
        <span style={{ color: 'var(--pk-text)' }}>{p.name}</span>
      </div>

      <div className="pk-product-detail-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        {/* Images */}
        <div>
          <ProductImage
            src={p.image_url}
            alt={p.name}
            height={520}
            style={{ borderRadius: 12 }}
          />
        </div>

        {/* Info */}
        <div>
          <span className="pk-badge pk-badge-neutral" style={{ marginBottom: 12 }}>
            {p.category || 'Belanja'}
          </span>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              margin: '12px 0 12px',
              lineHeight: 1.15,
            }}
          >
            {p.name}
          </h1>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <WishlistButton product={p} />
            <button type="button" className="pk-btn pk-btn-ghost" onClick={handleShare}>
              <Icon name="arrowRight" size={14} /> Bagikan
            </button>
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              marginBottom: 24,
            }}
          >
            {formatIDR(p.price)}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 0',
              borderTop: '1px solid var(--pk-border)',
              borderBottom: '1px solid var(--pk-border)',
            }}
          >
            <Avatar name={p.seller?.name || "Toko"} size={40} bg="#F3F4F6" color="#111827" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.seller?.name || "Toko Anonim"}</div>
              <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Penjual terverifikasi</div>
            </div>
            {p.seller?.id && (
              <Link href={`/stores/${p.seller.id}`} className="pk-btn pk-btn-secondary pk-btn-sm">
                Kunjungi toko
              </Link>
            )}
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" disabled={chatStarting} onClick={() => void handleStartChat()}>
              <Icon name="message" size={14} /> {chatStarting ? 'Membuka...' : 'Chat Penjual'}
            </button>
          </div>

          {chatThread && (
            <div style={{ marginTop: 16 }}>
              <ProductChatPanel
                threadId={chatThread.id}
                title="Chat Penjual"
                subtitle={`${p.seller?.name || 'Penjual'} - ${p.name}`}
                onClose={() => setChatThread(null)}
              />
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Deskripsi</div>
            <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {p.description || "Tidak ada rincian yang diberikan oleh penjual."}
            </p>
          </div>

          {/* Rating summary singkat */}
          {ratingSummary && ratingSummary.summary.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <Stars rating={Math.round(ratingSummary.summary.average)} size={14} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{ratingSummary.summary.average}</span>
              <span style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>
                · {ratingSummary.summary.total} ulasan
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
            <span className="pk-label" style={{ margin: 0 }}>Jumlah</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--pk-border)',
                borderRadius: 8,
                height: 40,
              }}
            >
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                style={{
                  width: 40,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--pk-text-secondary)',
                }}
              >
                <Icon name="minus" size={14} />
              </button>
              <div
                style={{
                  width: 48,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  borderLeft: '1px solid var(--pk-border)',
                  borderRight: '1px solid var(--pk-border)',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty(Math.min(p.stock, qty + 1))}
                style={{
                  width: 40,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--pk-text-secondary)',
                }}
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--pk-text-hint)' }}>Stok: {p.stock}</span>
          </div>

          {/* Fee preview */}
          <div
            style={{
              background: 'var(--pk-bg-subtle)',
              borderRadius: 12,
              padding: 20,
              marginTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Row label="Subtotal" value={formatIDR(subtotal)} />
            <Row label="Fee marketplace (2%)" value={formatIDR(fee)} muted />
            <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
            <Row label="Total" value={formatIDR(subtotal + fee)} bold />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="pk-btn pk-btn-secondary pk-btn-lg"
              disabled={p.stock < 1}
              onClick={handleAddToCart}
            >
              <Icon name="cart" size={16} /> Tambah Keranjang
            </button>
            <Link href={`/checkout?productId=${p.id}&qty=${qty}`} style={{ textDecoration: 'none' }}>
              <button className="pk-btn pk-btn-primary pk-btn-lg pk-btn-block" disabled={p.stock < 1}>
                {p.stock > 0 ? <>Checkout <Icon name="arrowRight" size={16} /></> : 'Stok Habis'}
              </button>
            </Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', textAlign: 'center', marginTop: 12 }}>
            Pembayaran aman lewat SmartBank · Dana ditahan sampai barang diterima
          </div>
        </div>
      </div>

      {/* Rating Display — sesuai desain RatingDisplay */}
      {ratingSummary && (
        <div style={{ marginTop: 48 }}>
          <div className="pk-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', paddingRight: 32, borderRight: '1px solid var(--pk-border)', flexShrink: 0 }}>
                <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {ratingSummary.summary.average || '—'}
                </div>
                <Stars rating={Math.round(ratingSummary.summary.average)} size={16} />
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 6 }}>
                  {ratingSummary.summary.total} ulasan
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 2, 1].map((s) => {
                  const pct = ratingSummary.summary.distribution[s] ?? 0;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 10, color: 'var(--pk-text-secondary)' }}>{s}</span>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <div style={{ flex: 1, height: 6, background: 'var(--pk-bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#F59E0B', transition: 'width 400ms ease' }} />
                      </div>
                      <span style={{ width: 32, textAlign: 'right', color: 'var(--pk-text-hint)' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {ratingSummary.reviews.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Ulasan Pembeli</h3>
                <select
                  className="pk-select"
                  value={reviewFilter ?? ''}
                  onChange={(event) => setReviewFilter(event.target.value ? Number(event.target.value) : null)}
                  aria-label="Filter ulasan berdasarkan bintang"
                  style={{ width: 150 }}
                >
                  <option value="">Semua Bintang</option>
                  {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{star} Bintang</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ratingSummary.reviews
                  .filter((review) => reviewFilter === null || review.rating === reviewFilter)
                  .slice(0, 5)
                  .map((r) => (
                  <div key={r.id} className="pk-card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Avatar name={r.buyer_name} size={32} bg="#F3F4F6" color="#111827" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.buyer_name}</div>
                        <span className="pk-badge pk-badge-active" style={{ marginTop: 4, fontSize: 10 }}>
                          Pembelian Terverifikasi
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <Stars rating={r.rating} size={11} />
                          <span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>
                            {new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {r.comment && (
                      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '10px 0 0', lineHeight: 1.55 }}>
                        {r.comment}
                      </p>
                    )}
                    {r.image_urls && r.image_urls.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8, marginTop: 12 }}>
                        {r.image_urls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { setSelectedPhotos(r.image_urls); setPhotoModalOpen(true); }}
                            style={{ width: '100%', paddingBottom: '100%', position: 'relative', border: 'none', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--pk-bg-subtle)' }}
                          >
                            <img src={url} alt={`Review photo ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {ratingSummary.reviews.filter((review) => reviewFilter === null || review.rating === reviewFilter).length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--pk-text-hint)', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
                    Belum ada ulasan {reviewFilter} bintang.
                  </div>
                )}
              </div>
            </>
          )}

          {ratingSummary.reviews.length === 0 && (
            <div style={{ padding: '32px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12, color: 'var(--pk-text-hint)', fontSize: 13 }}>
              Belum ada ulasan untuk produk ini.
            </div>
          )}
        </div>
      )}

      {recentlyViewed.filter((item) => item.id !== p.id).length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 18px' }}>Terakhir Dilihat</h2>
          <div className="pk-product-grid">
            {recentlyViewed.filter((item) => item.id !== p.id).slice(0, 4).map((item) => (
              <Link key={item.id} href={`/products/${item.id}`} className="pk-card pk-card-hover" style={{ overflow: 'hidden', textDecoration: 'none' }}>
                <ProductImage src={item.imageUrl} alt={item.name} height={150} style={{ borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div style={{ color: 'var(--pk-text)', fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ color: 'var(--pk-text-hint)', fontSize: 12, marginTop: 3 }}>{item.sellerName}</div>
                  <div style={{ color: 'var(--pk-text)', fontWeight: 600, marginTop: 8 }}>{formatIDR(item.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {photoModalOpen && selectedPhotos.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPhotoModalOpen(false)}>
          <button onClick={() => setPhotoModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <Icon name="x" size={24} />
          </button>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', overflowX: 'auto', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            {selectedPhotos.map((url, idx) => (
              <img key={idx} src={url} alt={`Photo ${idx + 1}`} style={{ maxHeight: '80vh', maxWidth: '90vw', borderRadius: 8, objectFit: 'contain' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: bold ? 15 : 13,
          color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)',
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: bold ? 17 : 14,
          color: 'var(--pk-text)',
          fontWeight: bold ? 600 : 500,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
    </div>
  );
}
