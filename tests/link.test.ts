import { describe, it, expect } from 'vitest';
import { buildWallpaperUrl, decodeExamsParam } from '../src/lib/link';
import type { Exam } from '../src/lib/types';

const exams: Exam[] = [
  { id: '1', title: 'EEE 576: Intro, with comma', date: '2026-09-28', time: '09:00', datetime: '', color: '#111111' },
  { id: '2', title: 'EEE 574', date: '2026-10-02', time: '09:00', datetime: '', color: '#222222' },
];

describe('wallpaper link', () => {
  it('5.2 round-trips exams through the URL', () => {
    const url = buildWallpaperUrl('https://example.com', exams, 'Africa/Lagos');
    const u = new URL(url);
    expect(u.pathname).toBe('/api/wallpaper');
    expect(u.searchParams.get('tz')).toBe('Africa/Lagos');
    const decoded = decodeExamsParam(u.searchParams.get('exams')!);
    expect(decoded).toEqual([
      { title: 'EEE 576: Intro, with comma', date: '2026-09-28', time: '09:00' },
      { title: 'EEE 574', date: '2026-10-02', time: '09:00' },
    ]);
  });

  it('rejects junk', () => {
    expect(decodeExamsParam('not json')).toBeNull();
    expect(decodeExamsParam(JSON.stringify({ a: 1 }))).toBeNull();
    expect(decodeExamsParam(JSON.stringify([{ title: 'x' }]))).toBeNull();
    expect(decodeExamsParam(JSON.stringify([{ title: 'x', date: '2026-13-40', time: '09:00' }]))).toBeNull();
  });
});
