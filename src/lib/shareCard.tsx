import { ImageResponse } from 'next/og';
import { BRAND_GRADIENT, SHARE_SIZE, SITE_NAME, TrendMark } from './brand';

/** Decorative rising area chart that bleeds off the bottom-right of the card. */
function Backdrop() {
  return (
    <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b85ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8b85ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M800 600 L880 560 L940 580 L1010 500 L1060 520 L1130 420 L1170 440 L1200 400 L1200 630 L800 630 Z" fill="url(#fill)" />
      <path d="M800 600 L880 560 L940 580 L1010 500 L1060 520 L1130 420 L1170 440 L1200 400" fill="none" stroke="#a5a0ff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface ShareCardProps {
  title: string;
  subtitle?: string;
  chips?: string[];
  /** Full-period simulation line, e.g. "1.000 € → 1.420 € (...)" */
  euroLine?: string;
}

export function shareCard({ title, subtitle, chips = [], euroLine }: ShareCardProps) {
  const titleSize = title.length > 48 ? 56 : title.length > 28 ? 68 : 84;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'radial-gradient(circle at 85% 10%, #2a2470 0%, #0d0e14 60%)',
          color: '#ececf3',
          position: 'relative',
        }}
      >
        <Backdrop />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: BRAND_GRADIENT }}>
            <TrendMark size={56} />
          </div>
          <div style={{ fontSize: 32, letterSpacing: -0.5 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
          {chips.length > 0 && (
            <div style={{ display: 'flex', gap: 12 }}>
              {chips.map((c) => (
                <div key={c} style={{ display: 'flex', padding: '8px 18px', borderRadius: 999, fontSize: 26, background: 'rgba(139,133,255,0.18)', border: '1px solid rgba(165,160,255,0.45)', color: '#d6d3ff' }}>
                  {c}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: titleSize, lineHeight: 1.08, letterSpacing: -2 }}>{title}</div>
          {euroLine && <div style={{ display: 'flex', fontSize: 40, color: '#ececf3', lineHeight: 1.2, letterSpacing: -0.5 }}>{euroLine}</div>}
          {subtitle && <div style={{ display: 'flex', fontSize: 30, color: '#a2a6b8', lineHeight: 1.35, maxWidth: 680 }}>{subtitle}</div>}
        </div>
      </div>
    ),
    SHARE_SIZE,
  );
}
