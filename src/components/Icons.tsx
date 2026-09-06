import React from "react";

/** أيقونات خطية بسيطة (stroke) بدون أي مكتبة خارجية. */
const P: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  building: "M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 21V9h3a2 2 0 0 1 2 2v10M3 21h18M7.5 7h2M7.5 11h2M7.5 15h2",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.87M16 3.6a4 4 0 0 1 0 7.75",
  wallet: "M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 8v3m18 4h-4a2 2 0 1 1 0-4h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1Z",
  file: "M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM9 13h6M9 17h4",
  receipt: "M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3zM8.5 8h7M8.5 12h7M8.5 16h4",
  wrench: "M14.7 6.3a4 4 0 1 0 5 5L15 16l-3.5 3.5a2.1 2.1 0 0 1-3-3L12 13z",
  cog: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z",
  shield: "M12 22s8-3.5 8-10V5.5L12 2 4 5.5V12c0 6.5 8 10 8 10ZM9.5 12l1.8 1.8L15 10",
  logout: "M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  chevronDown: "m6 9 6 6 6-6",
  chevronLeft: "m15 18-6-6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  x: "M18 6 6 18M6 6l12 12",
  edit: "M4 20h4L20 8a2.8 2.8 0 1 0-4-4L4 16z",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3",
  upload: "M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  download: "M12 4v12M8 12l4 4 4-4M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1",
  print: "M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z",
  phone: "M21 16.9v2.1a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h2.1a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.4 10.6a16 16 0 0 0 5 5l1-1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  whatsapp: "M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 20.5 12ZM9 8.5c.2 1 .7 2.2 1.6 3.1.9 1 2 1.5 3 1.7l.8-1.2 1.9.9c-.2.9-1 1.5-2 1.4-1.8-.2-3.6-1.2-4.9-2.6C8.1 10.4 7.5 8.9 7.6 7.7c.1-.9.8-1.5 1.6-1.5l.8 2z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  check: "m5 13 4 4L19 7",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12l2.5 2.5L16 9.5",
  filter: "M4 5h16l-6 7v6l-4 2v-8z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.4 4.2M6.2 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.4",
  lock: "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7.5a4 4 0 1 1 8 0V11M12 15v2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  more: "M12 6.5h.01M12 12h.01M12 17.5h.01",
  layers: "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  key: "M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12.5 11.5 6 18l1.5 1.5M8 17l1.5 1.5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  card: "M2 8h20M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM6 15h4",
  door: "M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M3 21h18M12.5 12.5h.01",
  ruler: "M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4",
  bed: "M3 18v-7a1 1 0 0 1 1-1h10a3 3 0 0 1 3 3v5M3 14h18M21 18v-4M3 18h18M6 10V7",
  bath: "M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM7 12V6a2 2 0 0 1 3.5-1.3M6 20l-1 2M18 20l1 2",
  sparkle: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  idCard: "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 16a3.5 3.5 0 0 1 7 0M15 10h4M15 13.5h4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  bell: "M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 19a2 2 0 0 0 3 0",
  refresh: "M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18.5 3v3h-3M5.5 21v-3h3",
  box: "m12 3 9 4.5v9L12 21l-9-4.5v-9zM3 7.5 12 12l9-4.5M12 12v9",
  store: "M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3.5 9 5 4h14l1.5 5a2.5 2.5 0 0 1-4.25 1.8A2.5 2.5 0 0 1 12 10a2.5 2.5 0 0 1-4.25.8A2.5 2.5 0 0 1 3.5 9ZM10 20v-5h4v5",
  message: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM7.5 9h9M7.5 12.5h6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01",
  cube: "M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10",
};

export type IconName = keyof typeof P;

export function Icon({
  name, size = 20, className = "", strokeWidth = 1.8, fill = "none", style,
}: {
  name: IconName | string; size?: number; className?: string;
  strokeWidth?: number; fill?: string; style?: React.CSSProperties;
}) {
  const d = P[name] ?? P.info;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true" focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/** شعار النظام */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#17324e" />
      <path d="M14 35V18.5L24 12l10 6.5V35" stroke="#b08d57" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M10.5 35h27" stroke="#b08d57" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="19" y="21" width="4" height="4" rx="1" fill="#fff" />
      <rect x="25" y="21" width="4" height="4" rx="1" fill="#fff" />
      <rect x="19" y="28" width="4" height="4" rx="1" fill="#fff" opacity=".55" />
      <rect x="25" y="28" width="4" height="4" rx="1" fill="#fff" opacity=".55" />
    </svg>
  );
}
