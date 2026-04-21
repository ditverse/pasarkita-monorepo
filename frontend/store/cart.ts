import { create } from 'zustand';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  sellerName: string;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.productId === item.productId);
    if (existing) {
      return {
        items: state.items.map(i => i.productId === item.productId ? { ...i, qty: i.qty + item.qty } : i)
      };
    }
    return { items: [...state.items, item] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),
  updateQty: (productId, qty) => set((state) => ({
    items: state.items.map(i => i.productId === productId ? { ...i, qty } : i)
  })),
  clearCart: () => set({ items: [] }),
  total: () => {
    return get().items.reduce((total, item) => total + (item.price * item.qty), 0);
  }
}));
