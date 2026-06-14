'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import SellerProductForm, { SellerProductFormValues } from '@/components/pk/seller-product-form';
import { productsApi } from '@/lib/api/products';

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<{
    values: SellerProductFormValues;
    imageUrl: string | null;
  } | null>(null);

  useEffect(() => {
    productsApi.getMineById(id)
      .then((response) => {
        const item = response.data.data;
        setProduct({
          values: {
            name: item.name ?? '',
            description: item.description ?? '',
            category: item.category ?? '',
            price: String(item.price ?? ''),
            stock: String(item.stock ?? ''),
            minimumStock: String(item.minimum_stock ?? 5),
          },
          imageUrl: item.image_url ?? null,
        });
      })
      .catch(() => {
        toast.error('Gagal mengambil data produk');
        router.replace('/seller/products');
      });
  }, [id, router]);

  if (!product) {
    return <div style={{ padding: 40, color: 'var(--pk-text-hint)' }}>Memuat data produk...</div>;
  }

  return (
    <SellerProductForm
      mode="edit"
      productId={id}
      initialValues={product.values}
      initialImageUrl={product.imageUrl}
    />
  );
}
