'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './logo';
import Icon from './icon';

const items = [
  { id: 'overview', href: '/admin', label: 'Overview', icon: 'grid' as const },
  { id: 'users', href: '/admin/users', label: 'Semua User', icon: 'users' as const },
  { id: 'orders', href: '/admin/orders', label: 'Semua Order', icon: 'bag' as const },
  { id: 'analytics', href: '/admin/analytics', label: 'Analytics', icon: 'barChart' as const },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside
      style={{
        width: 220,
        borderRight: '1px solid var(--pk-border)',
        background: '#fff',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: '100vh',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '4px 8px 4px' }}>
        <Logo size={16} />
      </div>
      <div
        style={{
          padding: '0 8px 20px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--pk-text-hint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Admin Panel
      </div>
      {items.map((i) => {
        const isActive =
          i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href);
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
            }}
          >
            <Icon name={i.icon} size={16} />
            {i.label}
          </Link>
        );
      })}
    </aside>
  );
}
