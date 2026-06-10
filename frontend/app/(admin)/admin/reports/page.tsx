'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Icon from '@/components/pk/icon';
import { adminApi } from '@/lib/api/admin';
import { getApiErrorMessage } from '@/lib/api-error';
import { AdminReportPreview } from '@/types/api';
import { toast } from 'sonner';

const REPORTS = [
  { value: 'orders', label: 'Order', description: 'Transaksi, buyer tersamarkan, payment, dan shipping ID.' },
  { value: 'users', label: 'Semua User', description: 'Profil dasar tanpa password dan email telah dimasking.' },
  { value: 'sellers', label: 'Seller', description: 'Daftar akun seller dan status operasional.' },
  { value: 'products', label: 'Produk', description: 'Katalog, seller, harga, stok, dan status listing.' },
  { value: 'analytics', label: 'Ringkasan Analytics', description: 'Metrik operasional pada periode terpilih.' },
] as const;
type ReportType = (typeof REPORTS)[number]['value'];

export default function AdminReportsPage() {
  const [type, setType] = useState<ReportType>('orders');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [stock, setStock] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d');
  const [preview, setPreview] = useState<AdminReportPreview | null>(null);

  const reportParams = (): Record<string, string | undefined> => ({
    type,
    search: search || undefined,
    status: status || undefined,
    role: role || undefined,
    stock: stock || undefined,
    start: start || undefined,
    end: end || undefined,
    period: type === 'analytics' && !start && !end ? period : undefined,
  });

  const previewMutation = useMutation({
    mutationFn: async () => (await adminApi.previewReport(reportParams())).data.data,
    onSuccess: setPreview,
    onError: (error) => toast.error(getApiErrorMessage(error, 'Preview laporan gagal dibuat')),
  });

  const exportMutation = useMutation({
    mutationFn: async () => adminApi.exportReport(reportParams()),
    onSuccess: (response) => {
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `pasarkita-${type}.csv`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`${filename} berhasil diunduh`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Ekspor CSV gagal')),
  });

  const changeType = (nextType: ReportType) => {
    setType(nextType);
    setSearch('');
    setStatus('');
    setRole('');
    setStock('');
    setStart('');
    setEnd('');
    setPreview(null);
  };

  const selected = REPORTS.find((report) => report.value === type)!;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Laporan dan Ekspor</h1>
        <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
          Preview hasil filter sebelum mengunduh CSV yang aman untuk dibagikan
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div className="pk-card" style={{ background: '#fff', padding: 10 }}>
          {REPORTS.map((report) => (
            <button
              key={report.value}
              onClick={() => changeType(report.value)}
              style={{
                width: '100%',
                padding: 12,
                textAlign: 'left',
                border: 'none',
                borderRadius: 8,
                background: type === report.value ? 'var(--pk-bg-subtle)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <strong style={{ display: 'block', fontSize: 13 }}>{report.label}</strong>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11, lineHeight: 1.45, color: 'var(--pk-text-hint)' }}>{report.description}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="pk-card" style={{ background: '#fff', padding: 22, marginBottom: 18 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>Ekspor {selected.label}</h2>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--pk-text-secondary)' }}>{selected.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {type !== 'analytics' && (
                <Field label="Pencarian">
                  <input className="pk-input" placeholder={type === 'products' ? 'Produk atau seller...' : 'Nama, email, atau ID...'} value={search} onChange={(event) => { setSearch(event.target.value); setPreview(null); }} />
                </Field>
              )}
              {type === 'users' && (
                <Field label="Role">
                  <select className="pk-select" value={role} onChange={(event) => { setRole(event.target.value); setPreview(null); }}>
                    <option value="">Semua role</option><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="superadmin">Admin</option>
                  </select>
                </Field>
              )}
              {type !== 'analytics' && (
                <Field label="Status">
                  <select className="pk-select" value={status} onChange={(event) => { setStatus(event.target.value); setPreview(null); }}>
                    <option value="">Semua status</option>
                    {type === 'orders' ? (
                      <><option value="pending">Pending</option><option value="paid">Paid</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="payment_failed">Payment failed</option></>
                    ) : (
                      <><option value="active">Aktif</option><option value="inactive">Nonaktif</option></>
                    )}
                  </select>
                </Field>
              )}
              {type === 'products' && (
                <Field label="Kondisi stok">
                  <select className="pk-select" value={stock} onChange={(event) => { setStock(event.target.value); setPreview(null); }}>
                    <option value="">Semua stok</option><option value="low">Stok kritis</option><option value="empty">Stok habis</option>
                  </select>
                </Field>
              )}
              {type === 'analytics' && !start && !end && (
                <Field label="Preset periode">
                  <select className="pk-select" value={period} onChange={(event) => { setPeriod(event.target.value as typeof period); setPreview(null); }}>
                    <option value="today">Hari ini</option><option value="7d">7 hari</option><option value="30d">30 hari</option>
                  </select>
                </Field>
              )}
              <Field label="Tanggal mulai">
                <input className="pk-input" type="date" value={start} max={end || undefined} onChange={(event) => { setStart(event.target.value); setPreview(null); }} />
              </Field>
              <Field label="Tanggal akhir">
                <input className="pk-input" type="date" value={end} min={start || undefined} onChange={(event) => { setEnd(event.target.value); setPreview(null); }} />
              </Field>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="pk-btn pk-btn-secondary" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                {previewMutation.isPending ? 'Menghitung...' : 'Preview Data'}
              </button>
              <button className="pk-btn pk-btn-primary" disabled={!preview || preview.row_count === 0 || exportMutation.isPending} onClick={() => exportMutation.mutate()}>
                <Icon name={exportMutation.isPending ? 'loader' : 'arrowRight'} size={14} />
                {exportMutation.isPending ? 'Menyiapkan...' : 'Unduh CSV'}
              </button>
            </div>
          </div>

          <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}>
              <strong>Preview</strong>
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--pk-text-hint)' }}>
                {!preview ? 'Pilih filter lalu klik Preview Data.' : `${preview.row_count.toLocaleString('id-ID')} baris akan diekspor${preview.truncated ? ' (dibatasi 5.000 baris)' : ''}.`}
              </div>
            </div>
            {!preview ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Belum ada preview.</div>
            ) : preview.row_count === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Tidak ada data sesuai filter.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{preview.columns.map((column) => <th key={column} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, color: 'var(--pk-text-hint)' }}>{column}</th>)}</tr></thead>
                  <tbody>{preview.sample.map((row, index) => <tr key={index} style={{ borderTop: '1px solid var(--pk-border)' }}>{Object.values(row).map((value, cellIndex) => <td key={cellIndex} style={{ padding: '10px 14px', fontSize: 11, whiteSpace: 'nowrap' }}>{String(value ?? '')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="pk-label">{label}</span>{children}</label>;
}
