import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SavedProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  sellerName: string;
  imageUrl?: string | null;
  savedAt: string;
};

type BuyerPreferencesStore = {
  wishlists: Record<string, SavedProduct[]>;
  recentlyViewed: SavedProduct[];
  toggleWishlist: (ownerKey: string, product: SavedProduct) => void;
  addRecentlyViewed: (product: SavedProduct) => void;
};

export const useBuyerPreferencesStore = create<BuyerPreferencesStore>()(
  persist(
    (set) => ({
      wishlists: {},
      recentlyViewed: [],
      toggleWishlist: (ownerKey, product) => set((state) => {
        const current = state.wishlists[ownerKey] ?? [];
        const exists = current.some((item) => item.id === product.id);
        return {
          wishlists: {
            ...state.wishlists,
            [ownerKey]: exists
              ? current.filter((item) => item.id !== product.id)
              : [product, ...current].slice(0, 50),
          },
        };
      }),
      addRecentlyViewed: (product) => set((state) => ({
        recentlyViewed: [
          product,
          ...state.recentlyViewed.filter((item) => item.id !== product.id),
        ].slice(0, 12),
      })),
    }),
    { name: 'pk-buyer-preferences' }
  )
);
