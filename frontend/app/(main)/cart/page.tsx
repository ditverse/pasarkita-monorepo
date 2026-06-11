'use client';

import Link from 'next/link';
import ProductImage from '@/components/pk/product-image';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { useCartStore } from '@/store/cart';

export default function CartPage() {
  const { items, updateQty, removeItem, clearCart } = useCartStore();
  const subtotal = items.reduce((total, item) => total + item.price * item.qty, 0);
  const itemCount = items.reduce((total, item) => total + item.qty, 0);

  const handleClear = () => {
    if (window.confirm('Kosongkan seluruh isi keranjang?')) clearCart();
  };

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: 16, background: 'var(--pk-bg-subtle)', display: 'grid', placeItems: 'center', color: 'var(--pk-text-hint)' }}>
          <Icon name="cart" size={28} />
        </div>
        <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Keranjang masih kosong</h1>
        <p style={{ color: 'var(--pk-text-secondary)', margin: '0 0 24px' }}>
          Temukan produk UMKM yang Anda suka dan tambahkan ke keranjang.
        </p>
        <Link href="/products" className="pk-btn pk-btn-primary">Mulai Belanja</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px, 6vw, 80px) 64px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: '0 0 4px' }}>Keranjang</h1>
          <p style={{ color: 'var(--pk-text-secondary)', fontSize: 14, margin: 0 }}>{itemCount} barang dipilih</p>
        </div>
        <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={handleClear} style={{ color: 'var(--pk-danger)' }}>
          Kosongkan Keranjang
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => (
            <div key={item.productId} className="pk-card" style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
              <ProductImage src={item.imageUrl} alt={item.name} height={80} style={{ width: 80, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link href={`/products/${item.productId}`} style={{ color: 'var(--pk-text)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  {item.name}
                </Link>
                <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 3 }}>{item.sellerName}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{formatIDR(item.price)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ display: 'flex', height: 34, border: '1px solid var(--pk-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <button type="button" aria-label={`Kurangi ${item.name}`} onClick={() => updateQty(item.productId, item.qty - 1)} disabled={item.qty <= 1} style={{ width: 34, border: 0, background: '#fff', cursor: item.qty <= 1 ? 'not-allowed' : 'pointer' }}>
                    <Icon name="minus" size={13} />
                  </button>
                  <input
                    aria-label={`Jumlah ${item.name}`}
                    type="number"
                    min={1}
                    max={item.stock}
                    value={item.qty}
                    onChange={(event) => updateQty(item.productId, Number(event.target.value) || 1)}
                    style={{ width: 46, border: 0, borderInline: '1px solid var(--pk-border)', textAlign: 'center' }}
                  />
                  <button type="button" aria-label={`Tambah ${item.name}`} onClick={() => updateQty(item.productId, item.qty + 1)} disabled={item.qty >= item.stock} style={{ width: 34, border: 0, background: '#fff', cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer' }}>
                    <Icon name="plus" size={13} />
                  </button>
                </div>
                <button type="button" onClick={() => removeItem(item.productId)} style={{ border: 0, background: 'transparent', color: 'var(--pk-danger)', fontSize: 12, cursor: 'pointer' }}>
                  Hapus
                </button>
                <Link
                  href={`/checkout?productId=${item.productId}&qty=${item.qty}`}
                  className="pk-btn pk-btn-primary pk-btn-sm"
                >
                  Checkout
                </Link>
              </div>
            </div>
          ))}
        </div>

        <aside className="pk-card" style={{ padding: 22, position: 'sticky', top: 88 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 18px' }}>Ringkasan Belanja</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pk-text-secondary)' }}>
            <span>Subtotal ({itemCount} barang)</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
          <div style={{ margin: '16px 0', borderTop: '1px solid var(--pk-border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Total sementara</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--pk-text-hint)', lineHeight: 1.5 }}>
            Pilih tombol Checkout pada barang yang ingin dibayar. Checkout multi-produk akan dilengkapi setelah alur grouping seller siap.
          </p>
          <Link href="/products" className="pk-btn pk-btn-secondary pk-btn-block">
            Lanjut Belanja
          </Link>
        </aside>
      </div>
    </div>
  );
}
