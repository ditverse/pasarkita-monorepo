'use client';

import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { api } from '@/lib/api';
import { checkoutApi } from '@/lib/api/checkout';
import { productsApi } from '@/lib/api/products';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Product } from '@/types/api';

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'pk-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 15 : 13, color: muted ? 'var(--pk-text-hint)' : 'var(--pk-text-secondary)', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 17 : 14, color: 'var(--pk-text)', fontWeight: bold ? 600 : 500 }}>
        {value}
      </span>
    </div>
  );
}

// ── Inner component yang pakai useSearchParams ────────────────
// Harus dipisah agar bisa di-wrap Suspense (Next.js requirement)

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const productId = searchParams.get('productId');
  const qtyUrl = Math.max(1, parseInt(searchParams.get('qty') || '1'));

  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!loading) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [loading]);

  const productQuery = useQuery({
    queryKey: ['products', 'checkout', productId],
    queryFn: async (): Promise<Product> => {
      const res = await productsApi.getById(productId as string);
      return res.data.data;
    },
    enabled: Boolean(productId),
  });

  const balanceQuery = useQuery({
    queryKey: ['smartbank', 'balance', user?.id],
    queryFn: async (): Promise<number | null> => {
      const res = await api.get('/smartbank/balance');
      return res.data.data?.balance ?? null;
    },
    enabled: Boolean(user),
  });

  if (productQuery.isLoading) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spinner size={24} />
      </div>
    );
  }

  const product = productQuery.data ?? null;
  const balance = balanceQuery.data ?? null;

  if (!productId || !product) {
    return (
      <div style={{ padding: '64px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 16 }}>Produk tidak valid untuk di-checkout.</h2>
        <button className="pk-btn pk-btn-primary" onClick={() => router.push('/')}>
          Kembali Belanja
        </button>
      </div>
    );
  }

  const subtotal = product.price * qtyUrl;
  const feeMarketplace = Math.round(subtotal * 0.02);
  const total = subtotal + feeMarketplace;

  const handlePay = async () => {
    if (!user) {
      toast.error('Anda harus login terlebih dahulu');
      router.push('/auth/login');
      return;
    }
    if (!address.trim() || address.trim().length < 10) {
      toast.error('Alamat pengiriman terlalu pendek');
      return;
    }
    if (!window.confirm(`Bayar ${formatIDR(total)} untuk ${qtyUrl} barang melalui SmartBank?`)) {
      return;
    }

    setLoading(true);
    try {
      // Payload sesuai PRD: multi-item, snake_case
      const res = await checkoutApi.checkout({
        items: [{ product_id: product.id, qty: qtyUrl }],
        shipping_address: address.trim(),
      });
      const orderId = res.data.data?.order_id;
      toast.success('Checkout berhasil!');
      router.push(`/checkout/success?orderId=${orderId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string; details?: string }; message?: string } } };
      const code = axiosErr.response?.data?.error?.code;

      if (code === 'INSUFFICIENT_STOCK') {
        toast.error(axiosErr.response?.data?.error?.details ?? 'Stok tidak mencukupi');
      } else if (code === 'TRANSACTION_COOLDOWN') {
        toast.error('Tunggu beberapa detik sebelum transaksi berikutnya');
      } else if (code === 'DAILY_LIMIT_EXCEEDED') {
        toast.error('Batas 10 transaksi harian telah tercapai');
      } else if (code === 'PAYMENT_FAILED') {
        router.push('/checkout/failed');
      } else {
        toast.error(axiosErr.response?.data?.message ?? 'Checkout gagal, coba lagi');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 80px 64px', maxWidth: 1200, marginInline: 'auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 32px' }}>
        Checkout
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 32 }}>
        {/* Kiri: Ringkasan */}
        <div>
          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Ringkasan Pesanan
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <ProductImage
                src={product.image_url}
                alt={product.name}
                height={64}
                style={{ width: 64, borderRadius: 8, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>
                  Qty {qtyUrl} × {formatIDR(product.price)}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(subtotal)}</div>
            </div>

            <div style={{ height: 1, background: 'var(--pk-border)', margin: '20px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Fee Marketplace (2%)" value={formatIDR(feeMarketplace)} muted />
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(total)} bold />
            </div>
          </div>
        </div>

        {/* Kanan: Alamat & Bayar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Alamat Pengiriman
            </div>
            <label className="pk-label">Alamat lengkap</label>
            <textarea
              className="pk-textarea"
              rows={4}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Contoh No. 1, Kota, Provinsi"
            />
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Pembayaran
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1.5px solid var(--pk-text)', borderRadius: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--pk-text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11 }}>
                SB
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>SmartBank Transfer</div>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>Otomatis · Dana ditahan sampai barang diterima</div>
              </div>
              <Icon name="check" size={16} stroke={2.5} />
            </div>
            {/* Saldo SmartBank */}
            {balance !== null && (
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 8,
                background: balance >= total ? 'var(--pk-success-soft)' : 'var(--pk-danger-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: balance >= total ? 'var(--pk-success)' : 'var(--pk-danger)' }}>
                  Saldo SmartBank
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: balance >= total ? 'var(--pk-success)' : 'var(--pk-danger)' }}>
                  {formatIDR(balance)}
                </span>
              </div>
            )}
          </div>

          <button
            className="pk-btn pk-btn-primary pk-btn-lg pk-btn-block"
            disabled={loading || product.stock < 1 || (balance !== null && balance < total)}
            onClick={handlePay}
            title={
              product.stock < 1
                ? 'Produk sedang kehabisan stok'
                : balance !== null && balance < total
                  ? 'Saldo SmartBank tidak mencukupi'
                  : undefined
            }
          >
            {loading ? (
              <><Spinner /> Memproses...</>
            ) : product.stock < 1 ? (
              'Stok Habis'
            ) : balance !== null && balance < total ? (
              'Saldo Tidak Cukup'
            ) : (
              `Bayar ${qtyUrl} Barang · ${formatIDR(total)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page export dengan Suspense boundary ─────────────────────
// Wajib agar Next.js build tidak gagal karena useSearchParams

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 100, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
        Memuat halaman checkout...
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
