import { NavbarDesktop } from '@/components/pk/navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pk" style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
      <NavbarDesktop />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <footer style={{ borderTop: '1px solid var(--pk-border)', padding: '32px 80px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--pk-text-hint)' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <span>© {new Date().getFullYear()} PasarKita</span>
          <a style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>Tentang</a>
          <a style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>Bantuan</a>
          <a style={{ color: 'var(--pk-text-secondary)', cursor: 'pointer' }}>Kebijakan</a>
        </div>
        <div>Made in Indonesia · Powered by SmartBank</div>
      </footer>
    </div>
  );
}
