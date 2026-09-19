import { describe, it, expect } from 'vitest';
import { renderWallpaper, WALLPAPER_WIDTH, WALLPAPER_HEIGHT } from '../src/lib/wallpaper';
import { GET } from '../src/pages/api/wallpaper';

function pngSize(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('wallpaper generation', () => {
  it('3.1 generates a 1170x2532 PNG from exam data', () => {
    const buf = renderWallpaper({
      title: 'EEE 576: Introduction to Optimal Control',
      days: 9,
      dateLabel: 'Mon, 28 Sep 2026, 9:00 am',
      index: 0,
      total: 3,
      progress: 0.2,
      now: new Date('2026-09-19T10:00:00Z'),
      tz: 'UTC',
    });
    expect(Array.from(buf.subarray(0, 8))).toEqual(PNG_MAGIC);
    expect(pngSize(buf)).toEqual({ width: WALLPAPER_WIDTH, height: WALLPAPER_HEIGHT });
    expect(WALLPAPER_WIDTH).toBe(1170);
    expect(WALLPAPER_HEIGHT).toBe(2532);
    expect(buf.length).toBeLessThan(500 * 1024);
  });

  it('3.1b renders the "complete" and "empty" states without throwing', () => {
    const base = { index: 0, total: 0, progress: 1, now: new Date(), tz: 'UTC' };
    expect(() => renderWallpaper({ ...base, title: 'Exams complete!', days: null, dateLabel: '' })).not.toThrow();
    expect(() => renderWallpaper({ ...base, title: 'No exams yet', days: null, dateLabel: '' })).not.toThrow();
  });

  it('3.1c handles very long titles', () => {
    const buf = renderWallpaper({
      title: 'EEE 999: An Extraordinarily Long Course Title That Goes On And On About Advanced Topics In Everything',
      days: 42, dateLabel: 'Mon, 28 Sep 2026, 9:00 am', index: 0, total: 1, progress: 0,
      now: new Date(), tz: 'UTC',
    });
    expect(pngSize(buf)).toEqual({ width: 1170, height: 2532 });
  });

  it('3.2 endpoint returns image/png with no-cache headers', async () => {
    const exams = encodeURIComponent(JSON.stringify([
      { title: 'EEE 576', date: '2099-09-28', time: '09:00' },
    ]));
    const request = new Request(`http://localhost/api/wallpaper?exams=${exams}&tz=UTC`);
    const res = await GET({ request, url: new URL(request.url) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    expect(res.headers.get('cache-control')).toContain('no-store');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf.subarray(0, 8))).toEqual(PNG_MAGIC);
  });

  it('3.2b endpoint still returns a PNG (fallback) for malformed exams param', async () => {
    const request = new Request('http://localhost/api/wallpaper?exams=%7Bnot-json');
    const res = await GET({ request, url: new URL(request.url) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('3.3 wallpaper content changes day to day (days value differs)', async () => {
    const { getCountdown } = await import('../src/lib/countdown');
    const exams = [{ id: '1', title: 'EEE 576', date: '2026-09-28', time: '09:00', datetime: '', color: '' }];
    expect(getCountdown(exams, new Date('2026-09-19T10:00:00Z'), 'UTC').days).toBe(9);
    expect(getCountdown(exams, new Date('2026-09-19T11:00:00Z'), 'UTC').days).toBe(9);
    expect(getCountdown(exams, new Date('2026-09-20T10:00:00Z'), 'UTC').days).toBe(8);
  });
});
