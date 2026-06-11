import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.05em', color: 'var(--pk-text)' }}>404</div>
        <h1 style={{ fontSize: 24, margin: '8px 0' }}>Halaman tidak ditemukan</h1>
        <p style={{ color: 'var(--pk-text-secondary)', margin: '0 0 24px' }}>
          Tautan mungkin sudah berubah atau halaman tidak tersedia.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <Link href="/products" className="pk-btn pk-btn-primary">Kembali ke Katalog</Link>
          <Link href="/" className="pk-btn pk-btn-secondary">Beranda</Link>
        </div>
      </div>
    </main>
  );
}
