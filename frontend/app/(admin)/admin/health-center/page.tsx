'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';

const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
] as const;

export default function AdminHealthCenterPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d');
  const healthQuery = useQuery({
    queryKey: queryKeys.admin.health(period),
    queryFn: async () => (await adminApi.getAnalytics({ period })).data.data,
  });
  const data = healthQuery.data;
  const health = data?.marketplace_health;
  const colors = { healthy: '#16A34A', attention: '#D97706', critical: '#DC2626' };
  const anomalyColors = { high: '#DC2626', medium: '#D97706', low: '#2563EB' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Marketplace Health Center</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--pk-text-secondary)' }}>
            Skor transparan dan deteksi anomali berbasis aturan
          </p>
        </div>
        <select className="pk-select" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} style={{ width: 140 }}>
          {PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {healthQuery.isError && (
        <div className="pk-card" role="alert" style={{ padding: 20 }}>
          Health Center gagal dimuat. <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => healthQuery.refetch()}>Coba Lagi</button>
        </div>
      )}

      {healthQuery.isLoading || !health ? (
        <div className="pk-card" style={{ padding: 36, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Menghitung kesehatan marketplace...</div>
      ) : (
        <>
          <div className="pk-card" style={{ background: '#fff', padding: 24, marginBottom: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: 28, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 150, height: 150, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center', background: `conic-gradient(${colors[health.status]} ${health.score}%, #E5E7EB 0)` }}>
                  <div style={{ width: 116, height: 116, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
                    <div><div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>{health.score}</div><div style={{ marginTop: 4, fontSize: 11, color: 'var(--pk-text-hint)' }}>dari 100</div></div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontWeight: 700, color: colors[health.status], textTransform: 'capitalize' }}>{health.status}</div>
              </div>
              <div>
                <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Bagaimana skor dihitung?</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--pk-text-secondary)', fontSize: 13 }}>{health.formula}</p>
                {health.data_notes.map((note) => (
                  <div key={note} style={{ padding: '8px 10px', marginTop: 7, borderRadius: 7, background: 'var(--pk-bg-subtle)', fontSize: 12, color: 'var(--pk-text-secondary)' }}>{note}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
            {health.components.map((component) => {
              const color = component.score >= 85 ? '#16A34A' : component.score >= 65 ? '#D97706' : '#DC2626';
              return (
                <Link key={component.key} href={component.href} className="pk-card pk-card-hover" style={{ background: '#fff', padding: 18, color: 'inherit', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 600 }}>{component.label}</div>
                    <strong style={{ color }}>{component.score}</strong>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: '#E5E7EB', margin: '12px 0 10px', overflow: 'hidden' }}>
                    <div style={{ width: `${component.score}%`, height: '100%', background: color }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--pk-text-hint)' }}>Bobot {component.weight}%</div>
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>{component.metric}</div>
                  <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, color: 'var(--pk-text-secondary)' }}>{component.explanation}</div>
                </Link>
              );
            })}
          </div>

          <div className="pk-card" style={{ background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--pk-border)' }}>
              <div style={{ fontWeight: 600 }}>Anomaly Inbox</div>
              <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 3 }}>{data.anomalies.length} aturan aktif mendeteksi masalah</div>
            </div>
            {data.anomalies.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--pk-success)' }}>Tidak ada anomali pada periode ini.</div>
            ) : data.anomalies.map((anomaly) => (
              <Link key={anomaly.key} href={anomaly.href} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 12, alignItems: 'start', padding: '14px 20px', borderTop: '1px solid var(--pk-border)', color: 'inherit', textDecoration: 'none' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 5, background: anomalyColors[anomaly.severity] }} />
                <span>
                  <strong style={{ fontSize: 13 }}>{anomaly.title}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--pk-text-secondary)' }}>{anomaly.description}</span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--pk-text-hint)' }}>Aturan: {anomaly.rule}</span>
                </span>
                <strong style={{ color: anomalyColors[anomaly.severity] }}>{anomaly.count}</strong>
              </Link>
            ))}
          </div>

          <div className="pk-card" style={{ background: '#fff', padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Cakupan Aturan</div>
            {data.anomaly_coverage.map((coverage) => (
              <div key={coverage.rule} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '8px 0', borderTop: '1px solid var(--pk-border)', fontSize: 12 }}>
                <span>{coverage.rule}</span>
                <span style={{ color: coverage.available ? 'var(--pk-success)' : 'var(--pk-text-hint)', textAlign: 'right' }}>{coverage.available ? 'Aktif' : coverage.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {data && <div style={{ marginTop: 10, textAlign: 'right', fontSize: 11, color: 'var(--pk-text-hint)' }}>Diperbarui {new Date(data.period.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>}
    </div>
  );
}
