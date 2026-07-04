'use client';

import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '@/components/pk/icon';
import ProductImage from '@/components/pk/product-image';
import { formatIDR } from '@/lib/format';
import { useCheckout } from '@/hooks/useCheckout';

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

// ─── Selector Alamat ─────────────────────────────────────────────────────────

function AddressSelector({ address, onChange }: { address: string; onChange: (val: string) => void }) {
  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const { profileApi } = await import('@/lib/api/profile');
      return profileApi.getAddresses();
    },
  });

  const [useManual, setUseManual] = useState(false);

  // Jika ada alamat, set default ke alamat utama (jika address belum di set)
  useEffect(() => {
    if (addresses && addresses.length > 0 && !address && !useManual) {
      const primary = addresses.find(a => a.is_primary) || addresses[0];
      onChange(primary.full_address);
    }
  }, [addresses, address, onChange, useManual]);

  if (!addresses || addresses.length === 0 || useManual) {
    return (
      <>
        {addresses && addresses.length > 0 && (
          <button
            type="button"
            className="pk-btn pk-btn-ghost pk-btn-sm"
            style={{ marginBottom: 12, display: 'block' }}
            onClick={() => setUseManual(false)}
          >
            ← Pakai Alamat Tersimpan
          </button>
        )}
        <label className="pk-label">Alamat lengkap</label>
        <textarea
          className="pk-textarea"
          rows={4}
          value={address}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Jl. Contoh No. 1, Kota, Provinsi"
        />
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {addresses.map((a) => (
          <label
            key={a.id}
            style={{
              display: 'flex',
              gap: 12,
              padding: 16,
              border: address === a.full_address ? '1.5px solid var(--pk-accent)' : '1px solid var(--pk-border)',
              borderRadius: 12,
              cursor: 'pointer',
              background: address === a.full_address ? 'var(--pk-bg-subtle)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="address_selector"
              checked={address === a.full_address}
              onChange={() => onChange(a.full_address)}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {a.label} {a.is_primary && <span className="pk-badge pk-badge-green" style={{ marginLeft: 6 }}>Utama</span>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{a.recipient_name} ({a.phone})</div>
              <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)', marginTop: 2 }}>{a.full_address}</div>
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="pk-btn pk-btn-ghost pk-btn-sm"
        style={{ marginTop: 16 }}
        onClick={() => { setUseManual(true); onChange(''); }}
      >
        + Gunakan Alamat Lain (Manual)
      </button>
    </>
  );
}

// ── Inner component yang pakai useSearchParams ────────────────
// Harus dipisah agar bisa di-wrap Suspense (Next.js requirement)

function CheckoutContent() {
  const {
    router,
    productId,
    loading,
    address,
    setAddress,
    marketplaceVoucherCode,
    setMarketplaceVoucherCode,
    sellerVoucherCodesText,
    setSellerVoucherCodesText,
    weeklyBudget,
    productQuery,
    weeklyOrdersQuery,
    quoteQuery,
    product,
    balance,
    quote,
    unitPrice,
    originalUnitPrice,
    subtotal,
    subtotalOriginal,
    productDiscountTotal,
    feeMarketplaceBase,
    feeDiscount,
    voucherDiscountTotal,
    total,
    weeklySpending,
    projectedRemaining,
    handlePay,
    qtyUrl,
  } = useCheckout();

  if (productQuery.isLoading) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spinner size={24} />
      </div>
    );
  }

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

  return (
    <div className="pk-page-shell" style={{ padding: '32px 80px 64px', maxWidth: 1200, marginInline: 'auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 32px' }}>
        Checkout
      </h1>

      <div className="pk-checkout-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 32 }}>
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
                  Qty {qtyUrl} × {formatIDR(unitPrice)}
                  {unitPrice < originalUnitPrice && (
                    <span style={{ marginLeft: 6, color: 'var(--pk-text-hint)', textDecoration: 'line-through' }}>
                      {formatIDR(originalUnitPrice)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{formatIDR(subtotal)}</div>
            </div>

            <div style={{ height: 1, background: 'var(--pk-border)', margin: '20px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Subtotal awal" value={formatIDR(subtotalOriginal)} muted />
              {productDiscountTotal > 0 && <Row label="Diskon produk" value={`- ${formatIDR(productDiscountTotal)}`} muted />}
              {voucherDiscountTotal > 0 && <Row label="Diskon voucher" value={`- ${formatIDR(voucherDiscountTotal)}`} muted />}
              <Row label="Fee Marketplace (2%)" value={formatIDR(feeMarketplaceBase)} muted />
              {feeDiscount > 0 && <Row label="Diskon fee" value={`- ${formatIDR(feeDiscount)}`} muted />}
              <div style={{ height: 1, background: 'var(--pk-border)', margin: '4px 0' }} />
              <Row label="Total" value={formatIDR(total)} bold />
            </div>
            {quote?.applied_vouchers?.length ? (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {quote.applied_vouchers.map((voucher) => (
                  <span key={`${voucher.scope}-${voucher.code}`} className="pk-badge pk-badge-active">
                    {voucher.code} - {formatIDR(voucher.discount_amount)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Kanan: Alamat & Bayar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Alamat Pengiriman
            </div>
            <AddressSelector address={address} onChange={setAddress} />
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
              Voucher
            </div>
            <label className="pk-label">Voucher Marketplace</label>
            <input
              className="pk-input"
              value={marketplaceVoucherCode}
              onChange={(event) => setMarketplaceVoucherCode(event.target.value.toUpperCase())}
              placeholder="Contoh: PASARKITAHEMAT"
              style={{ marginBottom: 12 }}
            />
            <label className="pk-label">Voucher Seller</label>
            <input
              className="pk-input"
              value={sellerVoucherCodesText}
              onChange={(event) => setSellerVoucherCodesText(event.target.value.toUpperCase())}
              placeholder="Pisahkan beberapa kode dengan koma"
            />
            {quoteQuery.isFetching && <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 10 }}>Menghitung promo...</div>}
            {quote?.rejected_vouchers?.length ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                {quote.rejected_vouchers.map((voucher) => (
                  <div key={voucher.code} style={{ fontSize: 12, color: 'var(--pk-danger)' }}>
                    {voucher.code}: {voucher.reason}
                  </div>
                ))}
              </div>
            ) : null}
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

          {weeklyBudget != null && (
            <div
              className="pk-card"
              style={{
                padding: 20,
                borderColor: projectedRemaining != null && projectedRemaining < 0
                  ? 'var(--pk-warning)'
                  : 'var(--pk-border)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dampak ke Anggaran Mingguan</div>
              {weeklyOrdersQuery.isLoading ? (
                <div className="pk-skel" style={{ height: 52, width: '100%' }} />
              ) : weeklyOrdersQuery.isError ? (
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
                  Ringkasan anggaran belum dapat dihitung. Transaksi tetap dapat dilanjutkan.
                </div>
              ) : (
                <>
                  <Row label="Belanja minggu ini" value={formatIDR(weeklySpending)} muted />
                  <div style={{ marginTop: 8 }}>
                    <Row label="Sisa setelah transaksi" value={formatIDR(projectedRemaining)} bold />
                  </div>
                  {projectedRemaining != null && projectedRemaining < 0 && (
                    <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--pk-warning-soft)', color: 'var(--pk-warning)', fontSize: 12, lineHeight: 1.5 }}>
                      Transaksi ini melewati anggaran sebesar {formatIDR(Math.abs(projectedRemaining))}.
                      Ini hanya pengingat dan tidak memblokir pembayaran.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
