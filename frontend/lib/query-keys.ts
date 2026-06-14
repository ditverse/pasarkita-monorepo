export const queryKeys = {
  products: {
    home: (search: string) => ['products', 'home', search] as const,
    seller: (sellerId: string | undefined, ...filters: unknown[]) =>
      ['products', 'seller', sellerId ?? null, ...filters] as const,
  },
  orders: {
    list: (scope: string, ...filters: unknown[]) => ['orders', scope, ...filters] as const,
  },
  seller: {
    analytics: (period: string, dateFrom?: string, dateTo?: string) =>
      ['seller', 'analytics', period, dateFrom ?? null, dateTo ?? null] as const,
    profile: () => ['seller', 'profile'] as const,
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
    moderationProducts: (search: string, status: string, stock: string, page: number) =>
      ['admin', 'moderation', 'products', search, status, stock, page] as const,
    moderationSellers: (search: string, status: string, page: number) =>
      ['admin', 'moderation', 'sellers', search, status, page] as const,
    moderationProduct: (id: string) => ['admin', 'moderation', 'product', id] as const,
    analytics: (period: string, start?: string, end?: string) =>
      ['admin', 'analytics', period, start ?? null, end ?? null] as const,
    health: (period: string) => ['admin', 'health', period] as const,
    feeSimulator: (period: string, rate: number, start?: string, end?: string) =>
      ['admin', 'fee-simulator', period, rate, start ?? null, end ?? null] as const,
  },
};
