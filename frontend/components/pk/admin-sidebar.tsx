'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Logo from './logo';
import Icon from './icon';
import Avatar from './avatar';
import { adminApi } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth';

const items = [
  { id: 'overview', href: '/admin', label: 'Overview', icon: 'grid' as const },
  { id: 'actions', href: '/admin/action-center', label: 'Action Center', icon: 'bell' as const },
  { id: 'health', href: '/admin/health-center', label: 'Health Center', icon: 'trending' as const },
  { id: 'users', href: '/admin/users', label: 'Semua User', icon: 'users' as const },
  { id: 'orders', href: '/admin/orders', label: 'Semua Order', icon: 'bag' as const },
  { id: 'moderation', href: '/admin/moderation', label: 'Moderasi', icon: 'package' as const },
  { id: 'promotions', href: '/admin/promotions', label: 'Promosi', icon: 'sparkle' as const },
  { id: 'ads', href: '/admin/ads', label: 'Iklan & Banner', icon: 'trending' as const },
  { id: 'complaints', href: '/admin/complaints', label: 'Komplain & Sengketa', icon: 'clipboard' as const },
  { id: 'analytics', href: '/admin/analytics', label: 'Analytics', icon: 'barChart' as const },
  { id: 'reports', href: '/admin/reports', label: 'Laporan', icon: 'clipboard' as const },
  { id: 'fee', href: '/admin/fee-simulator', label: 'Simulator Fee', icon: 'creditCard' as const },
  { id: 'audit', href: '/admin/audit-logs', label: 'Audit Log', icon: 'clipboard' as const },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const healthQuery = useQuery({
    queryKey: queryKeys.admin.analytics('30d'),
    queryFn: async () => (await adminApi.getAnalytics({ period: '30d' })).data.data,
  });
  const anomalyCount = (healthQuery.data?.anomalies ?? []).reduce(
    (sum, anomaly) => sum + anomaly.count,
    0
  );
  const adminName = user?.name || 'Administrator';

  const handleLogout = () => {
    if (!window.confirm('Keluar dari Admin Panel?')) return;
    logout();
    router.replace('/auth/login');
    router.refresh();
  };

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
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
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
            <span style={{ flex: 1 }}>{i.label}</span>
            {i.id === 'actions' && anomalyCount > 0 && (
              <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'var(--pk-danger-soft)', color: 'var(--pk-danger)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>
                {anomalyCount > 99 ? '99+' : anomalyCount}
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
          <Avatar name={adminName} size={30} bg="#F3F4F6" color="#111827" />
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>Superadmin</div>
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
