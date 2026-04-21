'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setLogin = useAuthStore(state => state.login);
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data),
    onSuccess: (res) => {
      const { token, user } = res.data.data;
      setLogin(token, user);
      toast.success('Berhasil masuk!');
      
      // Redirect based on role
      setTimeout(() => {
        if (user.role === 'superadmin') {
          router.push('/admin');
        } else if (user.role === 'seller') {
          router.push('/seller/products');
        } else {
          router.push('/');
        }
      }, 500); // little delay to let cookie set perfectly
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Login gagal. Periksa kembali data Anda.');
    }
  });

  const onSubmit = (data: LoginForm) => {
    mutation.mutate(data);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-center">Masuk ke Akun Anda</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input 
            {...register('email')} 
            type="email"
            className="w-full border p-2 rounded" 
            placeholder="budi@example.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input 
            {...register('password')} 
            type="password"
            className="w-full border p-2 rounded" 
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button 
          type="submit" 
          disabled={mutation.isPending}
          className="w-full bg-black text-white p-2 rounded font-medium hover:bg-gray-800 disabled:bg-gray-400"
        >
          {mutation.isPending ? 'Memproses...' : 'Masuk sekarang'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Belum punya akun? <a href="/auth/register" className="text-blue-600 font-medium hover:underline">Daftar dulu</a>
      </div>
    </div>
  );
}
