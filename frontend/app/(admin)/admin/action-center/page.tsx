'use client';

import { useQuery } from '@tanstack/react-query';
import { ActionCenter, IntegrationHealth } from '@/components/pk/admin-analytics';
import { adminApi } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';

export default function AdminActionCenterPage() {
  const analyticsQuery = useQuery({
    queryKey: queryKeys.admin.analytics('30d'),
    queryFn: async () => (await adminApi.getAnalytics({ period: '30d' })).data.data,
  });

  const data = analyticsQuery.data;
  const attentionCount = (data?.action_center ?? [])
    .filter((item) => item.severity !== 'ok')
    .reduce((sum, item) => sum + item.count, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            Action Center
          </h1>
          <p style={{ fontSize: 14, color: 'var(--pk-text-secondary)', margin: 0 }}>
            Prioritas operasional otomatis dari 30 hari terakhir
          </p>
        </div>
        <div className="pk-card" style={{ padding: '10px 14px', background: '#fff' }}>
          <strong style={{ color: attentionCount ? 'var(--pk-danger)' : 'var(--pk-success)' }}>
            {attentionCount.toLocaleString('id-ID')}
          </strong>
          <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--pk-text-secondary)' }}>
            item membutuhkan perhatian
          </span>
        </div>
      </div>

      {analyticsQuery.isError && (
        <div className="pk-card" role="alert" style={{ padding: 18, marginBottom: 20 }}>
          Action Center gagal dimuat.{' '}
          <button className="pk-btn pk-btn-secondary pk-btn-sm" onClick={() => analyticsQuery.refetch()}>
            Coba Lagi
          </button>
        </div>
      )}

      {analyticsQuery.isLoading ? (
        <div className="pk-card" style={{ padding: 32, textAlign: 'center', color: 'var(--pk-text-hint)' }}>
          Menyusun prioritas operasional...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <ActionCenter data={data?.action_center ?? []} detailed />
          <IntegrationHealth
            data={data?.integration_health ?? { available: false, services: [], message: 'Data belum tersedia.' }}
          />
        </div>
      )}

      {data && (
        <div style={{ marginTop: 14, textAlign: 'right', fontSize: 11, color: 'var(--pk-text-hint)' }}>
          Diperbarui {new Date(data.period.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
        </div>
      )}
    </div>
  );
}
