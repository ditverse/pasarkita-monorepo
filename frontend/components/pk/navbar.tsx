'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import NotificationDropdown, { type Notification } from './notification-dropdown';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';

const NAV_LINKS = [
  { href: '/products', label: 'Browse' },
  { href: '/orders', label: 'Pesanan Saya' },
  { href: '/seller/products', label: 'Jual Produk' },
];

// Notifikasi kosong by default — akan diisi saat backend notifikasi tersedia
const INITIAL_NOTIFICATIONS: Notification[] = [];

export function NavbarDesktop() {
  const pathname = usePathname();
  const active = NAV_LINKS.find((l) => pathname.startsWith(l.href))?.href ?? '';
  const { token, user, _hasHydrated } = useAuthStore();
  const cartCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.qty, 0)
  );
  const isLoggedIn = _hasHydrated && Boolean(token && user);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const visibleLinks = NAV_LINKS.filter((l) => {
    if (l.href === '/orders') return isLoggedIn;
    return true;
  });

  return (
    <header
      className="pk-main-navbar"
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

      <nav className="pk-main-nav-links" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
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
        <Link
          href="/wishlist"
          className="pk-btn pk-btn-ghost pk-btn-sm"
          style={{ height: 36, padding: '0 10px' }}
          aria-label="Wishlist"
        >
          <Icon name="heart" size={18} />
        </Link>
        <Link
          href="/cart"
          className="pk-btn pk-btn-ghost pk-btn-sm"
          style={{ height: 36, padding: '0 10px', position: 'relative' }}
          aria-label={`Keranjang, ${cartCount} barang`}
        >
          <Icon name="cart" size={18} />
          {cartCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--pk-danger)',
              color: '#fff',
              border: '2px solid #fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 9,
              fontWeight: 700,
            }}>
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {/* Bell — hanya untuk user yang sudah login */}
        {isLoggedIn && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="pk-btn pk-btn-ghost pk-btn-sm"
              style={{ height: 36, padding: '0 10px', position: 'relative' }}
              aria-label="Notifikasi"
            >
              <Icon name="bell" size={18} />
              {/* Badge unread */}
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--pk-danger)',
                    border: '2px solid #fff',
                  }}
                />
              )}
            </button>

            {notifOpen && (
              <NotificationDropdown
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>
        )}

        {/* Auth section */}
        {isLoggedIn && user ? (
          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 10px 4px 4px',
                border: '1px solid var(--pk-border)',
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'border-color 150ms ease',
              }}
            >
              <Avatar name={user.name} size={28} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pk-text)' }}>
                {user.name.split(' ')[0]}
                {user.name.split(' ').length > 1 ? ` ${user.name.split(' ')[1][0]}.` : ''}
              </span>
            </div>
          </Link>
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
  const { token, user, _hasHydrated } = useAuthStore();
  const isLoggedIn = _hasHydrated && Boolean(token && user);

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
      {showCart && isLoggedIn ? (
        <Icon name="bell" size={20} />
      ) : (
        <span style={{ width: 22 }} />
      )}
    </header>
  );
}
