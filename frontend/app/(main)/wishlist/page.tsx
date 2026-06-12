'use client';

import Link from 'next/link';
import ProductImage from '@/components/pk/product-image';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { useBuyerPreferencesStore } from '@/store/buyer-preferences';

export default function WishlistPage() {
  const user = useAuthStore((state) => state.user);
  const ownerKey = user?.id ?? 'guest';
  const items = useBuyerPreferencesStore((state) => state.wishlists[ownerKey] ?? []);
  const toggleWishlist = useBuyerPreferencesStore((state) => state.toggleWishlist);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px, 6vw, 80px) 64px' }}>
      <h1 style={{ fontSize: 28, margin: '0 0 4px' }}>Wishlist</h1>
      <p style={{ color: 'var(--pk-text-secondary)', fontSize: 14, margin: '0 0 28px' }}>
        {items.length} produk tersimpan {user ? 'di akun ini' : 'di browser ini'}.
      </p>

      {items.length === 0 ? (
        <div style={{ padding: '72px 24px', textAlign: 'center', border: '1px dashed var(--pk-border)', borderRadius: 12 }}>
          <Icon name="heart" size={28} style={{ color: 'var(--pk-text-hint)' }} />
          <h2 style={{ fontSize: 18 }}>Belum ada produk favorit</h2>
          <Link href="/products" className="pk-btn pk-btn-primary">Jelajahi Produk</Link>
        </div>
      ) : (
        <div className="pk-product-grid">
          {items.map((item) => (
            <div key={item.id} className="pk-card pk-card-hover" style={{ overflow: 'hidden' }}>
              <Link href={`/products/${item.id}`} style={{ textDecoration: 'none' }}>
                <ProductImage src={item.imageUrl} alt={item.name} height={180} style={{ borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div style={{ color: 'var(--pk-text)', fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ color: 'var(--pk-text-hint)', fontSize: 12, marginTop: 4 }}>{item.sellerName}</div>
                  <div style={{ color: 'var(--pk-text)', fontSize: 15, fontWeight: 600, marginTop: 10 }}>{formatIDR(item.price)}</div>
                </div>
              </Link>
              <div style={{ padding: '0 14px 14px' }}>
                <button
                  type="button"
                  className="pk-btn pk-btn-secondary pk-btn-sm pk-btn-block"
                  onClick={() => toggleWishlist(ownerKey, item)}
                >
                  Hapus dari Wishlist
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
