import { api } from '../api';
import { ApiResponse, HomeAdItem, ProductAd, MarketplaceBanner } from '@/types/api';

export type AdPayload = {
  product_id: string;
  start_date: string;
  end_date: string;
  title?: string;
  caption?: string;
};

export type BannerPayload = {
  title: string;
  subtitle?: string;
  image_url: string;
  target_url?: string;
  placement?: string;
  start_time: string;
  end_time: string;
  sort_order?: number;
  is_active?: boolean;
};

export type ModerateAdPayload = {
  status: 'active' | 'paused' | 'rejected';
  reason?: string;
};

export const adsApi = {
  // Public
  getHomeCarousel: () =>
    api.get<ApiResponse<HomeAdItem[]>>('/ads/home-carousel'),

  recordView: (id: string) =>
    api.post<ApiResponse<{ success: boolean }>>(`/ads/${id}/view`),

  recordClick: (id: string) =>
    api.post<ApiResponse<{ success: boolean }>>(`/ads/${id}/click`),

  // Seller
  getSellerAds: () =>
    api.get<ApiResponse<ProductAd[]>>('/seller/ads'),

  createSellerAd: (body: AdPayload) =>
    api.post<ApiResponse<ProductAd>>('/seller/ads', body),

  paySellerAd: (id: string) =>
    api.post<ApiResponse<ProductAd>>(`/seller/ads/${id}/pay`),

  pauseSellerAd: (id: string) =>
    api.patch<ApiResponse<ProductAd>>(`/seller/ads/${id}/pause`),

  // Admin
  getAdminAds: () =>
    api.get<ApiResponse<ProductAd[]>>('/admin/ads'),

  moderateSellerAd: (id: string, body: ModerateAdPayload) =>
    api.patch<ApiResponse<ProductAd>>(`/admin/ads/${id}/status`, body),

  getBanners: () =>
    api.get<ApiResponse<MarketplaceBanner[]>>('/admin/banners'),

  createBanner: (body: BannerPayload) =>
    api.post<ApiResponse<MarketplaceBanner>>('/admin/banners', body),

  updateBanner: (id: string, body: Partial<BannerPayload>) =>
    api.patch<ApiResponse<MarketplaceBanner>>(`/admin/banners/${id}`, body),

  deleteBanner: (id: string) =>
    api.delete<ApiResponse<{ success: boolean }>>(`/admin/banners/${id}`),
};
