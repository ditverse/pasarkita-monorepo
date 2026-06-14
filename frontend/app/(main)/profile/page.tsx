'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import * as z from 'zod';
import { toast } from 'sonner';
import Avatar from '@/components/pk/avatar';
import Icon from '@/components/pk/icon';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api/auth';
import { ordersApi } from '@/lib/api/orders';
import { calculateWeeklySpending, getCurrentWeekRange, getWeeklyBudget, saveWeeklyBudget } from '@/lib/buyer-budget';
import { formatIDR } from '@/lib/format';
import { Order } from '@/types/api';
import PanelAddressBook from './address-book';

// ─── Schemas ────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().optional().nullable(),
});
type InfoForm = z.infer<typeof infoSchema>;

const securitySchema = z
  .object({
    current_password: z.string().min(1, 'Password saat ini wajib diisi'),
    new_password: z.string().min(6, 'Password baru minimal 6 karakter'),
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  });
type SecurityForm = z.infer<typeof securitySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{msg}</div>;
}

// ─── Panel: Informasi Pribadi ─────────────────────────────────────────────────

function PanelInfo({ user }: { user: { name: string; email: string; phone?: string | null } }) {
  const setLogin = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    defaultValues: { name: user.name, email: user.email, phone: user.phone || '' },
  });

  useEffect(() => {
    reset({ name: user.name, email: user.email, phone: user.phone || '' });
  }, [user.name, user.email, user.phone, reset]);

  const onSubmit = async (data: InfoForm) => {
    try {
      const res = await authApi.updateProfile(data);
      const updatedUser = res.data.data;
      if (token) setLogin(token, updatedUser);
      reset({ name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone || '' });
      toast.success('Perubahan disimpan');
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(apiError.response?.data?.message ?? 'Gagal menyimpan perubahan');
    }
  };


  return (
    <div className="pk-card" style={{ padding: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Informasi Pribadi</h2>
      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '0 0 24px' }}>
        Update detail akun Anda
      </p>

      {/* Avatar disimpan setelah kolom avatar_url dan storage profil tersedia. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingBottom: 24,
          marginBottom: 24,
          borderBottom: '1px solid var(--pk-border)',
        }}
      >
        <Avatar name={user.name} size={80} />
        <div>
          <button
            type="button"
            disabled
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--pk-accent)',
              background: 'transparent',
              border: 'none',
              cursor: 'not-allowed',
              padding: 0,
              display: 'block',
              marginBottom: 4,
            }}
          >
            Foto profil belum tersedia
          </button>
          <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>JPG atau PNG, maks 2MB</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Nama */}
        <label className="pk-label">Nama Lengkap</label>
        <input {...register('name')} className="pk-input" style={{ marginBottom: 4 }} />
        <FieldError msg={errors.name?.message} />

        {/* Email */}
        <div style={{ marginTop: 14 }}>
          <label className="pk-label">Email</label>
          <input {...register('email')} className="pk-input" style={{ marginBottom: 4 }} disabled />
          <FieldError msg={errors.email?.message} />
        </div>

        {/* Telepon */}
        <div style={{ marginTop: 14 }}>
          <label className="pk-label">Nomor Telepon</label>
          <input {...register('phone')} className="pk-input" style={{ marginBottom: 4 }} />
          <FieldError msg={errors.phone?.message} />
        </div>


        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button
            type="button"
            className="pk-btn pk-btn-ghost"
            onClick={() => reset()}
            disabled={!isDirty || isSubmitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="pk-btn pk-btn-primary"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Panel: Keamanan ──────────────────────────────────────────────────────────

function PanelSecurity() {
  const [show, setShow] = useState({ a: false, b: false, c: false });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SecurityForm>({ resolver: zodResolver(securitySchema) });

  const onSubmit = async (data: SecurityForm) => {
    try {
      await authApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success('Password berhasil diubah');
      reset();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(apiError.response?.data?.message ?? 'Gagal mengubah password');
    }
  };

  const fields: { key: 'a' | 'b' | 'c'; id: keyof SecurityForm; label: string }[] = [
    { key: 'a', id: 'current_password', label: 'Password Saat Ini' },
    { key: 'b', id: 'new_password', label: 'Password Baru' },
    { key: 'c', id: 'confirm_password', label: 'Konfirmasi Password Baru' },
  ];

  return (
    <div className="pk-card" style={{ padding: 32, maxWidth: 520 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Keamanan</h2>
      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '0 0 24px' }}>
        Ubah password akun Anda
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label className="pk-label">{f.label}</label>
            <div style={{ position: 'relative' }}>
              <input
                {...register(f.id)}
                className="pk-input"
                type={show[f.key] ? 'text' : 'password'}
                placeholder="••••••••"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--pk-text-hint)', padding: 4,
                }}
              >
                <Icon name={show[f.key] ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
            <FieldError msg={errors[f.id]?.message} />
          </div>
        ))}

        <button
          type="submit"
          className="pk-btn pk-btn-primary"
          style={{ marginTop: 12 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Menyimpan...' : 'Ubah Password'}
        </button>
      </form>
    </div>
  );
}

// ─── Panel: Anggaran Belanja ─────────────────────────────────────────────────

function PanelBudget({ userId }: { userId: string }) {
  const [savedBudget, setSavedBudget] = useState<number | null>(() => getWeeklyBudget(userId));
  const [budgetInput, setBudgetInput] = useState(() => {
    const budget = getWeeklyBudget(userId);
    return budget ? String(budget) : '';
  });

  const ordersQuery = useQuery({
    queryKey: ['orders', 'buyer-budget', userId],
    queryFn: async (): Promise<Order[]> => {
      const response = await ordersApi.getAll({ limit: 100, sort: 'created_desc' });
      return response.data.data;
    },
  });

  const spending = calculateWeeklySpending(ordersQuery.data ?? []);
  const remaining = savedBudget == null ? null : savedBudget - spending;
  const progress = savedBudget == null ? 0 : Math.min(100, Math.round((spending / savedBudget) * 100));
  const { start, end } = getCurrentWeekRange();
  const periodEnd = new Date(end);
  periodEnd.setDate(periodEnd.getDate() - 1);

  const saveBudget = () => {
    const normalized = Number(budgetInput.replace(/[^\d]/g, ''));
    if (!Number.isFinite(normalized) || normalized < 10000) {
      toast.error('Batas mingguan minimal Rp 10.000');
      return;
    }

    saveWeeklyBudget(userId, normalized);
    setSavedBudget(normalized);
    setBudgetInput(String(normalized));
    toast.success('Anggaran mingguan disimpan');
  };

  const removeBudget = () => {
    saveWeeklyBudget(userId, null);
    setSavedBudget(null);
    setBudgetInput('');
    toast.success('Anggaran mingguan dinonaktifkan');
  };

  return (
    <div className="pk-card" style={{ padding: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Anggaran Belanja Sehat</h2>
      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '0 0 24px', lineHeight: 1.55 }}>
        Tetapkan pengingat batas belanja mingguan. PasarKita tetap tidak akan memblokir transaksi Anda.
      </p>

      <label className="pk-label" htmlFor="weekly-budget">Batas belanja per minggu</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--pk-text-hint)', fontSize: 13 }}>Rp</span>
          <input
            id="weekly-budget"
            className="pk-input"
            inputMode="numeric"
            value={budgetInput}
            onChange={(event) => setBudgetInput(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="500000"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <button type="button" className="pk-btn pk-btn-primary" onClick={saveBudget}>
          Simpan
        </button>
      </div>

      <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: 'var(--pk-bg-subtle)' }}>
        <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 6 }}>
          Senin {start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          {' - '}
          Minggu {periodEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        {ordersQuery.isLoading ? (
          <div className="pk-skel" style={{ width: '100%', height: 76 }} />
        ) : ordersQuery.isError ? (
          <div style={{ color: 'var(--pk-danger)', fontSize: 13 }}>
            Riwayat belanja belum dapat dihitung. Coba muat ulang halaman.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Sudah dibelanjakan</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3 }}>{formatIDR(spending)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Sisa anggaran</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: remaining != null && remaining < 0 ? 'var(--pk-danger)' : 'var(--pk-text)' }}>
                  {savedBudget == null ? 'Belum diatur' : formatIDR(remaining)}
                </div>
              </div>
            </div>
            {savedBudget != null && (
              <div style={{ height: 8, borderRadius: 999, background: 'var(--pk-border)', marginTop: 18, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: progress >= 100 ? 'var(--pk-danger)' : progress >= 80 ? 'var(--pk-warning)' : 'var(--pk-success)',
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--pk-text-hint)', lineHeight: 1.55, margin: '16px 0 0' }}>
        Perhitungan memakai order berstatus dibayar, dikirim, atau selesai pada minggu berjalan.
        Pengaturan disimpan khusus untuk akun ini pada browser yang sedang digunakan.
      </p>

      {savedBudget != null && (
        <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={removeBudget} style={{ marginTop: 12, color: 'var(--pk-danger)' }}>
          Nonaktifkan Anggaran
        </button>
      )}
    </div>
  );
}

// ─── Panel: Akun SmartBank ────────────────────────────────────────────────────

function PanelSmartBank() {
  return (
    <div className="pk-card" style={{ padding: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Akun SmartBank</h2>
      <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: '0 0 28px' }}>
        Hubungkan akun SmartBank untuk pembayaran otomatis
      </p>

      <div
        style={{
          border: '1px dashed var(--pk-border-strong)',
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: 'var(--pk-bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            marginBottom: 16,
            fontSize: 28,
          }}
        >
          🏦
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Belum terhubung</div>
        <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', marginBottom: 20, maxWidth: 320, marginInline: 'auto' }}>
          Integrasi SmartBank belum tersedia. Fitur ini akan aktif setelah koneksi ke SmartBank selesai dikonfigurasi.
        </div>
        <button className="pk-btn pk-btn-primary pk-btn-sm" disabled>
          Hubungkan SmartBank
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'address' | 'budget' | 'security' | 'smartbank';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Informasi Pribadi' },
  { id: 'address', label: 'Buku Alamat' },
  { id: 'budget', label: 'Anggaran Belanja' },
  { id: 'security', label: 'Keamanan' },
  { id: 'smartbank', label: 'Akun SmartBank' },
];

const ROLE_BADGE_CLASS: Record<string, string> = {
  buyer: 'pk-badge pk-badge-blue',
  seller: 'pk-badge pk-badge-success',
  superadmin: 'pk-badge pk-badge-warning',
};

const ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  superadmin: 'Admin',
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, _hasHydrated, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => {
    if (_hasHydrated && !user) {
      router.replace('/auth/login');
    }
  }, [_hasHydrated, user, router]);

  if (!_hasHydrated || !user) {
    return (
      <div className="pk-page-shell" style={{ maxWidth: 1000, marginInline: 'auto', padding: '40px 80px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40 }}>
          <div>
            <div className="pk-skel" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 14 }} />
            <div className="pk-skel" style={{ width: 140, height: 18 }} />
          </div>
          <div className="pk-card" style={{ padding: 32 }}>
            <div className="pk-skel" style={{ width: 180, height: 22, marginBottom: 24 }} />
            <div className="pk-skel" style={{ width: '100%', height: 40, marginBottom: 14 }} />
            <div className="pk-skel" style={{ width: '100%', height: 40 }} />
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    if (!window.confirm('Keluar dari akun PasarKita?')) return;
    logout();
    router.push('/');
  };

  return (
    <div
      className="pk-profile-layout"
      style={{
        maxWidth: 1200,
        marginInline: 'auto',
        padding: '32px 80px 64px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 40,
        alignItems: 'start',
      }}
    >
      {/* ── Sidebar ── */}
      <aside>
        {/* Identity */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            paddingBottom: 24,
            borderBottom: '1px solid var(--pk-border)',
          }}
        >
          <Avatar name={user.name} size={64} />
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 6 }}>
            {user.name}
          </div>
          <span className={ROLE_BADGE_CLASS[user.role] ?? 'pk-badge pk-badge-neutral'}>
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: tab === t.id ? 'var(--pk-bg-subtle)' : 'transparent',
                color: tab === t.id ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 120ms ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Logout — sesuai desain: pk-btn pk-btn-block dengan border */}
        <button
          onClick={handleLogout}
          className="pk-btn pk-btn-block"
          style={{
            marginTop: 200,
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
      </aside>

      {/* ── Main panel ── */}
      <main>
        {tab === 'info' && <PanelInfo user={user} />}
        {tab === 'address' && <PanelAddressBook />}
        {tab === 'budget' && <PanelBudget userId={user.id} />}
        {tab === 'security' && <PanelSecurity />}
        {tab === 'smartbank' && <PanelSmartBank />}
      </main>
    </div>
  );
}
