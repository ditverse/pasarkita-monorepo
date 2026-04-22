export default function Avatar({
  name = 'User',
  size = 32,
  bg = '#111827',
  color = '#fff',
}: {
  name?: string;
  size?: number;
  bg?: string;
  color?: string;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, size * 0.38),
        fontWeight: 600,
        letterSpacing: '-0.01em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
