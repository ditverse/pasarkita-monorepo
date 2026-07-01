import Placeholder from './placeholder';

export default function ProductImage({
  src,
  alt,
  height,
  style,
}: {
  src?: string | null;
  alt: string;
  height: number;
  style?: React.CSSProperties;
}) {
  if (!src) {
    return <Placeholder label={alt} height={height} style={style} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{
        width: '100%',
        height,
        display: 'block',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
}
