'use client';

import Link from 'next/link';
import Icon from '@/components/pk/icon';

export default function SellerUnauthorizedPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F9FAFB 0%, #EFF6FF 50%, #F0FDF4 100%)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 520, padding: '0 24px' }}>
        {/* Illustration: Lock + Store Icon */}
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 32px',
            borderRadius: 28,
            background: 'linear-gradient(135deg, #111827 0%, #1F2937 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(17, 24, 39, 0.15), 0 4px 16px rgba(17, 24, 39, 0.1)',
            position: 'relative',
          }}
        >
          {/* Store Icon */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {/* Lock badge */}
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              width: 36,
              height: 36,
              borderRadius: 12,
              background: '#fff',
              border: '2px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(220, 38, 38, 0.08)',
            color: '#DC2626',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20,
            letterSpacing: '-0.01em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Akses Ditolak
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
            color: '#111827',
            margin: '0 0 12px',
          }}
        >
          Halaman Khusus{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #2563EB, #0D9488)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Seller
          </span>
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 16,
            color: '#6B7280',
            lineHeight: 1.6,
            margin: '0 0 36px',
            maxWidth: 440,
            marginInline: 'auto',
          }}
        >
          Untuk mengakses dashboard penjual, kamu perlu mendaftar sebagai Seller di PasarKita. 
          Mulai jual produk UMKM-mu ke ribuan pembeli di seluruh Indonesia!
        </p>

        {/* Features */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 36,
          }}
        >
          {[
            { icon: '🏪', label: 'Kelola Toko', desc: 'Dashboard penjual lengkap' },
            { icon: '📦', label: 'Upload Produk', desc: 'Jual tanpa batas' },
            { icon: '💰', label: 'Fee Rendah', desc: 'Hanya 2% per transaksi' },
          ].map((f) => (
            <div
              key={f.label}
              style={{
                padding: '20px 12px',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(8px)',
                borderRadius: 14,
                border: '1px solid #E5E7EB',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Link href="/auth/register?role=seller" style={{ textDecoration: 'none' }}>
            <button
              style={{
                height: 48,
                padding: '0 28px',
                borderRadius: 12,
                background: '#111827',
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 150ms ease',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#000';
                (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                (e.target as HTMLElement).style.boxShadow = '0 8px 24px rgba(17, 24, 39, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#111827';
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
            >
              Daftar Jadi Seller
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </Link>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button
              style={{
                height: 48,
                padding: '0 24px',
                borderRadius: 12,
                background: '#fff',
                color: '#111827',
                border: '1px solid #E5E7EB',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#F9FAFB';
                (e.target as HTMLElement).style.borderColor = '#D1D5DB';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#fff';
                (e.target as HTMLElement).style.borderColor = '#E5E7EB';
              }}
            >
              Kembali ke Beranda
            </button>
          </Link>
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 24 }}>
          Sudah punya akun seller?{' '}
          <Link href="/auth/login" style={{ color: '#2563EB', fontWeight: 500 }}>
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
