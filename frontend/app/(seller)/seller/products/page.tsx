'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: on ? 'var(--pk-success)' : 'var(--pk-border-strong)',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 150ms ease', padding: 0,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 19 : 3,
        transition: 'left 150ms ease',
      }} />
    </button>
  );
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    async function loadSellerProducts() {
      if (!user?.id) return;
      try {
        setLoading(true);
        // Menggunakan library axios `api` yang meng-inject Bearer Token
        const res = await api.get(`/products?seller_id=${user.id}`);
        setProducts(res.data.data || []);
      } catch (err) {
        console.error("Gagal get seller products", err);
      } finally {
        setLoading(false);
      }
    }
    loadSellerProducts();
  }, [user]);

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      // Optimistic update
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: newStatus } : p)));
      
      // Update di backend 
      await api.put(`/products/${id}`, { is_active: newStatus });
    } catch (err) {
      console.error("Gagal merubah status produk:", err);
      // Revert upon failure
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: currentStatus } : p)));
    }
  };

  const activeCount = products.filter((p) => p.is_active).length;

  if (loading) {
     return <div style={{ padding: '40px', color: 'var(--pk-text-hint)' }}>Memuat etalase produk Anda...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Produk Saya</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            {products.length} produk · {activeCount} aktif
          </p>
        </div>
        <Link href="/seller/products/add" style={{ textDecoration: 'none' }}>
          <button className="pk-btn pk-btn-primary">
            <Icon name="plus" size={14} stroke={2.5} /> Tambah Produk
          </button>
        </Link>
      </div>

      <div className="pk-card" style={{ overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input className="pk-input" placeholder="Cari produk..." style={{ height: 36, paddingLeft: 36, fontSize: 13 }} />
          </div>
          <button className="pk-btn pk-btn-secondary pk-btn-sm">
            <Icon name="filter" size={14} /> Filter
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Nama Produk', 'Harga', 'Stok', 'Status', 'Aksi'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'left',
                  padding: '10px 20px', fontSize: 12, fontWeight: 500,
                  color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--pk-border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--pk-text-hint)' }}>
                  Catatan: Anda belum memiliki produk di database. Tambah sekarang!
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Placeholder label="img" height={40} style={{ width: 40, borderRadius: 6, fontSize: 9 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{p.category || 'Belanja'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500 }}>{formatIDR(p.price)}</td>
                <td style={{ padding: '14px 20px', fontSize: 14 }}>{p.stock}</td>
                <td style={{ padding: '14px 20px' }}>
                  <Toggle on={p.is_active} onChange={(v) => toggleActive(p.id, v)} />
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <a style={{ fontSize: 13, color: 'var(--pk-accent)', cursor: 'pointer', fontWeight: 500 }}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
