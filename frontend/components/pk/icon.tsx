type IconName =
  | 'search' | 'chevronDown' | 'chevronRight' | 'chevronLeft' | 'plus' | 'minus' | 'x'
  | 'check' | 'checkCircle' | 'xCircle' | 'cart' | 'user' | 'menu' | 'bag' | 'store'
  | 'box' | 'truck' | 'eye' | 'eyeOff' | 'filter' | 'grid' | 'barChart' | 'users'
  | 'trending' | 'package' | 'clipboard' | 'creditCard' | 'arrowRight' | 'arrowLeft'
  | 'mapPin' | 'home' | 'more' | 'edit' | 'logout' | 'bell' | 'sparkle';

const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  chevronLeft: <path d="m15 6-6 6 6 6"/>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  minus: <path d="M5 12h14"/>,
  x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  check: <path d="M5 12l5 5L20 7"/>,
  checkCircle: <><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></>,
  xCircle: <><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></>,
  cart: <><circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M2 3h3l2.5 12h11l2-8H6"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  bag: <><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></>,
  store: <><path d="M3 9 5 4h14l2 5"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>,
  truck: <><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a14 14 0 0 1-3 3.7M6.6 6.7A14 14 0 0 0 2 12s3.5 6 10 6a9.5 9.5 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z"/>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  barChart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 3.5a3.5 3.5 0 0 1 0 7"/><path d="M22 21c0-2.8-1.8-5-4.5-5.7"/></>,
  trending: <><path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/></>,
  package: <><path d="m7.5 4.5 9 5"/><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/></>,
  clipboard: <><rect x="7" y="4" width="10" height="4" rx="1"/><path d="M17 6h2v14H5V6h2"/></>,
  creditCard: <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
  arrowLeft: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
  mapPin: <><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>,
  home: <path d="m3 11 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>,
  more: <><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></>,
};

export default function Icon({
  name,
  size = 16,
  stroke = 1.5,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {paths[name] ?? null}
    </svg>
  );
}
