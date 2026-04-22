export default function Placeholder({
  label = 'image',
  height = 200,
  style,
}: {
  label?: string;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="pk-ph"
      style={{ width: '100%', height, borderRadius: 8, ...style }}
    >
      {label}
    </div>
  );
}
