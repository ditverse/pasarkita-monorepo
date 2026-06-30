'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { productsApi } from '@/lib/api/products';
import { adsApi } from '@/lib/api/ads';
import { getApiErrorMessage } from '@/lib/api-error';

export default function SellerAdsPage() {
  const queryClient = useQueryClient();
  
  // States for Booking Form
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);

  // Queries
  const { data: ads = [], isLoading: adsLoading } = useQuery({
    queryKey: ['seller', 'ads'],
    queryFn: async () => {
      const res = await adsApi.getSellerAds();
      return res.data.data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['seller', 'products-for-ads'],
    queryFn: async () => {
      const res = await productsApi.getMine({ limit: 100, status: 'active' });
      return (res.data.data ?? []).filter(p => p.stock > 0);
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: adsApi.createSellerAd,
    onSuccess: () => {
      toast.success('Booking iklan berhasil dibuat! Silakan lakukan pembayaran.');
      queryClient.invalidateQueries({ queryKey: ['seller', 'ads'] });
      // Reset form
      setProductId('');
      setStartDate('');
      setEndDate('');
      setTitle('');
      setCaption('');
      setShowBookingForm(false);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal membuat booking iklan'));
    },
  });

  const payMutation = useMutation({
    mutationFn: adsApi.paySellerAd,
    onSuccess: () => {
      toast.success('Pembayaran iklan berhasil dan saldo dipotong!');
      queryClient.invalidateQueries({ queryKey: ['seller', 'ads'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Pembayaran iklan gagal'));
    },
  });

  const pauseMutation = useMutation({
    mutationFn: adsApi.pauseSellerAd,
    onSuccess: () => {
      toast.success('Iklan berhasil dijeda.');
      queryClient.invalidateQueries({ queryKey: ['seller', 'ads'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal menjeda iklan'));
    },
  });

  // Calculations for estimation
  const getDurationInDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const duration = getDurationInDays();
  const pricePerDay = 5000;
  const estimatedCost = duration * pricePerDay;

  // Aggregate stats
  const totalBookings = ads.length;
  const activeAds = ads.filter(ad => ad.status === 'active').length;
  const totalSpent = ads
    .filter(ad => ad.payment_status === 'paid')
    .reduce((sum, ad) => sum + ad.total_price, 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !startDate || !endDate) {
      toast.error('Harap isi semua field utama');
      return;
    }
    if (duration <= 0) {
      toast.error('Tanggal selesai harus setelah tanggal mulai');
      return;
    }
    createMutation.mutate({
      product_id: productId,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      title: title.trim() || undefined,
      caption: caption.trim() || undefined,
    });
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>Manajemen Iklan Produk</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '4px 0 0' }}>
            Promosikan produk Anda di carousel halaman utama PasarKita untuk meningkatkan penjualan.
          </p>
        </div>
        <button
          onClick={() => setShowBookingForm(!showBookingForm)}
          className="pk-btn pk-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="plus" size={16} />
          {showBookingForm ? 'Batal' : 'Booking Iklan'}
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', fontWeight: 500 }}>Total Booking Iklan</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{totalBookings}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', fontWeight: 500 }}>Iklan Aktif Saat Ini</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--pk-success)' }}>{activeAds}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', fontWeight: 500 }}>Total Pengeluaran Iklan</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{formatIDR(totalSpent)}</div>
        </div>
      </div>

      {/* Form Booking */}
      {showBookingForm && (
        <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>Booking Slot Iklan Baru</h2>
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pilih Produk</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                  required
                >
                  <option value="">-- Pilih Produk Aktif --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatIDR(p.price)} - Stok: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Penempatan (Placement)</label>
                <input
                  type="text"
                  value="Carousel Beranda (home_carousel)"
                  disabled
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14, background: '#f5f5f5', color: '#888' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Judul Iklan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Kemeja Terlaris"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Caption Iklan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Dapatkan diskon khusus minggu ini!"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            {duration > 0 && (
              <div style={{ background: '#f9f9f9', border: '1px solid var(--pk-border)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span>Durasi Penayangan:</span>
                  <span style={{ fontWeight: 600 }}>{duration} Hari</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span>Tarif Harian:</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pricePerDay)} / Hari</span>
                </div>
                <hr style={{ border: '0', borderTop: '1px solid var(--pk-border)', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                  <span>Estimasi Total Biaya:</span>
                  <span style={{ color: 'var(--pk-accent)' }}>{formatIDR(estimatedCost)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowBookingForm(false)}
                className="pk-btn"
                style={{ borderRadius: 8 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="pk-btn pk-btn-primary"
                style={{ borderRadius: 8 }}
              >
                {createMutation.isPending ? 'Membuat Booking...' : 'Buat Booking Iklan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ads List */}
      <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pk-border)', fontWeight: 600 }}>
          Daftar Iklan Anda
        </div>

        {adsLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
            Memuat daftar iklan...
          </div>
        ) : ads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)', fontSize: 14 }}>
            Belum ada iklan yang dibooking. Klik tombol &quot;Booking Iklan&quot; untuk memulai.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9f9f9', borderBottom: '1px solid var(--pk-border)' }}>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Informasi Iklan</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Periode</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Biaya</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Performa</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Pembayaran</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => {
                  const sDate = new Date(ad.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                  const eDate = new Date(ad.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                  
                  return (
                    <tr key={ad.id} style={{ borderBottom: '1px solid var(--pk-border)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600 }}>{ad.title || 'Sponsor'}</div>
                        <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>{ad.product_name}</div>
                        {ad.caption && (
                          <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', fontStyle: 'italic', marginTop: 4 }}>
                            &quot;{ad.caption}&quot;
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        {sDate} - {eDate}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 600 }}>
                        {formatIDR(ad.total_price)}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                          <div>Views: <span style={{ fontWeight: 600 }}>{ad.views_count}</span></div>
                          <div>Clicks: <span style={{ fontWeight: 600 }}>{ad.clicks_count}</span></div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500,
                            background: ad.payment_status === 'paid' ? '#e6f4ea' : '#fce8e6',
                            color: ad.payment_status === 'paid' ? '#137333' : '#c5221f',
                          }}
                        >
                          {ad.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500,
                            background: 
                              ad.status === 'active' ? '#e6f4ea' :
                              ad.status === 'scheduled' ? '#e8f0fe' :
                              ad.status === 'paused' ? '#fef7e0' :
                              ad.status === 'rejected' ? '#fce8e6' : '#f1f3f4',
                            color: 
                              ad.status === 'active' ? '#137333' :
                              ad.status === 'scheduled' ? '#1a73e8' :
                              ad.status === 'paused' ? '#b06000' :
                              ad.status === 'rejected' ? '#c5221f' : '#5f6368',
                          }}
                        >
                          {ad.status === 'active' ? 'Aktif' :
                           ad.status === 'scheduled' ? 'Terjadwal' :
                           ad.status === 'paused' ? 'Dijeda' :
                           ad.status === 'rejected' ? 'Ditolak' :
                           ad.status === 'completed' ? 'Selesai' : ad.status}
                        </span>
                        {ad.status === 'rejected' && ad.rejection_reason && (
                          <div style={{ fontSize: 11, color: '#c5221f', marginTop: 4, maxWidth: 180 }}>
                            Alasan: {ad.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {ad.payment_status === 'unpaid' && (
                          <button
                            onClick={() => payMutation.mutate(ad.id)}
                            disabled={payMutation.isPending}
                            className="pk-btn pk-btn-primary"
                            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                          >
                            Bayar (SmartBank)
                          </button>
                        )}
                        {(ad.status === 'active' || ad.status === 'scheduled') && (
                          <button
                            onClick={() => pauseMutation.mutate(ad.id)}
                            disabled={pauseMutation.isPending}
                            className="pk-btn"
                            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--pk-border)' }}
                          >
                            Jeda
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
