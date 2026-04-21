export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="font-bold text-xl mb-8">Toko Baru</div>
        <nav className="space-y-2 text-sm">
          <a href="/seller/products" className="block p-2 rounded-md bg-gray-100 font-medium">Produk Saya</a>
          <a href="/" className="block p-2 rounded-md hover:bg-gray-50 text-gray-600">Kembali ke Home</a>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
