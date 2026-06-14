'use client';

import Icon from './icon';
import { Product } from '@/types/api';
import { useAuthStore } from '@/store/auth';
import { useBuyerPreferencesStore } from '@/store/buyer-preferences';
import { toast } from 'sonner';

export default function WishlistButton({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const ownerKey = user?.id ?? 'guest';
  const items = useBuyerPreferencesStore((state) => state.wishlists[ownerKey]) ?? [];
  const toggleWishlist = useBuyerPreferencesStore((state) => state.toggleWishlist);
  const isSaved = items.some((item) => item.id === product.id);

  const handleToggle = () => {
    toggleWishlist(ownerKey, {
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sellerName: product.seller?.name || 'Toko Anonim',
      imageUrl: product.image_url,
      savedAt: new Date().toISOString(),
    });
    toast.success(isSaved ? 'Produk dihapus dari wishlist' : 'Produk disimpan ke wishlist');
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleToggle();
      }}
      className={compact ? 'pk-btn pk-btn-secondary pk-btn-sm' : 'pk-btn pk-btn-secondary'}
      aria-label={isSaved ? `Hapus ${product.name} dari wishlist` : `Simpan ${product.name} ke wishlist`}
      aria-pressed={isSaved}
      style={{ color: isSaved ? 'var(--pk-danger)' : 'var(--pk-text-secondary)' }}
    >
      <Icon name="heart" size={compact ? 14 : 16} />
      {!compact && (isSaved ? 'Tersimpan' : 'Simpan')}
    </button>
  );
}
