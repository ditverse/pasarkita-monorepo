'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';

const NAV_LINKS = [
  { href: '/products', label: 'Browse' },
  { href: '/orders', label: 'Pesanan Saya' },
  { href: '/seller/products', label: 'Jual Produk' },
];

export function NavbarDesktop({ loggedIn = true }: { loggedIn?: boolean }) {
  const pathname = usePathname();
  const active = NAV_LINKS.find((l) => pathname.startsWith(l.href))?.href ?? '';

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
        {NAV_LINKS.map((l) => (
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
        <button
          className="pk-btn pk-btn-ghost pk-btn-sm"
          style={{ height: 36, padding: '0 10px' }}
        >
          <Icon name="bell" size={18} />
        </button>
        {loggedIn ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 10px 4px 4px',
              border: '1px solid var(--pk-border)',
              borderRadius: 999,
            }}
          >
            <Avatar name="Rani Kusuma" size={28} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Rani K.</span>
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
      {showCart ? (
        <Icon name="bell" size={20} />
      ) : (
        <span style={{ width: 22 }} />
      )}
    </header>
  );
}
