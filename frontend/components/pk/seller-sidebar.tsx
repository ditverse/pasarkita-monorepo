'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import NotificationDropdown from './notification-dropdown';
import { useAuthStore } from '@/store/auth';
import { ordersApi } from '@/lib/api/orders';
import { notificationsApi } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';
import { BuyerNotification } from '@/types/api';

const items = [
  { id: 'dashboard', href: '/seller', label: 'Dashboard', icon: 'barChart' as const, exact: true },
  { id: 'products', href: '/seller/products', label: 'Produk', icon: 'box' as const },
  { id: 'orders', href: '/seller/orders', label: 'Order Masuk', icon: 'bag' as const },
  { id: 'complaints', href: '/seller/complaints', label: 'Komplain', icon: 'clipboard' as const },
  { id: 'settings', href: '/seller/settings', label: 'Pengaturan Toko', icon: 'store' as const },
];

export default function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  const [notifOpen, setNotifOpen] = useState(false);

  // Badge order yang perlu ditindaklanjuti (paid)
  const paidOrdersQuery = useQuery({
    queryKey: queryKeys.orders.list('seller-sidebar', 'paid'),
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'paid', limit: 100 });
      return response.data.data ?? [];
    },
    enabled: Boolean(user?.id),
  });

  // Notifikasi seller — polling tiap 30 detik
  const notifQueryKey = ['seller-notifications', user?.id];
  const notifQuery = useQuery({
    queryKey: notifQueryKey,
    queryFn: async () => (await notificationsApi.getAll(30)).data.data,
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
  });
  const notifications = notifQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () =>
      queryClient.setQueryData<BuyerNotification[]>(notifQueryKey, (cur = []) =>
        cur.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      ),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData<BuyerNotification[]>(notifQueryKey, (cur = []) =>
        cur.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
      ),
  });

  const handleNotifSelect = useCallback(
    (notification: BuyerNotification) => {
      if (!notification.read_at) markReadMutation.mutate(notification.id);
      setNotifOpen(false);
      if (notification.href) router.push(notification.href);
    },
    [markReadMutation, router]
  );

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
      {/* Logo + Notifikasi bell */}
      <div style={{ padding: '4px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={16} />
        {/* Bell button dengan badge */}
        {user?.id && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: notifOpen ? '1px solid var(--pk-border-strong)' : '1px solid var(--pk-border)',
                background: notifOpen ? 'var(--pk-bg-subtle)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--pk-text-secondary)',
                position: 'relative',
                transition: 'all 150ms ease',
              }}
            >
              <Icon name="bell" size={15} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--pk-danger)',
                    border: '1.5px solid #fff',
                  }}
                />
              )}
            </button>

            {/* Dropdown notifikasi */}
            {notifOpen && (
              <div
                style={{
                  position: 'fixed',
                  top: 'auto',
                  left: 210,
                  zIndex: 200,
                }}
              >
                <NotificationDropdown
                  notifications={notifications}
                  onMarkAllRead={() => markAllReadMutation.mutate()}
                  onSelect={handleNotifSelect}
                  onClose={() => setNotifOpen(false)}
                />
              </div>
            )}
          </div>
        )}
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
        const isActive = i.exact ? pathname === i.href : pathname.startsWith(i.href);
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
        {user?.id && (
          <Link
            href={`/stores/${user.id}`}
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
            <Icon name="store" size={16} />
            Halaman Toko
          </Link>
        )}
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
