'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const registerSchema = z.object({
  name: z.string().min(3, 'Nama min 3 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password min 6 karakter'),
  role: z.enum(['buyer', 'seller']),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'buyer' }
  });

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => authApi.register(data),
    onSuccess: () => {
      toast.success('Registrasi berhasil! Silakan login.');
      router.push('/auth/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Registrasi gagal');
    }
  });

  const onSubmit = (data: RegisterForm) => {
    mutation.mutate(data);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-center">Daftar Akun Baru</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
          <input 
            {...register('name')} 
            className="w-full border p-2 rounded" 
            placeholder="Budi Santoso"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        
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

        <div>
          <label className="block text-sm font-medium mb-1">Mendaftar Sebagai</label>
          <select {...register('role')} className="w-full border p-2 rounded bg-white">
            <option value="buyer">Pembeli (Buyer)</option>
            <option value="seller">Penjual (Seller)</option>
          </select>
        </div>

        <button 
          type="submit" 
          disabled={mutation.isPending}
          className="w-full bg-black text-white p-2 rounded font-medium hover:bg-gray-800 disabled:bg-gray-400"
        >
          {mutation.isPending ? 'Mendaftar...' : 'Daftar Sekarang'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Sudah punya akun? <a href="/auth/login" className="text-blue-600 font-medium hover:underline">Masuk di sini</a>
      </div>
    </div>
  );
}
