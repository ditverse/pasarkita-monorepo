'use client';

import { useEffect, useRef } from 'react';
import Icon from './icon';
import { BuyerNotification } from '@/types/api';

// Konfigurasi tampilan per tipe notifikasi
const TYPE_CONFIG: Record<BuyerNotification['type'], { icon: string; color: string; bg: string }> = {
  order:     { icon: 'bag',         color: 'var(--pk-accent)',   bg: 'var(--pk-accent-soft)' },
  payment:   { icon: 'checkCircle', color: 'var(--pk-success)',  bg: '#F0FDF4' },
  shipped:   { icon: 'truck',       color: '#0D9488',            bg: '#F0FDFA' },
  rating:    { icon: 'sparkle',     color: '#F59E0B',            bg: '#FEF3C7' },
  system:    { icon: 'bell',        color: 'var(--pk-text-secondary)', bg: 'var(--pk-bg-subtle)' },
};

interface NotificationDropdownProps {
  notifications: BuyerNotification[];
  onMarkAllRead: () => void;
  onSelect: (notification: BuyerNotification) => void;
  onClose: () => void;
}

export default function NotificationDropdown({
  notifications,
  onMarkAllRead,
  onSelect,
  onClose,
}: NotificationDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 360,
        maxHeight: 480,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid var(--pk-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--pk-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>Notifikasi</div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              fontSize: 12,
              color: 'var(--pk-accent)',
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Body */}
      {notifications.length === 0 ? (
        // Empty state sesuai desain NotificationEmpty
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'var(--pk-bg-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pk-text-hint)',
              marginBottom: 12,
            }}
          >
            <Icon name="bell" size={22} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Tidak ada notifikasi
          </div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
            Notifikasi baru akan muncul di sini
          </div>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.map((n, i) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
            const unread = !n.read_at;
            return (
              <button
                type="button"
                key={n.id}
                onClick={() => onSelect(n)}
                style={{
                  width: '100%',
                  border: 'none',
                  textAlign: 'left',
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 12,
                  borderTop: i === 0 ? 'none' : '1px solid var(--pk-border)',
                  borderLeft: unread ? '3px solid var(--pk-accent)' : '3px solid transparent',
                  background: unread ? 'rgba(37,99,235,0.03)' : '#fff',
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={16} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--pk-text-secondary)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.message}
                  </div>
                </div>

                {/* Time */}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--pk-text-hint)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {formatNotificationTime(n.created_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Baru';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}j`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
}
