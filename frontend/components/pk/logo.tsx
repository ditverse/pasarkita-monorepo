export default function Logo({
  size = 18,
  collapsed = false,
  color,
}: {
  size?: number;
  collapsed?: boolean;
  color?: string;
}) {
  const c = color ?? '#111827';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size + 4} height={size + 4} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" fill={c} />
        <path
          d="M8 8h4.5a3 3 0 0 1 0 6H8v3"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!collapsed && (
        <span style={{ fontWeight: 600, fontSize: size, letterSpacing: '-0.02em', color: c }}>
          PasarKita
        </span>
      )}
    </div>
  );
}
