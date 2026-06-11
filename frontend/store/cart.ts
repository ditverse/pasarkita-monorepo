import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  sellerName: string;
  stock: number;
  imageUrl?: string | null;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const existing = state.items.find((current) => current.productId === item.productId);
        if (existing) {
          return {
            items: state.items.map((current) =>
              current.productId === item.productId
                ? {
                    ...current,
                    ...item,
                    qty: Math.min(current.qty + item.qty, item.stock),
                  }
                : current
            ),
          };
        }
        return { items: [...state.items, { ...item, qty: Math.min(item.qty, item.stock) }] };
      }),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter((item) => item.productId !== productId),
      })),
      updateQty: (productId, qty) => set((state) => ({
        items: state.items.map((item) =>
          item.productId === productId
            ? { ...item, qty: Math.max(1, Math.min(qty, item.stock)) }
            : item
        ),
      })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((total, item) => total + item.price * item.qty, 0),
      itemCount: () => get().items.reduce((total, item) => total + item.qty, 0),
    }),
    { name: 'pk-cart' }
  )
);
