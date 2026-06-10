'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { formatIDR } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

export default function AdminFeeSimulatorPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom'>('30d');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [rate, setRate] = useState(3);
  const simulatorQuery = useQuery({
    queryKey: queryKeys.admin.feeSimulator(period, rate, start, end),
    queryFn: async () => (await adminApi.simulateFeeImpact({
      period: period === 'custom' ? undefined : period,
      start: period === 'custom' ? start || undefined : undefined,
      end: period === 'custom' ? end || undefined : undefined,
      rate,
    })).data.data,
    enabled: period !== 'custom' || Boolean(start && end),
  });

  const data = simulatorQuery.data;
  const scenario = data?.selected_scenario;
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Simulator Dampak Fee</h1>
        <p style={{ margin: 0, color: 'var(--pk-text-secondary)' }}>Simulasi historis tanpa mengubah fee produksi 2%</p>
      </div>

      <div className="pk-card" style={{ background: '#fff', padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, alignItems: 'end' }}>
          <label><span className="pk-label">Periode</span><select className="pk-select" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option value="today">Hari ini</option><option value="7d">7 hari</option><option value="30d">30 hari</option><option value="custom">Custom</option></select></label>
          {period === 'custom' && <><label><span className="pk-label">Tanggal mulai</span><input className="pk-input" type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} /></label><label><span className="pk-label">Tanggal akhir</span><input className="pk-input" type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label></>}
          <label><span className="pk-label">Fee simulasi: {rate.toFixed(1)}%</span><input type="range" min="0" max="10" step="0.5" value={rate} onChange={(event) => setRate(Number(event.target.value))} style={{ width: '100%', accentColor: 'var(--pk-accent)' }} /></label>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--pk-text-hint)' }}>Rentang yang diizinkan 0–10%. Nilai ini hanya untuk simulasi.</div>
      </div>

      {simulatorQuery.isLoading && <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>Menghitung simulasi...</div>}
      {simulatorQuery.isError && <div className="pk-card" role="alert" style={{ padding: 22 }}>Simulasi gagal dimuat.</div>}
      {data && scenario && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
            <Metric label="Paid order historis" value={data.baseline.paid_orders.toLocaleString('id-ID')} />
            <Metric label="Revenue aktual 2%" value={formatIDR(data.baseline.actual_revenue)} />
            <Metric label={`Revenue simulasi ${rate}%`} value={formatIDR(scenario.revenue)} />
            <Metric label="Selisih revenue" value={`${scenario.revenue_difference >= 0 ? '+' : ''}${formatIDR(scenario.revenue_difference)}`} color={scenario.revenue_difference >= 0 ? 'var(--pk-success)' : 'var(--pk-danger)'} />
            <Metric label="Rata-rata fee/order" value={formatIDR(scenario.average_fee_per_order)} />
            <Metric label="Rata-rata total buyer" value={formatIDR(scenario.average_buyer_total)} />
          </div>

          <div className="pk-card" style={{ background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}><strong>Perbandingan Skenario</strong></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'var(--pk-bg-subtle)' }}>{['Fee', 'Revenue', 'Selisih Aktual', 'Fee/Order', 'Total Buyer'].map((header) => <th key={header} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: 'var(--pk-text-hint)' }}>{header}</th>)}</tr></thead>
                <tbody>{data.scenarios.map((item) => <tr key={item.rate} style={{ borderTop: '1px solid var(--pk-border)', background: item.rate === rate ? 'var(--pk-accent-soft)' : undefined }}><td style={{ padding: '12px 20px', fontWeight: 700 }}>{item.rate}%</td><td style={{ padding: '12px 20px' }}>{formatIDR(item.revenue)}</td><td style={{ padding: '12px 20px', color: item.revenue_difference >= 0 ? 'var(--pk-success)' : 'var(--pk-danger)' }}>{item.revenue_difference >= 0 ? '+' : ''}{formatIDR(item.revenue_difference)}</td><td style={{ padding: '12px 20px' }}>{formatIDR(item.average_fee_per_order)}</td><td style={{ padding: '12px 20px' }}>{formatIDR(item.buyer_total)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--pk-warning-soft)', color: 'var(--pk-warning)', fontSize: 12 }}>{data.disclaimer}</div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="pk-card" style={{ background: '#fff', padding: 18 }}><div style={{ fontSize: 11, color: 'var(--pk-text-hint)', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 8, fontSize: 21, fontWeight: 700, color }}>{value}</div></div>;
}
