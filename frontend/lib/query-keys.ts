export const queryKeys = {
  products: {
    home: (search: string) => ['products', 'home', search] as const,
    seller: (sellerId: string | undefined, search: string) =>
      ['products', 'seller', sellerId ?? null, search] as const,
  },
  orders: {
    list: (scope: string, status?: string) => ['orders', scope, status ?? null] as const,
  },
  admin: {
    users: (role: string, status: string) => ['admin', 'users', role, status] as const,
    analytics: ['admin', 'analytics'] as const,
  },
};
