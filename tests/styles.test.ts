import { describe, it, expect } from 'vitest';
import { renderWallpaper, WALLPAPER_STYLES, messageFor, parseStyle } from '../src/lib/wallpaper';
import { buildWallpaperUrl } from '../src/lib/link';
import { GET } from '../src/pages/api/wallpaper';

function pngSize(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

const base = {
  title: 'EEE 576: Introduction to Optimal Control',
  dateLabel: 'Mon, 28 Sep 2026, 9:00 am',
  index: 0, total: 3, progress: 0.2, now: new Date('2026-09-19T10:00:00Z'), tz: 'UTC',
};

describe('wallpaper styles', () => {
  it('exposes three styles', () => {
    expect(WALLPAPER_STYLES.map((s) => s.id)).toEqual(['minimal', 'call', 'sign', 'stare', 'panic']);
  });

  it('parseStyle falls back to minimal', () => {
    expect(parseStyle('call')).toBe('call');
    expect(parseStyle('sign')).toBe('sign');
    expect(parseStyle('stare')).toBe('stare');
    expect(parseStyle('panic')).toBe('panic');
    expect(parseStyle('nope')).toBe('minimal');
    expect(parseStyle(null)).toBe('minimal');
  });

  it.each(['minimal', 'call', 'sign', 'stare', 'panic'] as const)('renders %s for every countdown state', (style) => {
    for (const days of [null, 0, 1, 5, 12, 40]) {
      const buf = renderWallpaper({ ...base, days, style, title: days === null ? 'Exams complete!' : base.title });
      expect(pngSize(buf)).toEqual({ width: 1170, height: 2532 });
      expect(buf.length).toBeLessThan(500 * 1024);
    }
  });

  it('message escalates as the exam gets closer', () => {
    expect(messageFor(null)).toMatch(/rest/i);
    expect(messageFor(0)).toMatch(/today/i);
    expect(messageFor(1)).toMatch(/tomorrow/i);
    expect(messageFor(3)).not.toBe(messageFor(10));
    expect(messageFor(10)).not.toBe(messageFor(20));
    expect(messageFor(20)).not.toBe(messageFor(60));
  });

  it('link carries the style and the endpoint honours it', async () => {
    const url = buildWallpaperUrl('https://example.com', [{ title: 'X', date: '2099-01-01', time: '09:00' }], 'UTC', 'call');
    expect(new URL(url).searchParams.get('style')).toBe('call');
    const res = await GET({ url: new URL(url) } as any);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('link omits style when minimal (keeps old links short)', () => {
    const url = buildWallpaperUrl('https://example.com', [], 'UTC');
    expect(new URL(url).searchParams.has('style')).toBe(false);
  });
});
