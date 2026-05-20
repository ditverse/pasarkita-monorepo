'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/pk/icon';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

export default function AddProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
  });
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!form.name || !form.description || !form.category || !form.price || !form.stock) {
      toast.error('Semua field wajib diisi');
      return;
    }

    try {
      setLoading(true);
      await productsApi.create({
        name: form.name,
        description: form.description,
        category: form.category,
        price: parseInt(form.price),
        stock: parseInt(form.stock),
      });
      toast.success('Produk berhasil ditambahkan!');
      router.push('/seller/products');
      router.refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message ?? 'Gagal menyimpan produk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link href="/seller/products" style={{ fontSize: 13, color: 'var(--pk-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, textDecoration: 'none' }}>
        <Icon name="arrowLeft" size={14} /> Kembali
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Tambah Produk Baru</h1>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '0 0 32px' }}>
        Isi detail produk di bawah. Semua field wajib kecuali yang ditandai opsional.
      </p>

      <div className="pk-card" style={{ padding: 32, maxWidth: 640, background: '#fff' }}>

        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Nama Produk</label>
          <input 
            className="pk-input" 
            placeholder="Contoh: Kopi Arabika Gayo 250g" 
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Deskripsi</label>
          <textarea 
            className="pk-textarea" 
            rows={4} 
            placeholder="Jelaskan bahan, ukuran, proses pembuatan, dsb."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="pk-hint">Minimal 20 karakter. Deskripsi yang jelas meningkatkan konversi.</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Kategori</label>
          <div style={{ position: 'relative' }}>
            <select 
              className="pk-select" 
              style={{ appearance: 'none', paddingRight: 36 }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Pilih kategori</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Icon name="chevronDown" size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--pk-text-hint)' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div>
            <label className="pk-label">Harga</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--pk-text-hint)' }}>Rp</span>
              <input 
                className="pk-input" 
                type="number" 
                placeholder="0" 
                style={{ paddingLeft: 36 }}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="pk-label">Stok</label>
            <input 
              className="pk-input" 
              type="number" 
              placeholder="0" 
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label className="pk-label">Foto Produk</label>
          <input 
            type="file" 
            accept="image/png, image/jpeg" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          <div 
            style={{ 
              border: '1.5px dashed var(--pk-border-strong)', 
              borderRadius: 8, 
              padding: imagePreview ? 8 : 24, 
              textAlign: 'center', 
              background: 'var(--pk-bg-subtle)', 
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 6 }} />
            ) : (
              <>
                <Icon name="package" size={22} style={{ color: 'var(--pk-text-hint)', marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>Klik untuk upload atau drag & drop</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>PNG, JPG hingga 5MB · Maks 8 foto</div>
              </>
            )}
          </div>
          {imagePreview && (
            <button 
              style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
              onClick={() => setImagePreview(null)}
            >
              Hapus Foto
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--pk-border)' }}>
          <Link href="/seller/products" style={{ textDecoration: 'none' }}>
            <button className="pk-btn pk-btn-ghost" disabled={loading}>Batal</button>
          </Link>
          <button 
            className="pk-btn pk-btn-primary" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : 'Simpan Produk'}
          </button>
        </div>
      </div>
    </div>
  );
}
