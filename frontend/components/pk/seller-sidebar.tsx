'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import { useAuthStore } from '@/store/auth';
import { ordersApi } from '@/lib/api/orders';
import { queryKeys } from '@/lib/query-keys';

const items = [
  { id: 'products', href: '/seller/products', label: 'Produk', icon: 'box' as const },
  { id: 'orders', href: '/seller/orders', label: 'Order Masuk', icon: 'bag' as const },
];

export default function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const paidOrdersQuery = useQuery({
    queryKey: queryKeys.orders.list('seller-sidebar', 'paid'),
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'paid', limit: 100 });
      return response.data.data ?? [];
    },
    enabled: Boolean(user?.id),
  });
  
  const sellerName = user?.name || 'Seller';
  const newOrderCount = paidOrdersQuery.data?.length ?? 0;

  const handleLogout = () => {
    if (!window.confirm('Keluar dari Seller Center?')) return;
    logout();
    router.replace('/auth/login');
    router.refresh();
  };

  return (
    <aside
      style={{
        width: 200,
        borderRight: '1px solid var(--pk-border)',
        background: '#fff',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: '100vh',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '4px 8px 20px' }}>
        <Logo size={16} />
      </div>
      <div
        style={{
          padding: '4px 8px 8px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--pk-text-hint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Seller
      </div>
      {items.map((i) => {
        const isActive = pathname.startsWith(i.href);
        return (
          <Link
            key={i.id}
            href={i.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              background: isActive ? 'var(--pk-bg-subtle)' : 'transparent',
              color: isActive ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background 150ms ease',
            }}
          >
            <Icon name={i.icon} size={16} />
            <span style={{ flex: 1 }}>{i.label}</span>
            {i.id === 'orders' && newOrderCount > 0 && (
              <span style={{
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--pk-danger-soft)',
                color: 'var(--pk-danger)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {newOrderCount > 99 ? '99+' : newOrderCount}
              </span>
            )}
          </Link>
        );
      })}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 36,
            padding: '0 10px',
            borderRadius: 8,
            color: 'var(--pk-text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <Icon name="home" size={16} />
          Buka Marketplace
        </Link>

        <div
          style={{
            marginTop: 8,
            padding: '12px 8px',
            borderTop: '1px solid var(--pk-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Avatar name={sellerName} size={30} bg="#F3F4F6" color="#111827" />
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sellerName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>Seller</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="pk-btn pk-btn-block"
          style={{
            color: 'var(--pk-danger)',
            border: '1px solid var(--pk-border)',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="logout" size={14} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
