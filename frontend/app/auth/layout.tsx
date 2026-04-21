export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 border border-gray-200 rounded-xl shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">PasarKita</h1>
          <p className="text-sm text-gray-500 mt-2">Selamat datang kembali</p>
        </div>
        {children}
      </div>
    </div>
  );
}
