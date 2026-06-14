'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import { sellerApi } from '@/lib/api/seller';
import { queryKeys } from '@/lib/query-keys';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth';
import { SellerStoreProfile } from '@/types/api';

type StoreForm = {
  storeName: string;
  description: string;
  pickupAddress: string;
  contactPhone: string;
  openTime: string;
  closeTime: string;
  processingDays: string;
  logoUrl: string | null;
};

const EMPTY_FORM: StoreForm = {
  storeName: '',
  description: '',
  pickupAddress: '',
  contactPhone: '',
  openTime: '08:00',
  closeTime: '17:00',
  processingDays: '2',
  logoUrl: null,
};

/** Format tanggal ke YYYY-MM-DD WIB untuk input[type=date] */
function toInputDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toInputDate(d);
}

export default function SellerSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<StoreForm>(EMPTY_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // State mode libur
  const [vacationOn, setVacationOn] = useState(false);
  const [vacationUntil, setVacationUntil] = useState('');
  const [vacationInitialized, setVacationInitialized] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.seller.profile(),
    queryFn: async () => (await sellerApi.getProfile()).data.data,
  });

  useEffect(() => {
    if (!profileQuery.data || initialized) return;
    const profile = profileQuery.data;
    const next = {
      storeName: profile.store_name,
      description: profile.description || '',
      pickupAddress: profile.pickup_address || '',
      contactPhone: profile.contact_phone || '',
      openTime: profile.open_time.slice(0, 5),
      closeTime: profile.close_time.slice(0, 5),
      processingDays: String(profile.processing_days),
      logoUrl: profile.logo_url,
    };
    // Synchronize the form with the server response once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(next);
    setLogoPreview(profile.logo_url);
    setInitialSnapshot(JSON.stringify(next));
    setInitialized(true);
  }, [initialized, profileQuery.data]);

  // Sinkronisasi state libur dari profil (satu kali)
  useEffect(() => {
    if (!profileQuery.data || vacationInitialized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVacationOn(profileQuery.data.is_on_vacation ?? false);
    setVacationUntil(profileQuery.data.vacation_until ?? '');
    setVacationInitialized(true);
  }, [profileQuery.data, vacationInitialized]);

  const errors = useMemo(() => ({
    storeName: form.storeName.trim().length < 3 ? 'Nama toko minimal 3 karakter.' : '',
    description: form.description.trim().length < 20 ? 'Deskripsi minimal 20 karakter.' : '',
    pickupAddress: form.pickupAddress.trim().length < 10 ? 'Alamat pickup minimal 10 karakter.' : '',
    contactPhone: /^[+]?[0-9][0-9\s-]{7,19}$/.test(form.contactPhone.trim()) ? '' : 'Nomor telepon tidak valid.',
    time: form.openTime === form.closeTime ? 'Jam buka dan tutup tidak boleh sama.' : '',
    processingDays: Number.isInteger(Number(form.processingDays)) && Number(form.processingDays) >= 1 && Number(form.processingDays) <= 30
      ? '' : 'Estimasi proses harus 1-30 hari.',
  }), [form]);
  const isValid = Object.values(errors).every((error) => !error);
  const isDirty = initialized && (JSON.stringify(form) !== initialSnapshot || Boolean(logoFile));

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = form.logoUrl;
      if (logoFile) {
        const upload = await sellerApi.uploadLogo(logoFile);
        logoUrl = upload.data.data.logo_url;
      }
      return sellerApi.updateProfile({
        store_name: form.storeName.trim(),
        description: form.description.trim(),
        pickup_address: form.pickupAddress.trim(),
        contact_phone: form.contactPhone.trim(),
        open_time: form.openTime,
        close_time: form.closeTime,
        processing_days: Number(form.processingDays),
        logo_url: logoUrl,
      });
    },
    onSuccess: (response) => {
      const profile = response.data.data;
      const next = { ...form, logoUrl: profile.logo_url };
      setForm(next);
      setLogoPreview(profile.logo_url);
      setLogoFile(null);
      setInitialSnapshot(JSON.stringify(next));
      void queryClient.invalidateQueries({ queryKey: queryKeys.seller.profile() });
      void queryClient.invalidateQueries({ queryKey: ['stores', user?.id] });
      toast.success('Profil toko berhasil diperbarui');
    },
  });

  // Mutasi mode libur
  const vacationMutation = useMutation({
    mutationFn: () =>
      sellerApi.setVacation({
        is_on_vacation: vacationOn,
        vacation_until: vacationOn && vacationUntil ? vacationUntil : null,
      }),
    onSuccess: (response) => {
      const profile = response.data.data;
      queryClient.setQueryData<SellerStoreProfile>(queryKeys.seller.profile(), (old) =>
        old
          ? { ...old, is_on_vacation: profile.is_on_vacation, vacation_until: profile.vacation_until }
          : old
      );
      void queryClient.invalidateQueries({ queryKey: ['stores', user?.id] });
      toast.success(profile.is_on_vacation ? 'Mode libur toko diaktifkan' : 'Mode libur toko dinonaktifkan');
    },
  });

  const vacationUntilFormatted = vacationUntil
    ? new Date(`${vacationUntil}T00:00:00+07:00`).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
      })
    : null;

  const handleLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran logo maksimal 2MB');
      event.target.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format logo harus JPG, PNG, atau WebP');
      event.target.value = '';
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (profileQuery.isLoading || !initialized) {
    return <div style={{ padding: 40, color: 'var(--pk-text-hint)' }}>Memuat profil toko...</div>;
  }
  if (profileQuery.isError) {
    return (
      <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>
        Profil toko gagal dimuat.
        <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => void profileQuery.refetch()} style={{ marginLeft: 10 }}>Coba Lagi</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Pengaturan Toko</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>Atur identitas publik dan informasi operasional toko.</p>
        </div>
        {user?.id && (
          <Link href={`/stores/${user.id}`} target="_blank" className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
            Lihat Halaman Publik
          </Link>
        )}
      </div>

      {/* ── Card Profil ──────────────────────────────────────────────── */}
      <div className="pk-card" style={{ padding: 'clamp(20px, 4vw, 32px)', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogo} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{ width: 96, height: 96, borderRadius: 18, border: '1px dashed var(--pk-border-strong)', background: 'var(--pk-bg-subtle)', overflow: 'hidden', cursor: 'pointer', padding: 0 }}>
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo toko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : <Icon name="store" size={30} style={{ color: 'var(--pk-text-hint)' }} />}
          </button>
          <div>
            <div style={{ fontWeight: 600 }}>Logo Toko</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', margin: '4px 0 10px' }}>JPG, PNG, atau WebP maksimal 2MB.</div>
            <button type="button" className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => fileRef.current?.click()}>Pilih Logo</button>
          </div>
          <span className={profileQuery.data?.verification_status === 'demo_verified' ? 'pk-badge pk-badge-active' : 'pk-badge'}>
            {profileQuery.data?.verification_status === 'demo_verified' ? 'Terverifikasi Demo' : 'Profil Belum Lengkap'}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label className="pk-label" htmlFor="store-name">Nama Toko</label>
            <input id="store-name" className="pk-input" maxLength={120} value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} />
            <div className="pk-hint" style={{ color: errors.storeName ? 'var(--pk-danger)' : undefined }}>{errors.storeName || `${form.storeName.length}/120 karakter`}</div>
          </div>
          <div>
            <label className="pk-label" htmlFor="store-description">Deskripsi Toko</label>
            <textarea id="store-description" className="pk-textarea" rows={5} maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <div className="pk-hint" style={{ color: errors.description ? 'var(--pk-danger)' : undefined }}>{errors.description || `${form.description.length}/1000 karakter`}</div>
          </div>
          <div>
            <label className="pk-label" htmlFor="pickup-address">Alamat Pickup</label>
            <textarea id="pickup-address" className="pk-textarea" rows={3} maxLength={500} value={form.pickupAddress} onChange={(event) => setForm({ ...form, pickupAddress: event.target.value })} />
            {errors.pickupAddress && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errors.pickupAddress}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
            <div>
              <label className="pk-label" htmlFor="contact-phone">Kontak Toko</label>
              <input id="contact-phone" className="pk-input" placeholder="+62..." value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
              {errors.contactPhone && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errors.contactPhone}</div>}
            </div>
            <div>
              <label className="pk-label" htmlFor="open-time">Jam Buka</label>
              <input id="open-time" className="pk-input" type="time" value={form.openTime} onChange={(event) => setForm({ ...form, openTime: event.target.value })} />
            </div>
            <div>
              <label className="pk-label" htmlFor="close-time">Jam Tutup</label>
              <input id="close-time" className="pk-input" type="time" value={form.closeTime} onChange={(event) => setForm({ ...form, closeTime: event.target.value })} />
              {errors.time && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errors.time}</div>}
            </div>
            <div>
              <label className="pk-label" htmlFor="processing-days">Estimasi Proses</label>
              <input id="processing-days" className="pk-input" type="number" min={1} max={30} value={form.processingDays} onChange={(event) => setForm({ ...form, processingDays: event.target.value })} />
              <div className="pk-hint" style={{ color: errors.processingDays ? 'var(--pk-danger)' : undefined }}>{errors.processingDays || 'Hari kerja sebelum diserahkan ke kurir.'}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--pk-border)' }}>
          {isDirty && <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--pk-text-hint)' }}>Perubahan belum disimpan</span>}
          <button
            type="button"
            className="pk-btn pk-btn-primary"
            disabled={!isValid || updateMutation.isPending}
            onClick={() => void updateMutation.mutateAsync().catch((error) => toast.error(getApiErrorMessage(error, 'Gagal memperbarui profil toko')))}
          >
            {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </div>

      {/* ── Card Mode Libur Toko ─────────────────────────────────────── */}
      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        {/* Header card dengan toggle */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--pk-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkle" size={16} style={{ color: '#F59E0B' }} />
              Mode Libur Toko
            </div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 3, maxWidth: 460 }}>
              Saat aktif, pembeli melihat banner libur di halaman toko Anda dan tidak dapat checkout produk Anda.
            </div>
          </div>

          {/* Toggle switch */}
          <label
            htmlFor="vacation-toggle"
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: vacationOn ? '#B45309' : 'var(--pk-text-secondary)' }}>
              {vacationOn ? 'Libur Aktif' : 'Beroperasi'}
            </span>
            {/* Custom toggle visuals */}
            <div style={{
              width: 44,
              height: 24,
              borderRadius: 999,
              background: vacationOn ? '#F59E0B' : 'var(--pk-bg-subtle)',
              border: `1.5px solid ${vacationOn ? '#D97706' : 'var(--pk-border)'}`,
              position: 'relative',
              transition: 'all 200ms ease',
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
                position: 'absolute',
                top: 2,
                left: vacationOn ? 22 : 2,
                transition: 'left 200ms ease',
              }} />
            </div>
            <input
              id="vacation-toggle"
              type="checkbox"
              checked={vacationOn}
              onChange={(e) => {
                setVacationOn(e.target.checked);
                if (!e.target.checked) setVacationUntil('');
              }}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
          </label>
        </div>

        {/* Body card */}
        <div style={{ padding: '20px 24px' }}>
          {/* Preview banner seperti yang akan dilihat pembeli */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 10,
            background: vacationOn ? '#FEF3C7' : 'var(--pk-bg-subtle)',
            border: `1px solid ${vacationOn ? '#FDE68A' : 'var(--pk-border)'}`,
            marginBottom: 20,
            transition: 'all 250ms ease',
          }}>
            <Icon name="sparkle" size={18} style={{ color: vacationOn ? '#D97706' : 'var(--pk-text-hint)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: vacationOn ? '#92400E' : 'var(--pk-text-hint)' }}>
                {vacationOn ? '🏖️ Toko Sedang Libur' : 'Toko sedang beroperasi normal'}
              </div>
              <div style={{ fontSize: 12, color: vacationOn ? '#B45309' : 'var(--pk-text-hint)', marginTop: 3, lineHeight: 1.5 }}>
                {vacationOn
                  ? vacationUntilFormatted
                    ? `Kami akan kembali melayani pada ${vacationUntilFormatted}. Terima kasih atas pengertian Anda.`
                    : 'Kami sedang dalam masa libur. Tanggal kembali belum ditentukan.'
                  : 'Pembeli dapat melihat dan memesan produk Anda seperti biasa.'}
              </div>
              {vacationOn && (
                <div style={{ fontSize: 11, color: '#D97706', marginTop: 5, fontStyle: 'italic' }}>
                  ↑ Ini adalah tampilan yang akan dilihat pembeli di halaman toko Anda
                </div>
              )}
            </div>
          </div>

          {/* Date picker dan tombol simpan */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label className="pk-label" htmlFor="vacation-until">
                Tanggal aktif kembali{' '}
                <span style={{ color: 'var(--pk-text-hint)', fontWeight: 400 }}>(opsional)</span>
              </label>
              <input
                id="vacation-until"
                type="date"
                className="pk-input"
                value={vacationUntil}
                min={tomorrow()}
                disabled={!vacationOn}
                onChange={(e) => setVacationUntil(e.target.value)}
                style={{ opacity: vacationOn ? 1 : 0.45 }}
              />
              <div className="pk-hint">
                {!vacationOn
                  ? 'Aktifkan mode libur terlebih dahulu.'
                  : vacationUntil
                    ? `Toko ditandai kembali aktif mulai ${vacationUntilFormatted}`
                    : 'Kosongkan jika tanggal kembali belum pasti.'}
              </div>
            </div>

            <button
              type="button"
              id="btn-save-vacation"
              className="pk-btn pk-btn-primary"
              style={{
                marginBottom: 22,
                background: vacationOn ? '#F59E0B' : '#111827',
                borderColor: vacationOn ? '#D97706' : '#111827',
              }}
              disabled={vacationMutation.isPending}
              onClick={() =>
                void vacationMutation.mutateAsync().catch((err) =>
                  toast.error(getApiErrorMessage(err, 'Gagal memperbarui mode libur'))
                )
              }
            >
              <Icon name={vacationOn ? 'check' : 'x'} size={14} stroke={2.5} />
              {vacationMutation.isPending
                ? 'Menyimpan...'
                : vacationOn
                  ? 'Simpan & Aktifkan Libur'
                  : 'Nonaktifkan Mode Libur'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
