'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Icon from '@/components/pk/icon';

const registerSchema = z.object({
  name: z.string().min(3, 'Nama min 3 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password min 6 karakter'),
  role: z.enum(['buyer', 'seller']),
});
type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'buyer' },
  });

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => authApi.register(data),
    onSuccess: () => {
      toast.success('Registrasi berhasil! Silakan login.');
      router.push('/auth/login');
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message ?? 'Registrasi gagal');
    },
  });

  const pickRole = (r: 'buyer' | 'seller') => {
    setRole(r);
    setValue('role', r);
  };

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', textAlign: 'center' }}>
        Daftar ke PasarKita
      </h2>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', textAlign: 'center', margin: '0 0 28px' }}>
        Mulai belanja atau jualan dalam 1 menit.
      </p>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div style={{ marginBottom: 14 }}>
          <label className="pk-label">Nama Lengkap</label>
          <input {...register('name')} className="pk-input" placeholder="Nama Anda" />
          {errors.name && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.name.message}</div>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="pk-label">Email</label>
          <input {...register('email')} className="pk-input" type="email" placeholder="nama@email.com" />
          {errors.email && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.email.message}</div>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="pk-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              {...register('password')}
              className="pk-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 6 karakter"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              onClick={() => setShowPassword((current) => !current)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--pk-text-hint)', padding: 4 }}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
          {errors.password && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.password.message}</div>}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Saya ingin</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([{ id: 'buyer', label: 'Belanja', icon: 'bag' }, { id: 'seller', label: 'Jualan', icon: 'store' }] as const).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRole(r.id)}
                style={{
                  padding: '14px 12px',
                  border: '1.5px solid ' + (role === r.id ? 'var(--pk-text)' : 'var(--pk-border)'),
                  borderRadius: 8,
                  background: role === r.id ? 'var(--pk-bg-subtle)' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  transition: 'all 150ms ease',
                }}
              >
                <Icon name={r.icon} size={18} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="pk-btn pk-btn-primary pk-btn-block" disabled={mutation.isPending}>
          {mutation.isPending ? 'Mendaftar...' : 'Daftar'}
        </button>
      </form>

      <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
        Dengan mendaftar, Anda menyetujui{' '}
        <a style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>Syarat Layanan</a> dan{' '}
        <a style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>Kebijakan Privasi</a> kami.
      </div>
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--pk-text-secondary)' }}>
        Sudah punya akun?{' '}
        <Link href="/auth/login" style={{ color: 'var(--pk-accent)', fontWeight: 500 }}>
          Masuk
        </Link>
      </div>
    </>
  );
}
