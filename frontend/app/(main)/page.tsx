import Link from 'next/link';
import Icon from '@/components/pk/icon';
import Placeholder from '@/components/pk/placeholder';
import { formatIDR } from '@/lib/format';

const CATEGORIES = ['Fashion', 'Makanan', 'Kerajinan', 'Elektronik', 'Kecantikan', 'Rumah', 'Buku', 'Olahraga'];

const PRODUCTS = [
  { id: 'p1', name: 'Batik Tulis Pekalongan', seller: 'Batik Nusantara', price: 285000, stock: 12, cat: 'Fashion' },
  { id: 'p2', name: 'Keripik Singkong Balado', seller: 'Warung Bu Sari', price: 18500, stock: 48, cat: 'Makanan' },
  { id: 'p3', name: 'Tas Rotan Handwoven', seller: 'Kriya Bali', price: 145000, stock: 7, cat: 'Kerajinan' },
  { id: 'p4', name: 'Speaker Bluetooth Mini', seller: 'Toko Elektro ID', price: 220000, stock: 23, cat: 'Elektronik' },
  { id: 'p5', name: 'Kopi Arabika Gayo 250g', seller: 'Kopi Rakyat', price: 89000, stock: 34, cat: 'Makanan' },
  { id: 'p6', name: 'Kemeja Linen Pria', seller: 'Tenun Modern', price: 189000, stock: 15, cat: 'Fashion' },
  { id: 'p7', name: 'Gerabah Kasongan Set', seller: 'Kriya Bali', price: 95000, stock: 9, cat: 'Kerajinan' },
  { id: 'p8', name: 'Madu Hutan Flores 500ml', seller: 'Kopi Rakyat', price: 125000, stock: 22, cat: 'Makanan' },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '72px 80px 48px', textAlign: 'center', background: '#fff' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid var(--pk-border)',
            borderRadius: 999,
            fontSize: 12,
            color: 'var(--pk-text-secondary)',
            marginBottom: 20,
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pk-success)', display: 'inline-block' }}
          />
          12.480 UMKM sedang berjualan
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 860,
            marginInline: 'auto',
          }}
        >
          Belanja dari <span style={{ color: 'var(--pk-text-secondary)' }}>UMKM Indonesia</span>,
          <br />semudah chat teman.
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'var(--pk-text-secondary)',
            marginTop: 16,
            maxWidth: 560,
            marginInline: 'auto',
            lineHeight: 1.55,
          }}
        >
          Produk asli dari ribuan pelaku usaha kecil. Transaksi aman lewat SmartBank, dikirim langsung ke pintu Anda.
        </p>
        <div
          style={{
            maxWidth: 620,
            marginInline: 'auto',
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid var(--pk-border)',
            borderRadius: 999,
            padding: '6px 6px 6px 18px',
            boxShadow: 'var(--pk-shadow-sm)',
          }}
        >
          <Icon name="search" size={18} style={{ color: 'var(--pk-text-hint)' }} />
          <input
            placeholder="Cari batik, kopi, kerajinan, ..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
              padding: '12px 0',
            }}
          />
          <button className="pk-btn pk-btn-primary" style={{ borderRadius: 999, height: 40 }}>
            Cari
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginTop: 20,
            fontSize: 12,
            color: 'var(--pk-text-hint)',
          }}
        >
          <span>Populer:</span>
          {['Batik tulis', 'Kopi lokal', 'Tas rotan', 'Keripik'].map((t) => (
            <a key={t} style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>
              {t}
            </a>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '0 80px 40px' }}>
        <div
          className="pk-scroll"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}
        >
          {['Semua', ...CATEGORIES].map((c, i) => (
            <button
              key={c}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid ' + (i === 0 ? 'var(--pk-text)' : 'var(--pk-border)'),
                background: i === 0 ? 'var(--pk-text)' : '#fff',
                color: i === 0 ? '#fff' : 'var(--pk-text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section style={{ padding: '0 80px 64px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
            Pilihan untuk Anda
          </h2>
          <Link href="/products" style={{ fontSize: 13, color: 'var(--pk-accent)' }}>
            Lihat semua →
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20,
          }}
        >
          {PRODUCTS.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="pk-card pk-card-hover" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                <Placeholder label={p.cat.toLowerCase()} height={200} style={{ borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--pk-text)',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginBottom: 10 }}>
                    {p.seller}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--pk-text)' }}>
                      {formatIDR(p.price)}
                    </div>
                    {p.stock <= 5 && (
                      <span className="pk-badge pk-badge-neutral" style={{ fontSize: 11 }}>
                        Sisa {p.stock}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section style={{ padding: '0 80px 80px' }}>
        <div
          style={{
            background: 'var(--pk-text)',
            color: '#fff',
            borderRadius: 16,
            padding: '48px 56px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 40,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Untuk Seller
            </div>
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                maxWidth: 520,
              }}
            >
              Punya usaha? Mulai jual di PasarKita dalam 5 menit.
            </h3>
            <p
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                marginTop: 12,
                maxWidth: 520,
              }}
            >
              Gratis biaya langganan. Hanya 2% fee per transaksi. Dapat pelanggan dari seluruh Indonesia.
            </p>
          </div>
          <button
            style={{
              background: '#fff',
              color: 'var(--pk-text)',
              border: 'none',
              borderRadius: 8,
              padding: '0 22px',
              height: 48,
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Mulai Berjualan →
          </button>
        </div>
      </section>
    </div>
  );
}
