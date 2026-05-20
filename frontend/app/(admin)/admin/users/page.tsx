'use client';

import { useState, useEffect, useCallback } from 'react';
import Avatar from '@/components/pk/avatar';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import { adminApi } from '@/lib/api/admin';
import { User } from '@/types/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: { role?: string; status?: string } = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await adminApi.getUsers(params);
      setUsers(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) {
      console.error('Gagal load users', err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleStatus = async (user: User) => {
    setActionLoading(user.id);
    try {
      await adminApi.updateUserStatus(user.id, { is_active: !user.is_active });
      // Update state lokal agar tidak perlu refetch
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      );
    } catch (err) {
      console.error('Gagal update status user', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Semua User</h1>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '0 0 28px' }}>
        {loading ? '...' : `${total.toLocaleString('id-ID')} user terdaftar`}
      </p>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input className="pk-input" placeholder="Cari nama atau email..." style={{ height: 36, paddingLeft: 36, fontSize: 13 }} readOnly />
          </div>
          <select
            className="pk-select"
            style={{ width: 140, height: 36, fontSize: 13 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Semua role</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="superadmin">Admin</option>
          </select>
          <select
            className="pk-select"
            style={{ width: 140, height: 36, fontSize: 13 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Nama', 'Email', 'Role', 'Status', 'Tanggal Daftar', 'Aksi'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 5 ? 'right' : 'left',
                  padding: '10px 20px', fontSize: 12, fontWeight: 500,
                  color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Tidak ada user ditemukan.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.name} size={30} bg="#F3F4F6" color="#111827" />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>{u.email}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span className={`pk-badge ${u.role === 'seller' ? 'pk-badge-blue' : u.role === 'superadmin' ? 'pk-badge-warning' : 'pk-badge-neutral'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
                </td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>
                  {formatDate(u.created_at)}
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  {u.role !== 'superadmin' && (
                    <button
                      className={`pk-btn pk-btn-sm ${u.is_active ? '' : 'pk-btn-secondary'}`}
                      style={u.is_active ? { color: 'var(--pk-danger)', border: '1px solid var(--pk-border)', background: '#fff' } : {}}
                      disabled={actionLoading === u.id}
                      onClick={() => handleToggleStatus(u)}
                    >
                      {actionLoading === u.id ? '...' : u.is_active ? 'Ban' : 'Aktifkan'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
