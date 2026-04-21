export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">PasarKita</div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <a href="/" className="hover:text-black">Browse</a>
            <a href="/orders" className="hover:text-black">Pesanan Saya</a>
            <a href="/seller/products" className="hover:text-black">Jual Produk</a>
          </nav>
          <div>
            <a href="/auth/login" className="bg-black text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-800">Masuk</a>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} PasarKita Marketplace. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
