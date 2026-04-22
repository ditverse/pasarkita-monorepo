import Avatar from '@/components/pk/avatar';
import StatusBadge from '@/components/pk/status-badge';
import Icon from '@/components/pk/icon';

const USERS = [
  { name: 'Rani Kusuma', email: 'rani@email.com', role: 'Buyer', status: 'active', date: '12 Jan 2026' },
  { name: 'Warung Bu Sari', email: 'busari@umkm.id', role: 'Seller', status: 'active', date: '08 Feb 2025' },
  { name: 'Budi Hartono', email: 'budi.h@email.com', role: 'Buyer', status: 'banned', date: '04 Mar 2026' },
  { name: 'Kriya Bali', email: 'hello@kriyabali.id', role: 'Seller', status: 'active', date: '22 Nov 2024' },
  { name: 'Dian Pratama', email: 'dianp@email.com', role: 'Buyer', status: 'active', date: '01 Apr 2026' },
  { name: 'Toko Elektro ID', email: 'sales@elektro.id', role: 'Seller', status: 'inactive', date: '15 Sep 2025' },
  { name: 'Siti Nurhaliza', email: 'siti.n@email.com', role: 'Buyer', status: 'active', date: '10 Apr 2026' },
];

export default function AdminUsersPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Semua User</h1>
      <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: '0 0 28px' }}>
        {USERS.length} dari 48.219 user
      </p>

      <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pk-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pk-text-hint)' }} />
            <input className="pk-input" placeholder="Cari nama atau email..." style={{ height: 36, paddingLeft: 36, fontSize: 13 }} />
          </div>
          <select className="pk-select" style={{ width: 140, height: 36, fontSize: 13 }}>
            <option>Semua role</option><option>Buyer</option><option>Seller</option><option>Admin</option>
          </select>
          <select className="pk-select" style={{ width: 140, height: 36, fontSize: 13 }}>
            <option>Semua status</option><option>Active</option><option>Banned</option><option>Inactive</option>
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--pk-bg-subtle)' }}>
              {['Nama', 'Email', 'Role', 'Status', 'Tanggal Daftar', 'Aksi'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 5 ? 'right' : 'left',
                  padding: '10px 20px', fontSize: 12, fontWeight: 500,
                  color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.email} style={{ borderTop: '1px solid var(--pk-border)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.name} size={30} bg="#F3F4F6" color="#111827" />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>{u.email}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span className={`pk-badge ${u.role === 'Seller' ? 'pk-badge-blue' : 'pk-badge-neutral'}`}>{u.role}</span>
                </td>
                <td style={{ padding: '12px 20px' }}><StatusBadge status={u.status} /></td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--pk-text-secondary)' }}>{u.date}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  {u.status === 'banned'
                    ? <button className="pk-btn pk-btn-secondary pk-btn-sm">Aktifkan</button>
                    : <button className="pk-btn pk-btn-sm" style={{ color: 'var(--pk-danger)', border: '1px solid var(--pk-border)', background: '#fff' }}>Ban</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
