export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Detail Produk {params.id}</h1>
      <p className="text-gray-600">Info produk lengkap dan tombol tambah ke keranjang akan berada disini.</p>
    </div>
  );
}
