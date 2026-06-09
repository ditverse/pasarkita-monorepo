'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';

export default function AdminAuditLogsPage() {
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const validTargetId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(targetId) ? targetId : undefined;

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', targetType, targetId, action, page],
    queryFn: async () => {
      const response = await adminApi.getAuditLogs({
        target_type: targetType || undefined,
        target_id: validTargetId,
        action: action || undefined,
        page,
        limit: 20,
      });
      return {
        logs: response.data.data ?? [],
        pagination: response.data.pagination,
      };
    },
  });

  const logs = logsQuery.data?.logs ?? [];
  const pagination = logsQuery.data?.pagination;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Audit Log</h1>
          <p style={{ margin: 0, color: 'var(--pk-text-secondary)' }}>Riwayat tindakan sensitif superadmin</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            aria-label="Filter target ID"
            className="pk-input"
            placeholder="User/order UUID"
            value={targetId}
            onChange={(event) => { setTargetId(event.target.value.trim()); setPage(1); }}
            style={{ width: 210 }}
          />
          <input
            aria-label="Filter jenis aksi"
            className="pk-input"
            placeholder="Contoh: user.banned"
            value={action}
            onChange={(event) => { setAction(event.target.value.trim()); setPage(1); }}
            style={{ width: 180 }}
          />
          <select
            aria-label="Filter jenis target"
            className="pk-select"
            value={targetType}
            onChange={(event) => { setTargetType(event.target.value); setPage(1); }}
            style={{ width: 150 }}
          >
            <option value="">Semua target</option>
            <option value="user">User</option>
            <option value="order">Order</option>
            <option value="product">Produk</option>
          </select>
        </div>
      </div>

      {logsQuery.isError ? (
        <div className="pk-card" role="alert" style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Audit log belum dapat dimuat</div>
          <p style={{ color: 'var(--pk-text-secondary)' }}>
            Jalankan <code>backend/observability.sql</code> di Supabase, lalu coba lagi.
          </p>
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => logsQuery.refetch()}>Coba Lagi</button>
        </div>
      ) : (
        <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--pk-bg-subtle)' }}>
                  {['Waktu', 'Admin', 'Aksi', 'Target', 'Alasan', 'Perubahan'].map((heading) => (
                    <th key={heading} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, color: 'var(--pk-text-hint)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logsQuery.isLoading && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Memuat...</td></tr>}
                {!logsQuery.isLoading && logs.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Belum ada audit log.</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                    <td style={{ padding: '13px 18px', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <div style={{ fontWeight: 500 }}>{log.actor?.name ?? '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>{log.actor?.email}</div>
                    </td>
                    <td style={{ padding: '13px 18px' }}><code>{log.action}</code></td>
                    <td style={{ padding: '13px 18px' }}>
                      <div>{log.target_type}</div>
                      <code style={{ fontSize: 11 }}>{log.target_id?.slice(0, 8) ?? '-'}</code>
                    </td>
                    <td style={{ padding: '13px 18px', maxWidth: 220 }}>{log.reason ?? '-'}</td>
                    <td style={{ padding: '13px 18px', fontSize: 11 }}>
                      <code>{JSON.stringify(log.before_data)} → {JSON.stringify(log.after_data)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
              Halaman {pagination?.page ?? page} dari {pagination?.total_pages || 1}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button>
              <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= (pagination?.total_pages || 1)} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
