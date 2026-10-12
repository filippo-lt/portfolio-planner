import { ImageResponse } from 'next/og';
import { BRAND_GRADIENT, TrendMark } from '@/lib/brand';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Full-bleed square: iOS applies its own rounded mask.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND_GRADIENT }}>
        <TrendMark size={150} />
      </div>
    ),
    size,
  );
}
