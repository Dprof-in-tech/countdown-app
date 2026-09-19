import { describe, it, expect } from 'vitest';
import { renderOgImage, OG_WIDTH, OG_HEIGHT } from '../src/lib/og';

function pngSize(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

describe('og image', () => {
  it('renders a 1200x630 PNG under 1MB', async () => {
    const buf = await renderOgImage();
    expect(Array.from(buf.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngSize(buf)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
    expect(buf.length).toBeLessThan(1024 * 1024);
  });
});
