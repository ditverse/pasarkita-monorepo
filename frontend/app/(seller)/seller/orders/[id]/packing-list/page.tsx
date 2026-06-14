'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/pk/icon';
import { ordersApi } from '@/lib/api/orders';

export default function PackingListPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['orders', id, 'packing-list'],
    queryFn: async () => (await ordersApi.getPackingList(id)).data.data,
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return <div style={{ padding: 64, textAlign: 'center' }}>Memuat packing list...</div>;
  }
  if (query.isError || !query.data) {
    return <div style={{ padding: 64, textAlign: 'center' }}>Packing list tidak dapat dimuat.</div>;
  }

  const data = query.data;
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="pk-print-hidden" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Link href="/seller/orders" className="pk-btn pk-btn-secondary" style={{ textDecoration: 'none' }}>
          <Icon name="arrowLeft" size={14} /> Kembali
        </Link>
        <button type="button" className="pk-btn pk-btn-primary" onClick={() => window.print()}>
          <Icon name="clipboard" size={14} /> Cetak Packing List
        </button>
      </div>

      <article className="pk-card" style={{ background: '#fff', padding: 32 }}>
        <header style={{ borderBottom: '2px solid var(--pk-text)', paddingBottom: 18, marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pk-text-hint)' }}>
            Packing List PasarKita
          </div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 24 }}>{data.store_name}</h1>
          <div className="pk-mono" style={{ fontSize: 12 }}>Order {data.order_id.toUpperCase()}</div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 26 }}>
          <section>
            <strong style={{ fontSize: 13 }}>Pickup</strong>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: '6px 0 0' }}>{data.pickup_address || '-'}</p>
            {data.contact_phone && <p style={{ fontSize: 12, margin: '4px 0 0' }}>{data.contact_phone}</p>}
          </section>
          <section>
            <strong style={{ fontSize: 13 }}>Tujuan: {data.buyer_name}</strong>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: '6px 0 0' }}>{data.shipping_address}</p>
            <p className="pk-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>Resi: {data.tracking_id || 'Belum tersedia'}</p>
          </section>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--pk-border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12 }}>Produk</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, width: 80 }}>Qty</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, width: 100 }}>Cek</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.product_id} style={{ borderBottom: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '14px 8px', fontSize: 13 }}>{item.product_name}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: 20 }}>□</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer style={{ marginTop: 28, fontSize: 11, color: 'var(--pk-text-hint)' }}>
          Dicetak {new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}. Periksa jumlah dan kondisi barang sebelum paket disegel.
        </footer>
      </article>
    </div>
  );
}
