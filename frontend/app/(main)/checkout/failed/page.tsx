'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function FailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason');

  const reasonMap: Record<string, string> = {
    PAYMENT_FAILED: 'Saldo SmartBank tidak mencukupi untuk menyelesaikan transaksi.',
    INSUFFICIENT_STOCK: 'Stok produk habis saat proses pembayaran berlangsung.',
    TRANSACTION_COOLDOWN: 'Transaksi terlalu cepat. Tunggu beberapa detik lalu coba lagi.',
    DAILY_LIMIT_EXCEEDED: 'Batas 10 transaksi harian telah tercapai.',
  };

  const message = reason ? (reasonMap[reason] ?? 'Terjadi kesalahan saat memproses pembayaran.') : 'Terjadi kesalahan saat memproses pembayaran.';

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#FEF2F2',
            border: '2px solid #FECACA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            marginBottom: 24,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 8px' }}>
          Pembayaran Gagal
        </h1>
        <p style={{ fontSize: 15, color: 'var(--pk-text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="pk-btn pk-btn-primary"
            onClick={() => router.back()}
          >
            Coba Lagi
          </button>
          <Link href="/products" style={{ textDecoration: 'none' }}>
            <button className="pk-btn pk-btn-secondary">Kembali ke Produk</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat...</div>}>
      <FailedContent />
    </Suspense>
  );
}
