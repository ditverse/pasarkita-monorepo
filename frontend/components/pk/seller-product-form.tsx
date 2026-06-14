'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import { productsApi } from '@/lib/api/products';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];
const NAME_MAX = 120;
const DESCRIPTION_MAX = 2000;

export type SellerProductFormValues = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  minimumStock: string;
};

const EMPTY_FORM: SellerProductFormValues = {
  name: '',
  description: '',
  category: '',
  price: '',
  stock: '',
  minimumStock: '5',
};

function getErrors(form: SellerProductFormValues) {
  const price = Number(form.price);
  const stock = Number(form.stock);
  const minimumStock = Number(form.minimumStock);

  return {
    name: form.name.trim().length < 3
      ? 'Nama minimal 3 karakter.'
      : form.name.length > NAME_MAX ? `Nama maksimal ${NAME_MAX} karakter.` : '',
    description: form.description.trim().length < 20
      ? 'Deskripsi minimal 20 karakter.'
      : form.description.length > DESCRIPTION_MAX ? `Deskripsi maksimal ${DESCRIPTION_MAX} karakter.` : '',
    category: form.category ? '' : 'Pilih kategori produk.',
    price: !form.price || !Number.isInteger(price) || price < 100
      ? 'Harga minimal Rp100 dan harus bilangan bulat.'
      : '',
    stock: form.stock === '' || !Number.isInteger(stock) || stock < 0
      ? 'Stok harus bilangan bulat, minimal 0.'
      : '',
    minimumStock: form.minimumStock === '' || !Number.isInteger(minimumStock) || minimumStock < 0
      ? 'Batas stok minimum harus bilangan bulat, minimal 0.'
      : '',
  };
}

function formatIDRPreview(value: string) {
  const num = Number(value);
  if (!value || !Number.isFinite(num) || num < 0) return null;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

/** Card preview yang meniru tampilan produk di marketplace */
function ProductPreviewCard({
  form,
  imagePreview,
  storeName,
}: {
  form: SellerProductFormValues;
  imagePreview: string | null;
  storeName: string;
}) {
  const price = formatIDRPreview(form.price);
  const stock = form.stock !== '' ? Number(form.stock) : null;
  const minimumStock = form.minimumStock !== '' ? Number(form.minimumStock) : 5;
  const isOutOfStock = stock !== null && stock <= 0;
  const isLowStock = stock !== null && stock > 0 && stock <= minimumStock;
  const hasName = form.name.trim().length >= 3;
  const hasPrice = price !== null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 20,
      }}
    >
      {/* Label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--pk-success)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-secondary)' }}>
          Preview Produk
        </span>
        <span style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>· Tampilan di marketplace</span>
      </div>

      {/* Card */}
      <div
        className="pk-card"
        style={{
          overflow: 'hidden',
          background: '#fff',
          maxWidth: 260,
        }}
      >
        {/* Gambar */}
        <div
          style={{
            height: 200,
            background: imagePreview ? undefined : 'var(--pk-bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Preview produk"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--pk-text-hint)' }}>
              <Icon name="package" size={32} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: 11, marginTop: 8, opacity: 0.5 }}>Belum ada foto</div>
            </div>
          )}
          {/* Overlay stok habis */}
          {isOutOfStock && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  background: '#111',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 999,
                  letterSpacing: '0.04em',
                }}
              >
                STOK HABIS
              </span>
            </div>
          )}
          {/* Kategori pill */}
          {form.category && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(4px)',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--pk-text-secondary)',
                border: '1px solid var(--pk-border)',
              }}
            >
              {form.category}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: hasName ? 'var(--pk-text)' : 'var(--pk-text-hint)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 4,
              fontStyle: hasName ? undefined : 'italic',
            }}
          >
            {hasName ? form.name : 'Nama produk…'}
          </div>

          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 10 }}>
            {storeName || 'Toko Anda'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: hasPrice ? 'var(--pk-text)' : 'var(--pk-text-hint)',
                fontStyle: hasPrice ? undefined : 'italic',
              }}
            >
              {hasPrice ? price : 'Harga…'}
            </div>
            {isLowStock && (
              <span className="pk-badge pk-badge-neutral" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                Sisa {stock}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Deskripsi preview */}
      {form.description.trim().length >= 20 && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'var(--pk-bg-subtle)',
            borderRadius: 8,
            maxWidth: 260,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pk-text-hint)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Deskripsi
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--pk-text-secondary)',
              lineHeight: 1.55,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 4,
            }}
          >
            {form.description}
          </div>
        </div>
      )}

      {/* Status kelengkapan */}
      <div style={{ marginTop: 14, maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {([
          { label: 'Nama produk', ok: form.name.trim().length >= 3 },
          { label: 'Deskripsi', ok: form.description.trim().length >= 20 },
          { label: 'Kategori', ok: Boolean(form.category) },
          { label: 'Harga', ok: Boolean(formatIDRPreview(form.price)) },
          { label: 'Stok', ok: form.stock !== '' && Number.isInteger(Number(form.stock)) && Number(form.stock) >= 0 },
          { label: 'Foto produk', ok: Boolean(imagePreview) },
        ] as const).map(({ label, ok }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: ok ? '#dcfce7' : 'var(--pk-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {ok ? (
                <Icon name="check" size={10} style={{ color: '#16a34a' }} stroke={3} />
              ) : (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--pk-border-strong)' }} />
              )}
            </div>
            <span style={{ color: ok ? 'var(--pk-text-secondary)' : 'var(--pk-text-hint)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SellerProductForm({
  mode,
  productId,
  initialValues = EMPTY_FORM,
  initialImageUrl = null,
}: {
  mode: 'create' | 'edit';
  productId?: string;
  initialValues?: SellerProductFormValues;
  initialImageUrl?: string | null;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const storeName = user?.name || 'Toko Anda';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowNavigationRef = useRef(false);
  const [initialSnapshot] = useState(() => JSON.stringify({ form: initialValues, image: initialImageUrl }));
  const [form, setForm] = useState(initialValues);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftKey = userId
    ? `pasarkita:seller-product-draft:${userId}:${mode}:${productId || 'new'}`
    : null;
  const errors = useMemo(() => getErrors(form), [form]);
  const currentSnapshot = JSON.stringify({ form, image: imagePreview });
  const isDirty = currentSnapshot !== initialSnapshot || Boolean(imageFile);
  const isValid = Object.values(errors).every((error) => !error);

  useEffect(() => {
    if (!draftKey || draftLoaded) return;
    const rawDraft = window.localStorage.getItem(draftKey);
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft) as { form?: SellerProductFormValues };
        if (draft.form) {
          // Restoring persisted browser state is the purpose of this synchronization effect.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setForm(draft.form);
          toast.info('Draft produk dari browser dipulihkan.');
        }
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }
    setDraftLoaded(true);
  }, [draftKey, draftLoaded]);

  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    if (!isDirty) {
      window.localStorage.removeItem(draftKey);
      return;
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ form, savedAt: new Date().toISOString() }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftLoaded, form, isDirty]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!isDirty || allowNavigationRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [isDirty]);

  const updateField = (field: keyof SellerProductFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const confirmLeave = () => {
    if (!isDirty || window.confirm('Perubahan belum disimpan. Tetap keluar dari form?')) {
      allowNavigationRef.current = true;
      return true;
    }
    return false;
  };

  const clearDraft = () => {
    if (draftKey) window.localStorage.removeItem(draftKey);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5MB');
      event.target.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format gambar harus JPG, PNG, atau WebP');
      event.target.value = '';
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (isPublish: boolean) => {
    setSubmitted(true);
    if (!isValid) {
      toast.error('Periksa kembali field yang masih tidak valid.');
      return;
    }

    try {
      setLoading(true);
      let imageUrl = imagePreview;
      if (imageFile) {
        toast.info('Mengunggah foto produk...');
        const uploadResponse = await productsApi.uploadImage(imageFile);
        imageUrl = uploadResponse.data.data.image_url;
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        stock: Number(form.stock),
        minimum_stock: Number(form.minimumStock),
        image_url: imageUrl,
        is_active: isPublish,
      };

      if (mode === 'edit' && productId) {
        await productsApi.update(productId, payload);
      } else {
        await productsApi.create(payload);
      }

      clearDraft();
      allowNavigationRef.current = true;
      toast.success(mode === 'edit' ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
      router.push('/seller/products');
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal menyimpan produk'));
    } finally {
      setLoading(false);
    }
  };

  const errorFor = (field: keyof SellerProductFormValues) =>
    submitted || touched[field] ? errors[field] : '';

  return (
    <>
      <Link
        href="/seller/products"
        onClick={(event) => {
          if (!confirmLeave()) event.preventDefault();
        }}
        style={{ fontSize: 13, color: 'var(--pk-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, textDecoration: 'none' }}
      >
        <Icon name="arrowLeft" size={14} /> Kembali
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
        {mode === 'edit' ? 'Edit Produk' : 'Tambah Produk Baru'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '0 0 24px' }}>
        Draft teks tersimpan otomatis di browser. Foto baru perlu dipilih kembali setelah reload.
      </p>

      {/* Layout 2 kolom: Form | Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 28,
          alignItems: 'start',
        }}
      >
        {/* ── Kolom kiri: Form ── */}
        <div className="pk-card" style={{ padding: 'clamp(20px, 4vw, 32px)', background: '#fff' }}>
          <div style={{ marginBottom: 20 }}>
            <label className="pk-label" htmlFor="product-name">Nama Produk</label>
            <input
              id="product-name"
              className="pk-input"
              placeholder="Contoh: Kopi Arabika Gayo 250g"
              maxLength={NAME_MAX}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              aria-invalid={Boolean(errorFor('name'))}
            />
            <div className="pk-hint" style={{ color: errorFor('name') ? 'var(--pk-danger)' : undefined }}>
              {errorFor('name') || `${form.name.length}/${NAME_MAX} karakter`}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="pk-label" htmlFor="product-description">Deskripsi</label>
            <textarea
              id="product-description"
              className="pk-textarea"
              rows={5}
              maxLength={DESCRIPTION_MAX}
              placeholder="Jelaskan bahan, ukuran, proses pembuatan, dan keunggulan produk."
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              aria-invalid={Boolean(errorFor('description'))}
            />
            <div className="pk-hint" style={{ color: errorFor('description') ? 'var(--pk-danger)' : undefined }}>
              {errorFor('description') || `${form.description.length}/${DESCRIPTION_MAX} karakter, minimal 20`}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="pk-label" htmlFor="product-category">Kategori</label>
            <select
              id="product-category"
              className="pk-select"
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
              aria-invalid={Boolean(errorFor('category'))}
            >
              <option value="">Pilih kategori</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            {errorFor('category') && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errorFor('category')}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div>
              <label className="pk-label" htmlFor="product-price">Harga</label>
              <input
                id="product-price"
                className="pk-input"
                type="number"
                min={100}
                step={1}
                placeholder="10000"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                aria-invalid={Boolean(errorFor('price'))}
              />
              {errorFor('price') && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errorFor('price')}</div>}
            </div>
            <div>
              <label className="pk-label" htmlFor="product-stock">Stok Saat Ini</label>
              <input
                id="product-stock"
                className="pk-input"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.stock}
                onChange={(event) => updateField('stock', event.target.value)}
                aria-invalid={Boolean(errorFor('stock'))}
              />
              {errorFor('stock') && <div className="pk-hint" style={{ color: 'var(--pk-danger)' }}>{errorFor('stock')}</div>}
            </div>
            <div>
              <label className="pk-label" htmlFor="product-minimum-stock">Batas Stok Minimum</label>
              <input
                id="product-minimum-stock"
                className="pk-input"
                type="number"
                min={0}
                step={1}
                placeholder="5"
                value={form.minimumStock}
                onChange={(event) => updateField('minimumStock', event.target.value)}
                aria-invalid={Boolean(errorFor('minimumStock'))}
              />
              <div className="pk-hint" style={{ color: errorFor('minimumStock') ? 'var(--pk-danger)' : undefined }}>
                {errorFor('minimumStock') || 'Peringatan muncul saat stok menyentuh angka ini.'}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label className="pk-label">Foto Produk</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImageChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', border: '1.5px dashed var(--pk-border-strong)', borderRadius: 8, padding: imagePreview ? 8 : 24, textAlign: 'center', background: 'var(--pk-bg-subtle)', cursor: 'pointer', overflow: 'hidden' }}
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Preview produk" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <>
                  <Icon name="package" size={22} style={{ color: 'var(--pk-text-hint)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Klik untuk memilih foto utama</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>PNG, JPG, atau WebP hingga 5MB</div>
                </>
              )}
            </button>
            {imagePreview && (
              <button
                style={{ fontSize: 12, color: 'var(--pk-danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Hapus Foto
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', paddingTop: 20, borderTop: '1px solid var(--pk-border)' }}>
            {isDirty && <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--pk-text-hint)' }}>Perubahan belum disimpan</span>}
            <Link
              href="/seller/products"
              className="pk-btn pk-btn-ghost"
              onClick={(event) => {
                if (!confirmLeave()) event.preventDefault();
              }}
              style={{ textDecoration: 'none' }}
            >
              Batal
            </Link>
            <button type="button" className="pk-btn pk-btn-secondary" onClick={() => void handleSubmit(false)} disabled={loading}>
              Simpan sebagai Draf
            </button>
            <button type="button" className="pk-btn pk-btn-primary" onClick={() => void handleSubmit(true)} disabled={loading}>
              {loading ? 'Menyimpan...' : mode === 'edit' ? 'Publikasikan Perubahan' : 'Publikasikan Produk'}
            </button>
          </div>
        </div>

        {/* ── Kolom kanan: Preview card ── */}
        <ProductPreviewCard
          form={form}
          imagePreview={imagePreview}
          storeName={storeName}
        />
      </div>
    </>
  );
}
