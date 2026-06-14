type Status = 'paid' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'payment_failed' | 'active' | 'inactive' | 'banned';

const map: Record<Status, { cls: string; label: string }> = {
  paid:            { cls: 'pk-badge-paid',      label: 'Dibayar' },
  pending:         { cls: 'pk-badge-pending',    label: 'Pending' },
  processing:      { cls: 'pk-badge-paid',       label: 'Diproses' },
  shipped:         { cls: 'pk-badge-shipped',    label: 'Dikirim' },
  delivered:       { cls: 'pk-badge-delivered',  label: 'Selesai' },
  payment_failed:  { cls: 'pk-badge-failed',     label: 'Gagal' },
  active:          { cls: 'pk-badge-delivered',  label: 'Aktif' },
  inactive:        { cls: 'pk-badge-pending',    label: 'Nonaktif' },
  banned:          { cls: 'pk-badge-failed',     label: 'Banned' },
};

export default function StatusBadge({ status }: { status: string }) {
  const m = map[status as Status] ?? { cls: 'pk-badge-neutral', label: status };
  return <span className={`pk-badge ${m.cls}`}>{m.label}</span>;
}
