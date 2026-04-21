export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <aside className="w-64 bg-gray-800 p-4 border-r border-gray-700">
        <div className="font-bold text-xl mb-8 text-white">Admin Panel</div>
        <nav className="space-y-2 text-sm text-gray-300">
          <a href="/admin" className="block p-2 rounded-md bg-gray-700 font-medium text-white">Dashboard</a>
          <a href="/admin/users" className="block p-2 rounded-md hover:bg-gray-700">Users</a>
          <a href="/" className="block p-2 rounded-md hover:bg-gray-700 mt-8">Exit Admin</a>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8 bg-gray-900">
        {children}
      </main>
    </div>
  );
}
