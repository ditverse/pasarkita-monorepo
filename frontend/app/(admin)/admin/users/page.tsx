'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Avatar from '@/components/pk/avatar';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';
import { adminApi } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';
import { User } from '@/types/api';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';

export default function AdminUsersPage() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sort, setSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(roleFilter, statusFilter, debouncedSearch, createdFrom, createdTo, sort, page),
    queryFn: async () => {
      const params: {
        role?: string;
        status?: string;
        search?: string;
        created_from?: string;
        created_to?: string;
        sort: typeof sort;
        page: number;
        limit: number;
      } = { page, limit: 20, sort };
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (createdFrom) params.created_from = createdFrom;
      if (createdTo) params.created_to = createdTo;

      const res = await adminApi.getUsers(params);
      return {
        users: res.data.data ?? [],
        pagination: res.data.pagination,
      };
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason: string }) =>
      adminApi.updateUserStatus(id, { is_active: isActive, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'menonaktifkan' : 'mengaktifkan';
    const reason = window.prompt(`Alasan ${action} akun ${user.name}:`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Yakin ingin ${action} akun ${user.name}?`)) return;

    setActionLoading(user.id);
    try {
      await updateUserMutation.mutateAsync({ id: user.id, isActive: !user.is_active, reason: reason.trim() });
      toast.success(`Status ${user.name} berhasil diperbarui`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gagal memperbarui status user'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const resultStart = total === 0 ? 0 : (page - 1) * 20 + 1;
  const resultEnd = Math.min(page * 20, total);
  const loading = usersQuery.isLoading;
  const isError = usersQuery.isError;
  const hasFilters = Boolean(roleFilter || statusFilter || search || createdFrom || createdTo || sort !== 'created_desc');

  const resetFilters = () => {
    setRoleFilter('');
    setStatusFilter('');
    setSearch('');
    setCreatedFrom('');
    setCreatedTo('');
    setSort('created_desc');
    setPage(1);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Semua User</h1>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '0 0 28px' }}>
        {loading ? '...' : `${total.toLocaleString('id-ID')} user terdaftar`}
      </p>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input
              className="pk-input"
              placeholder="Cari nama atau email..."
              style={{ height: 36, paddingLeft: 36, fontSize: 13 }}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </div>
          <select
            className="pk-select"
            style={{ width: 140, height: 36, fontSize: 13 }}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
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
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Semua status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input
            className="pk-input"
            type="date"
            aria-label="Tanggal daftar mulai"
            title="Tanggal daftar mulai"
            style={{ width: 145, height: 36, fontSize: 12 }}
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(event) => { setCreatedFrom(event.target.value); setPage(1); }}
          />
          <input
            className="pk-input"
            type="date"
            aria-label="Tanggal daftar akhir"
            title="Tanggal daftar akhir"
            style={{ width: 145, height: 36, fontSize: 12 }}
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(event) => { setCreatedTo(event.target.value); setPage(1); }}
          />
          <select
            className="pk-select"
            aria-label="Urutkan user"
            style={{ width: 150, height: 36, fontSize: 12 }}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(1);
            }}
          >
            <option value="created_desc">Terbaru</option>
            <option value="created_asc">Terlama</option>
            <option value="name_asc">Nama A-Z</option>
            <option value="name_desc">Nama Z-A</option>
          </select>
          {hasFilters && (
            <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={resetFilters}>
              Reset
            </button>
          )}
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
            {!loading && !isError && users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Tidak ada user ditemukan.
                </td>
              </tr>
            )}
            {!loading && isError && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
                  User gagal dimuat. Periksa koneksi backend dan akses admin.
                </td>
              </tr>
            )}
            {!isError && users.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.name} size={30} bg="#F3F4F6" color="#111827" />
                    <Link href={`/admin/users/${u.id}`} style={{ fontSize: 14, fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>
                      {u.name}
                    </Link>
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
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Link href={`/admin/users/${u.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
                      Detail
                    </Link>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 14, borderTop: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
            {resultStart}-{resultEnd} dari {total.toLocaleString('id-ID')} user · Halaman {pagination?.page ?? page} dari {pagination?.total_pages || 1}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button>
            <button className="pk-btn pk-btn-secondary pk-btn-sm" disabled={page >= (pagination?.total_pages || 1)} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
