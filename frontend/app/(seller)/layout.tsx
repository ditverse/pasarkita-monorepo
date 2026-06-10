import SellerSidebar from '@/components/pk/seller-sidebar';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pk" style={{ display: 'flex', minHeight: '100vh', background: 'var(--pk-bg-subtle)' }}>
      <SellerSidebar />
      <main style={{ flex: 1, padding: '32px clamp(16px, 3vw, 40px)', overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
