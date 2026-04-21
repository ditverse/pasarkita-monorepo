export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="text-center py-12 md:py-24 bg-gray-100 rounded-xl px-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">Temukan Barang Impian Anda</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">Marketplace yang menghubungkan penjual tepercaya dengan pembeli cerdas dalam satu ekosistem.</p>
        <div className="max-w-md mx-auto flex gap-2">
          <input type="text" placeholder="Cari produk..." className="flex-1 h-12 px-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <button className="h-12 px-6 bg-black text-white rounded-md font-medium hover:bg-gray-800">Cari</button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Produk Terbaru</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Skeleton Product Cards */}
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
              <div className="bg-gray-100 aspect-square rounded-md mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-6 bg-black rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
