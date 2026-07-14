'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Icon from '@/components/pk/icon';
import { getApiErrorMessage } from '@/lib/api-error';

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const setLogin = useAuthStore((state) => state.login);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data),
    onSuccess: (res) => {
      const { token, user } = res.data.data;
      // Set cookie dulu sebelum store update agar middleware tidak bounce
      document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
      setLogin(token, user);
      toast.success('Berhasil masuk!');
      const requestedPath = new URLSearchParams(window.location.search).get('next');
      if (requestedPath?.startsWith('/') && !requestedPath.startsWith('//')) {
        router.push(requestedPath);
        return;
      }
      if (user.role === 'superadmin') router.push('/admin');
      else if (user.role === 'seller') router.push('/seller/products');
      else router.push('/');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Login gagal. Periksa kembali data Anda.'));
    },
  });

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', textAlign: 'center' }}>
        Masuk ke PasarKita
      </h2>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', textAlign: 'center', margin: '0 0 28px' }}>
        Gunakan email dan password untuk melanjutkan.
      </p>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div style={{ marginBottom: 16 }}>
          <label className="pk-label">Email</label>
          <input {...register('email')} className="pk-input" placeholder="nama@email.com" />
          {errors.email && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.email.message}</div>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label className="pk-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              {...register('password')}
              className="pk-input"
              type={show ? 'text' : 'password'}
              placeholder="••••••••"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--pk-text-hint)', padding: 4 }}
            >
              <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
          {errors.password && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.password.message}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <a style={{ fontSize: 12, color: 'var(--pk-accent)', cursor: 'pointer' }}>Lupa password?</a>
        </div>
        <button type="submit" className="pk-btn pk-btn-primary pk-btn-block" disabled={mutation.isPending}>
          {mutation.isPending ? 'Memproses...' : 'Masuk'}
        </button>
      </form>

      {/* Dev Mode Quick Login */}
      <div style={{ marginTop: 20, padding: 14, borderRadius: 10, border: '1px dashed var(--pk-border)', background: 'var(--pk-bg-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pk-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="sparkle" size={12} style={{ color: 'var(--pk-accent)' }} />
          <span>Quick Login (Development Mode)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            type="button"
            className="pk-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 'auto',
              padding: '10px 6px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--pk-danger-soft)',
              color: 'var(--pk-danger)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: 8,
              transition: 'all 150ms ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            onClick={() => mutation.mutate({ email: 'admin@pasarkita.demo', password: 'password123' })}
            disabled={mutation.isPending}
          >
            <Icon name="users" size={16} />
            <span>Admin</span>
          </button>
          <button
            type="button"
            className="pk-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 'auto',
              padding: '10px 6px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--pk-success-soft)',
              color: 'var(--pk-success)',
              border: '1px solid rgba(22, 163, 74, 0.2)',
              borderRadius: 8,
              transition: 'all 150ms ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            onClick={() => mutation.mutate({ email: 'seller.rasa@pasarkita.demo', password: 'password123' })}
            disabled={mutation.isPending}
          >
            <Icon name="store" size={16} />
            <span>Seller</span>
          </button>
          <button
            type="button"
            className="pk-btn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 'auto',
              padding: '10px 6px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--pk-accent-soft)',
              color: 'var(--pk-accent)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: 8,
              transition: 'all 150ms ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            onClick={() => mutation.mutate({ email: 'alya.putri@pasarkita.demo', password: 'password123' })}
            disabled={mutation.isPending}
          >
            <Icon name="user" size={16} />
            <span>Buyer</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--pk-border)' }} />
        <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>atau</span>
        <div style={{ flex: 1, height: 1, background: 'var(--pk-border)' }} />
      </div>
      <button className="pk-btn pk-btn-secondary pk-btn-block">Masuk dengan SmartBank ID</button>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--pk-text-secondary)' }}>
        Belum punya akun?{' '}
        <Link href="/auth/register" style={{ color: 'var(--pk-accent)', fontWeight: 500 }}>
          Daftar sekarang
        </Link>
      </div>
    </>
  );
}
