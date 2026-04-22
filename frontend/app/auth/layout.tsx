import Logo from '@/components/pk/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pk"
      style={{
        minHeight: '100vh',
        background: 'var(--pk-bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      <div className="pk-card" style={{ width: 400, padding: 40, background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
