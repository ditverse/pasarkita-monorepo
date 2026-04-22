'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import { useAuthStore } from '@/store/auth';

const NAV_LINKS = [
  { href: '/products', label: 'Browse' },
  { href: '/orders', label: 'Pesanan Saya' },
  { href: '/seller/products', label: 'Jual Produk' },
];

export function NavbarDesktop() {
  const pathname = usePathname();
  const active = NAV_LINKS.find((l) => pathname.startsWith(l.href))?.href ?? '';

  const { isAuthenticated, user, _hasHydrated } = useAuthStore();

  // Filter nav links based on auth state
  // "Jual Produk" stays visible for everyone — middleware handles redirect for non-sellers
  // "Pesanan Saya" only for logged-in users
  const visibleLinks = NAV_LINKS.filter((l) => {
    if (l.href === '/orders') return isAuthenticated;
    return true;
  });

  return (
    <header
      style={{
        height: 64,
        borderBottom: '1px solid var(--pk-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Link href="/" style={{ flex: '0 0 auto', textDecoration: 'none' }}>
        <Logo />
      </Link>
      <nav style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
        {visibleLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              color: active === l.href ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
              textDecoration: 'none',
              padding: '6px 0',
              borderBottom:
                active === l.href ? '1.5px solid var(--pk-text)' : '1.5px solid transparent',
              transition: 'color 150ms ease',
            }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Bell notification — only for logged-in users */}
        {_hasHydrated && isAuthenticated && (
          <button
            className="pk-btn pk-btn-ghost pk-btn-sm"
            style={{ height: 36, padding: '0 10px' }}
          >
            <Icon name="bell" size={18} />
          </button>
        )}

        {/* Auth section */}
        {!_hasHydrated ? (
          /* Skeleton while hydrating to prevent flash */
          <div style={{ width: 100, height: 36, borderRadius: 999, background: 'var(--pk-bg-subtle)' }} />
        ) : isAuthenticated && user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 10px 4px 4px',
              border: '1px solid var(--pk-border)',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            <Avatar name={user.name} size={28} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {user.name.split(' ')[0]}
              {user.name.split(' ').length > 1
                ? ` ${user.name.split(' ')[1][0]}.`
                : ''}
            </span>
          </div>
        ) : (
          <Link href="/auth/login" className="pk-btn pk-btn-primary pk-btn-sm">
            Masuk
          </Link>
        )}
      </div>
    </header>
  );
}

export function NavbarMobile({
  onOpenMenu,
  showCart = true,
}: {
  onOpenMenu?: () => void;
  showCart?: boolean;
}) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  return (
    <header
      style={{
        height: 56,
        borderBottom: '1px solid var(--pk-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: '#fff',
        justifyContent: 'space-between',
      }}
    >
      <button
        onClick={onOpenMenu}
        style={{ border: 'none', background: 'transparent', padding: 6, cursor: 'pointer' }}
      >
        <Icon name="menu" size={22} />
      </button>
      <Logo size={15} />
      {showCart && _hasHydrated && isAuthenticated ? (
        <Icon name="bell" size={20} />
      ) : (
        <span style={{ width: 22 }} />
      )}
    </header>
  );
}
