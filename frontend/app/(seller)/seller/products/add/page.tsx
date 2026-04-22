import Link from 'next/link';
import Icon from '@/components/pk/icon';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

export default function AddProductPage() {
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
          <input className="pk-input" placeholder="Contoh: Kopi Arabika Gayo 250g" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Deskripsi</label>
          <textarea className="pk-textarea" rows={4} placeholder="Jelaskan bahan, ukuran, proses pembuatan, dsb." />
          <div className="pk-hint">Minimal 20 karakter. Deskripsi yang jelas meningkatkan konversi.</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="pk-label">Kategori</label>
          <div style={{ position: 'relative' }}>
            <select className="pk-select" style={{ appearance: 'none', paddingRight: 36 }}>
              <option>Pilih kategori</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <Icon name="chevronDown" size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--pk-text-hint)' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div>
            <label className="pk-label">Harga</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--pk-text-hint)' }}>Rp</span>
              <input className="pk-input" placeholder="0" style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div>
            <label className="pk-label">Stok</label>
            <input className="pk-input" type="number" placeholder="0" />
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label className="pk-label">Foto Produk</label>
          <div style={{ border: '1.5px dashed var(--pk-border-strong)', borderRadius: 8, padding: 24, textAlign: 'center', background: 'var(--pk-bg-subtle)', cursor: 'pointer' }}>
            <Icon name="package" size={22} style={{ color: 'var(--pk-text-hint)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>Klik untuk upload atau drag & drop</div>
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>PNG, JPG hingga 5MB · Maks 8 foto</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--pk-border)' }}>
          <Link href="/seller/products" style={{ textDecoration: 'none' }}>
            <button className="pk-btn pk-btn-ghost">Batal</button>
          </Link>
          <button className="pk-btn pk-btn-primary">Simpan Produk</button>
        </div>
      </div>
    </div>
  );
}
