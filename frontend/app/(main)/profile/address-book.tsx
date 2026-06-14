import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { profileApi } from '@/lib/api/profile';
import { Address } from '@/types/api';

const addressSchema = z.object({
  label: z.string().min(1, 'Label alamat wajib diisi'),
  recipient_name: z.string().min(2, 'Nama penerima minimal 2 karakter'),
  phone: z.string().min(5, 'Nomor telepon minimal 5 karakter'),
  full_address: z.string().min(10, 'Alamat lengkap minimal 10 karakter'),
});

type AddressForm = z.infer<typeof addressSchema>;

export default function PanelAddressBook() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: profileApi.getAddresses,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      if (editingId) {
        return profileApi.updateAddress(editingId, data);
      } else {
        return profileApi.addAddress({ ...data, is_primary: false });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success(editingId ? 'Alamat berhasil diperbarui' : 'Alamat berhasil ditambahkan');
      closeForm();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Gagal menyimpan alamat');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: profileApi.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Alamat berhasil dihapus');
    },
  });

  const primaryMutation = useMutation({
    mutationFn: profileApi.setPrimaryAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Alamat utama diperbarui');
    },
  });

  const openAddForm = () => {
    reset({ label: '', recipient_name: '', phone: '', full_address: '' });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (address: Address) => {
    reset({
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      full_address: address.full_address,
    });
    setEditingId(address.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const onSubmit = (data: AddressForm) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="pk-card" style={{ padding: 32 }}>Memuat buku alamat...</div>;
  }

  return (
    <div className="pk-card" style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Buku Alamat</h2>
          <p style={{ fontSize: 13, color: 'var(--pk-text-secondary)', margin: 0 }}>
            Kelola alamat pengiriman Anda
          </p>
        </div>
        {!isFormOpen && (
          <button className="pk-btn pk-btn-primary pk-btn-sm" onClick={openAddForm}>
            Tambah Alamat
          </button>
        )}
      </div>

      {isFormOpen ? (
        <form onSubmit={handleSubmit(onSubmit)} style={{ background: 'var(--pk-bg-subtle)', padding: 24, borderRadius: 12 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
            {editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label className="pk-label">Label (Contoh: Rumah, Kantor)</label>
              <input {...register('label')} className="pk-input" />
              {errors.label && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.label.message}</div>}
            </div>
            <div>
              <label className="pk-label">Nama Penerima</label>
              <input {...register('recipient_name')} className="pk-input" />
              {errors.recipient_name && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.recipient_name.message}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="pk-label">Nomor Telepon</label>
            <input {...register('phone')} className="pk-input" />
            {errors.phone && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.phone.message}</div>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="pk-label">Alamat Lengkap</label>
            <textarea {...register('full_address')} className="pk-input" rows={3} />
            {errors.full_address && <div style={{ fontSize: 12, color: 'var(--pk-danger)', marginTop: 4 }}>{errors.full_address.message}</div>}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="pk-btn pk-btn-ghost" onClick={closeForm}>
              Batal
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {addresses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pk-text-hint)' }}>
              Belum ada alamat tersimpan.
            </div>
          ) : (
            addresses.map(address => (
              <div
                key={address.id}
                style={{
                  border: address.is_primary ? '1px solid var(--pk-accent)' : '1px solid var(--pk-border)',
                  borderRadius: 12,
                  padding: 20,
                  position: 'relative',
                  background: address.is_primary ? 'var(--pk-bg-subtle)' : 'transparent',
                }}
              >
                {address.is_primary && (
                  <div style={{ position: 'absolute', top: 20, right: 20 }}>
                    <span className="pk-badge pk-badge-green">Utama</span>
                  </div>
                )}
                
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {address.label}
                </div>
                
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {address.recipient_name} <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>({address.phone})</span>
                </div>
                
                <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                  {address.full_address}
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', borderTop: '1px solid var(--pk-border)', paddingTop: 16 }}>
                  <button
                    onClick={() => openEditForm(address)}
                    style={{ background: 'none', border: 'none', color: 'var(--pk-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Hapus alamat ini?')) deleteMutation.mutate(address.id);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--pk-danger)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                  >
                    Hapus
                  </button>
                  
                  {!address.is_primary && (
                    <button
                      onClick={() => primaryMutation.mutate(address.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--pk-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500, marginLeft: 'auto' }}
                      disabled={primaryMutation.isPending}
                    >
                      Jadikan Utama
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
