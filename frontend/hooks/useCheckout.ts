import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { checkoutApi } from '@/lib/api/checkout';
import { promotionsApi } from '@/lib/api/promotions';
import { productsApi } from '@/lib/api/products';
import { ordersApi } from '@/lib/api/orders';
import { calculateWeeklySpending, getWeeklyBudget } from '@/lib/buyer-budget';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Order, Product } from '@/types/api';

export function useCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const productId = searchParams.get('productId');
  const qtyUrl = Math.max(1, parseInt(searchParams.get('qty') || '1'));

  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [marketplaceVoucherCode, setMarketplaceVoucherCode] = useState('');
  const [sellerVoucherCodesText, setSellerVoucherCodesText] = useState('');
  const idempotencyKeyRef = useRef<string | null>(null);
  const weeklyBudget = user ? getWeeklyBudget(user.id) : null;

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

  const weeklyOrdersQuery = useQuery({
    queryKey: ['orders', 'buyer-budget', user?.id],
    queryFn: async (): Promise<Order[]> => {
      const response = await ordersApi.getAll({ limit: 100, sort: 'created_desc' });
      return response.data.data;
    },
    enabled: Boolean(user && weeklyBudget),
  });

  const quoteQuery = useQuery({
    queryKey: ['promotions', 'quote', productId, qtyUrl, marketplaceVoucherCode, sellerVoucherCodesText],
    queryFn: async () => {
      const response = await promotionsApi.quote({
        items: [{ product_id: productId as string, qty: qtyUrl }],
        marketplace_voucher_code: marketplaceVoucherCode.trim() || undefined,
        seller_voucher_codes: sellerVoucherCodesText
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      });
      return response.data.data;
    },
    enabled: Boolean(productId && productQuery.data),
  });

  const product = productQuery.data ?? null;
  const balance = balanceQuery.data ?? null;
  const quote = quoteQuery.data;

  const unitPrice = product ? (product.effective_price ?? product.price) : 0;
  const originalUnitPrice = product ? (product.original_price ?? product.price) : 0;
  const subtotal = quote?.subtotal_after_product_discount ?? unitPrice * qtyUrl;
  const subtotalOriginal = quote?.subtotal_original ?? originalUnitPrice * qtyUrl;
  const productDiscountTotal = quote?.product_discount_total ?? Math.max(0, (originalUnitPrice - unitPrice) * qtyUrl);
  const feeMarketplace = quote?.fee_marketplace ?? Math.round(subtotal * 0.02);
  const feeMarketplaceBase = quote?.fee_marketplace_base ?? feeMarketplace;
  const feeDiscount = quote?.fee_discount ?? 0;
  const voucherDiscountTotal = quote?.voucher_discount_total ?? 0;
  const total = quote?.total ?? subtotal + feeMarketplace;
  const weeklySpending = calculateWeeklySpending(weeklyOrdersQuery.data ?? []);
  const projectedSpending = weeklySpending + total;
  const projectedRemaining = weeklyBudget == null ? null : weeklyBudget - projectedSpending;

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
    if (quoteQuery.isFetching) {
      toast.error('Tunggu kalkulasi promo selesai');
      return;
    }
    if (!window.confirm(`Bayar untuk ${qtyUrl} barang melalui SmartBank?`)) {
      return;
    }

    setLoading(true);
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const res = await checkoutApi.checkout({
        idempotency_key: idempotencyKeyRef.current,
        items: [{ product_id: product?.id as string, qty: qtyUrl }],
        shipping_address: address.trim(),
        marketplace_voucher_code: marketplaceVoucherCode.trim() || undefined,
        seller_voucher_codes: sellerVoucherCodesText
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      });
      const orderId = res.data.data?.order_id;
      if (res.data.data?.idempotent_replay && res.data.data.status === 'pending') {
        toast.info('Checkout yang sama sedang diproses');
        router.push(`/orders/${orderId}`);
      } else if (res.data.data?.idempotent_replay && res.data.data.status === 'payment_failed') {
        toast.error('Checkout sebelumnya gagal diproses');
        router.push('/checkout/failed');
      } else {
        toast.success(res.data.data?.idempotent_replay ? 'Checkout sebelumnya ditemukan' : 'Checkout berhasil!');
        router.push(`/checkout/success?orderId=${orderId}`);
      }
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

  return {
    router,
    user,
    productId,
    qtyUrl,
    loading,
    address,
    setAddress,
    marketplaceVoucherCode,
    setMarketplaceVoucherCode,
    sellerVoucherCodesText,
    setSellerVoucherCodesText,
    weeklyBudget,
    productQuery,
    balanceQuery,
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
    feeMarketplace,
    feeMarketplaceBase,
    feeDiscount,
    voucherDiscountTotal,
    total,
    weeklySpending,
    projectedSpending,
    projectedRemaining,
    handlePay,
  };
}
