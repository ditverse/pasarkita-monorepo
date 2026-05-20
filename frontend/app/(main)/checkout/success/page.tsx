'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

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
            background: '#F0FDF4',
            border: '2px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            marginBottom: 24,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 8px' }}>
          Pesanan Berhasil!
        </h1>
        <p style={{ fontSize: 15, color: 'var(--pk-text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Pembayaran kamu telah diproses. Pesanan sedang disiapkan oleh seller.
        </p>

        {orderId && (
          <div
            style={{
              background: 'var(--pk-bg-subtle)',
              border: '1px solid var(--pk-border)',
              borderRadius: 10,
              padding: '14px 20px',
              marginBottom: 28,
              display: 'inline-block',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 4 }}>Nomor Order</div>
            <div className="pk-mono" style={{ fontSize: 13, fontWeight: 500 }}>
              {orderId.slice(0, 8).toUpperCase()}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {orderId && (
            <Link href={`/orders/${orderId}`} style={{ textDecoration: 'none' }}>
              <button className="pk-btn pk-btn-primary">Lihat Detail Order</button>
            </Link>
          )}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button className="pk-btn pk-btn-secondary">Lanjut Belanja</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
