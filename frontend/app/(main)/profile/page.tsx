'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import Avatar from '@/components/pk/avatar';
import Icon from '@/components/pk/icon';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api/auth';

// ─── Schemas ────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
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

function PanelInfo({ user }: { user: { name: string; email: string } }) {
  const setLogin = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    defaultValues: { name: user.name, email: user.email },
  });

  useEffect(() => {
    reset({ name: user.name, email: user.email });
  }, [user.name, user.email, reset]);

  const onSubmit = async (data: InfoForm) => {
    try {
      const res = await authApi.updateProfile(data);
      const updatedUser = res.data.data;
      if (token) setLogin(token, updatedUser);
      reset({ name: updatedUser.name, email: updatedUser.email });
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
          <input {...register('email')} className="pk-input" style={{ marginBottom: 4 }} />
          <FieldError msg={errors.email?.message} />
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: 'var(--pk-bg-subtle)', color: 'var(--pk-text-secondary)', fontSize: 12, lineHeight: 1.55 }}>
          Nomor telepon, foto profil, dan buku alamat belum dapat disimpan karena
          kolom database-nya belum tersedia. Alamat pengiriman tetap dapat diisi saat checkout.
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

type Tab = 'info' | 'security' | 'smartbank';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Informasi Pribadi' },
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
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
        Memuat...
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
        {tab === 'security' && <PanelSecurity />}
        {tab === 'smartbank' && <PanelSmartBank />}
      </main>
    </div>
  );
}
