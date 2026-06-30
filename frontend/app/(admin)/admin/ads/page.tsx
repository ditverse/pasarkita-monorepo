'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import { formatIDR } from '@/lib/format';
import { adsApi } from '@/lib/api/ads';
import { getApiErrorMessage } from '@/lib/api-error';

export default function AdminAdsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'seller_ads' | 'marketplace_banners'>('seller_ads');

  // Moderation state
  const [modAdId, setModAdId] = useState<string | null>(null);
  const [modStatus, setModStatus] = useState<'active' | 'paused' | 'rejected' | null>(null);
  const [modReason, setModReason] = useState('');

  // Banner form state
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerTargetUrl, setBannerTargetUrl] = useState('');
  const [bannerStartTime, setBannerStartTime] = useState('');
  const [bannerEndTime, setBannerEndTime] = useState('');
  const [bannerSortOrder, setBannerSortOrder] = useState('0');
  const [bannerIsActive, setBannerIsActive] = useState(true);
  const [showBannerForm, setShowBannerForm] = useState(false);

  // Queries
  const { data: ads = [], isLoading: adsLoading } = useQuery({
    queryKey: ['admin', 'ads'],
    queryFn: async () => {
      const res = await adsApi.getAdminAds();
      return res.data.data ?? [];
    },
  });

  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: async () => {
      const res = await adsApi.getBanners();
      return res.data.data ?? [];
    },
  });

  // Mutations
  const moderateMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'active' | 'paused' | 'rejected'; reason?: string }) =>
      adsApi.moderateSellerAd(id, { status, reason }),
    onSuccess: () => {
      toast.success('Status iklan berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin', 'ads'] });
      // Reset state
      setModAdId(null);
      setModStatus(null);
      setModReason('');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal memoderasi iklan'));
    },
  });

  const createBannerMutation = useMutation({
    mutationFn: adsApi.createBanner,
    onSuccess: () => {
      toast.success('Banner baru berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      resetBannerForm();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal membuat banner'));
    },
  });

  const updateBannerMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adsApi.updateBanner>[1] }) =>
      adsApi.updateBanner(id, body),
    onSuccess: () => {
      toast.success('Banner berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      resetBannerForm();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal memperbarui banner'));
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: adsApi.deleteBanner,
    onSuccess: () => {
      toast.success('Banner berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gagal menghapus banner'));
    },
  });

  const resetBannerForm = () => {
    setEditingBannerId(null);
    setBannerTitle('');
    setBannerSubtitle('');
    setBannerImageUrl('');
    setBannerTargetUrl('');
    setBannerStartTime('');
    setBannerEndTime('');
    setBannerSortOrder('0');
    setBannerIsActive(true);
    setShowBannerForm(false);
  };

  const handleBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle || !bannerImageUrl || !bannerStartTime || !bannerEndTime) {
      toast.error('Harap isi field utama');
      return;
    }

    const payload = {
      title: bannerTitle,
      subtitle: bannerSubtitle || undefined,
      image_url: bannerImageUrl,
      target_url: bannerTargetUrl || undefined,
      start_time: new Date(bannerStartTime).toISOString(),
      end_time: new Date(bannerEndTime).toISOString(),
      sort_order: parseInt(bannerSortOrder) || 0,
      is_active: bannerIsActive,
      placement: 'home_carousel',
    };

    if (editingBannerId) {
      updateBannerMutation.mutate({ id: editingBannerId, body: payload });
    } else {
      createBannerMutation.mutate(payload);
    }
  };

  const handleEditBanner = (b: typeof banners[number]) => {
    setEditingBannerId(b.id);
    setBannerTitle(b.title);
    setBannerSubtitle(b.subtitle || '');
    setBannerImageUrl(b.image_url);
    setBannerTargetUrl(b.target_url || '');
    // format to date-local inputs
    setBannerStartTime(new Date(b.start_time).toISOString().slice(0, 16));
    setBannerEndTime(new Date(b.end_time).toISOString().slice(0, 16));
    setBannerSortOrder(b.sort_order.toString());
    setBannerIsActive(b.is_active);
    setShowBannerForm(true);
  };

  const handleModerationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modAdId || !modStatus) return;
    if ((modStatus === 'rejected' || modStatus === 'paused') && !modReason) {
      toast.error('Alasan penolakan/penjeda iklan wajib diisi');
      return;
    }
    moderateMutation.mutate({ id: modAdId, status: modStatus, reason: modReason });
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>Manajemen Promosi & Iklan</h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '4px 0 0' }}>
            Moderasi iklan produk berbayar dari penjual atau kelola banner promosi global marketplace.
          </p>
        </div>
        {activeTab === 'marketplace_banners' && (
          <button
            onClick={() => {
              if (showBannerForm) resetBannerForm();
              else setShowBannerForm(true);
            }}
            className="pk-btn pk-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={16} />
            {showBannerForm ? 'Batal' : 'Tambah Banner'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--pk-border)', gap: 24, marginBottom: 28 }}>
        <button
          onClick={() => { setActiveTab('seller_ads'); resetBannerForm(); }}
          style={{
            padding: '12px 4px',
            fontSize: 15,
            fontWeight: activeTab === 'seller_ads' ? 600 : 500,
            color: activeTab === 'seller_ads' ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'seller_ads' ? '2px solid var(--pk-text)' : 'none',
            background: 'transparent',
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          Iklan Produk Seller
        </button>
        <button
          onClick={() => { setActiveTab('marketplace_banners'); resetBannerForm(); }}
          style={{
            padding: '12px 4px',
            fontSize: 15,
            fontWeight: activeTab === 'marketplace_banners' ? 600 : 500,
            color: activeTab === 'marketplace_banners' ? 'var(--pk-text)' : 'var(--pk-text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'marketplace_banners' ? '2px solid var(--pk-text)' : 'none',
            background: 'transparent',
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          Banner Marketplace
        </button>
      </div>

      {/* Seller Ads Tab */}
      {activeTab === 'seller_ads' && (
        <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, overflow: 'hidden' }}>
          {adsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
              Memuat data iklan...
            </div>
          ) : ads.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
              Belum ada data iklan seller.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9f9f9', borderBottom: '1px solid var(--pk-border)' }}>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Toko & Produk</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Judul / Caption</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Periode</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Biaya</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Performa</th>
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
                          <div style={{ fontWeight: 600 }}>{ad.seller_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 2 }}>{ad.seller_email}</div>
                          <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 4 }}>
                            Produk: <span style={{ fontWeight: 600 }}>{ad.product_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 600 }}>{ad.title || '-'}</div>
                          {ad.caption && (
                            <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                              &quot;{ad.caption}&quot;
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                          {sDate} - {eDate}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 600 }}>{formatIDR(ad.total_price)}</div>
                          <div style={{ fontSize: 12, color: ad.payment_status === 'paid' ? 'var(--pk-success)' : 'var(--pk-danger)' }}>
                            {ad.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                          </div>
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
                            <div style={{ fontSize: 11, color: '#c5221f', marginTop: 4 }}>
                              Alasan: {ad.rejection_reason}
                            </div>
                          )}
                          {ad.status === 'paused' && ad.paused_reason && (
                            <div style={{ fontSize: 11, color: '#b06000', marginTop: 4 }}>
                              Alasan: {ad.paused_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {ad.status !== 'active' && ad.payment_status === 'paid' && (
                              <button
                                onClick={() => moderateMutation.mutate({ id: ad.id, status: 'active' })}
                                className="pk-btn pk-btn-primary"
                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                              >
                                Aktifkan
                              </button>
                            )}
                            {ad.status !== 'paused' && ad.status !== 'completed' && ad.status !== 'rejected' && (
                              <button
                                onClick={() => { setModAdId(ad.id); setModStatus('paused'); }}
                                className="pk-btn"
                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--pk-border)' }}
                              >
                                Jeda
                              </button>
                            )}
                            {ad.status !== 'rejected' && ad.status !== 'completed' && (
                              <button
                                onClick={() => { setModAdId(ad.id); setModStatus('rejected'); }}
                                className="pk-btn"
                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--pk-border)', color: 'var(--pk-danger)' }}
                              >
                                Tolak
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Banners Tab */}
      {activeTab === 'marketplace_banners' && (
        <div>
          {/* Banner Form */}
          {showBannerForm && (
            <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>
                {editingBannerId ? 'Edit Banner Marketplace' : 'Tambah Banner Baru'}
              </h2>
              <form onSubmit={handleBannerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Judul Banner</label>
                    <input
                      type="text"
                      placeholder="Contoh: Gebyar Diskon Akhir Tahun"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Subtitle Banner</label>
                    <input
                      type="text"
                      placeholder="Contoh: Diskon Hingga 70% All Item"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>URL Gambar Banner</label>
                    <input
                      type="url"
                      placeholder="Contoh: https://example.com/banner.png"
                      value={bannerImageUrl}
                      onChange={(e) => setBannerImageUrl(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>URL Target Arah Klik (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: /products atau /stores/uuid-seller"
                      value={bannerTargetUrl}
                      onChange={(e) => setBannerTargetUrl(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tanggal & Jam Mulai</label>
                    <input
                      type="datetime-local"
                      value={bannerStartTime}
                      onChange={(e) => setBannerStartTime(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tanggal & Jam Selesai</label>
                    <input
                      type="datetime-local"
                      value={bannerEndTime}
                      onChange={(e) => setBannerEndTime(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Urutan Tampil (Sort Order)</label>
                    <input
                      type="number"
                      value={bannerSortOrder}
                      onChange={(e) => setBannerSortOrder(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: 24 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bannerIsActive}
                        onChange={(e) => setBannerIsActive(e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                      Banner Aktif (Is Active)
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={resetBannerForm}
                    className="pk-btn"
                    style={{ borderRadius: 8 }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createBannerMutation.isPending || updateBannerMutation.isPending}
                    className="pk-btn pk-btn-primary"
                    style={{ borderRadius: 8 }}
                  >
                    {createBannerMutation.isPending || updateBannerMutation.isPending ? 'Menyimpan...' : 'Simpan Banner'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Banners List */}
          <div style={{ background: '#fff', border: '1px solid var(--pk-border)', borderRadius: 12, overflow: 'hidden' }}>
            {bannersLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
                Memuat data banner...
              </div>
            ) : banners.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-secondary)' }}>
                 Belum ada banner promosi. Klik &quot;Tambah Banner&quot; untuk memulai.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f9f9f9', borderBottom: '1px solid var(--pk-border)' }}>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Visual Preview</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Judul / Target</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Periode Penayangan</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Sort</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Performa</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 24px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((b) => {
                      const sDate = new Date(b.start_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                      const eDate = new Date(b.end_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--pk-border)' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ width: 100, height: 60, overflow: 'hidden', borderRadius: 6, border: '1px solid var(--pk-border)' }}>
                              <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 600 }}>{b.title}</div>
                            {b.subtitle && <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 2 }}>{b.subtitle}</div>}
                            <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', marginTop: 4 }}>Target: {b.target_url || '-'}</div>
                          </td>
                          <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                            <div>{sDate}</div>
                            <div style={{ color: 'var(--pk-text-hint)' }}>s.d {eDate}</div>
                          </td>
                          <td style={{ padding: '16px 24px', fontWeight: 600 }}>
                            {b.sort_order}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                              <div>Views: <span style={{ fontWeight: 600 }}>{b.views_count}</span></div>
                              <div>Clicks: <span style={{ fontWeight: 600 }}>{b.clicks_count}</span></div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span
                              onClick={() => {
                                updateBannerMutation.mutate({ id: b.id, body: { is_active: !b.is_active } });
                              }}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 500,
                                background: b.is_active ? '#e6f4ea' : '#f1f3f4',
                                color: b.is_active ? '#137333' : '#5f6368',
                                cursor: 'pointer',
                              }}
                            >
                              {b.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleEditBanner(b)}
                                className="pk-btn"
                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--pk-border)' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Hapus banner ini secara permanen?')) {
                                    deleteBannerMutation.mutate(b.id);
                                  }
                                }}
                                className="pk-btn"
                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--pk-border)', color: 'var(--pk-danger)' }}
                              >
                                Hapus
                              </button>
                            </div>
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
      )}

      {/* Moderation Reason Dialog (Simple modal overlay using Vanilla React state) */}
      {modAdId && modStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--pk-border)', width: '100%', maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
              {modStatus === 'rejected' ? 'Tolak Iklan Seller' : 'Jeda Iklan Seller'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', marginBottom: 20 }}>
              Berikan alasan kenapa iklan ini {modStatus === 'rejected' ? 'ditolak' : 'dijeda'} agar seller mengetahuinya.
            </p>
            <form onSubmit={handleModerationSubmit}>
              <textarea
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Tulis alasan di sini..."
                rows={4}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--pk-border)', borderRadius: 8, fontSize: 14, resize: 'none', marginBottom: 20 }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => { setModAdId(null); setModStatus(null); setModReason(''); }}
                  className="pk-btn"
                  style={{ borderRadius: 8 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={moderateMutation.isPending}
                  className="pk-btn pk-btn-primary"
                  style={{ borderRadius: 8, background: modStatus === 'rejected' ? 'var(--pk-danger)' : 'var(--pk-text)' }}
                >
                  {moderateMutation.isPending ? 'Menyimpan...' : modStatus === 'rejected' ? 'Ya, Tolak' : 'Ya, Jeda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
