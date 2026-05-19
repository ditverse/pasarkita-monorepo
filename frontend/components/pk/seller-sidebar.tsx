'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import { useAuthStore } from '@/store/auth';

const items = [
  { id: 'products', href: '/seller/products', label: 'Produk', icon: 'box' as const },
  { id: 'orders', href: '/seller/orders', label: 'Order Masuk', icon: 'bag' as const },
];

export default function SellerSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  
  const sellerName = user?.name || 'Seller';

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
            {i.label}
          </Link>
        );
      })}
      <div
        style={{
          marginTop: 'auto',
          padding: 8,
          borderTop: '1px solid var(--pk-border)',
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar name={sellerName} size={28} bg="#F3F4F6" color="#111827" />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{sellerName}</div>
          <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>Seller</div>
        </div>
      </div>
    </aside>
  );
}
