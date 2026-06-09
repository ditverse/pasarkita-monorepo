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
    users: (
      role: string,
      status: string,
      search = '',
      createdFrom = '',
      createdTo = '',
      sort = 'created_desc',
      page = 1
    ) => ['admin', 'users', role, status, search, createdFrom, createdTo, sort, page] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    analytics: (period: string, start?: string, end?: string) =>
      ['admin', 'analytics', period, start ?? null, end ?? null] as const,
  },
};
