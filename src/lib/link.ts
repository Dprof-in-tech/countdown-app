import type { ExamInput } from './types';
import type { WallpaperStyle } from './styles';
import { MAX_DURATION_MINUTES } from './parse';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

/** Wallpaper URL carrying the exams (and the viewer's timezone) as query params. */
export function buildWallpaperUrl(origin: string, exams: ExamInput[], tz: string, style: WallpaperStyle = 'minimal'): string {
  const compact = exams.map(({ title, date, time, durationMinutes }) => ({
    title, date, time, ...(durationMinutes ? { durationMinutes } : {}),
  }));
  const u = new URL('/api/wallpaper', origin);
  u.searchParams.set('exams', JSON.stringify(compact));
  u.searchParams.set('tz', tz);
  if (style !== 'minimal') u.searchParams.set('style', style);
  return u.toString();
}

/** Validate and decode the `exams` query param. Returns null on anything malformed. */
export function decodeExamsParam(raw: string): ExamInput[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const out: ExamInput[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') return null;
    const { title, date, time, durationMinutes } = item as Record<string, unknown>;
    if (typeof title !== 'string' || typeof date !== 'string' || typeof time !== 'string') return null;
    if (!ISO_DATE.test(date) || !HHMM.test(time)) return null;
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
    const [hh, mm] = time.split(':').map(Number);
    if (hh > 23 || mm > 59) return null;
    if (durationMinutes !== undefined) {
      if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_DURATION_MINUTES) return null;
    }
    out.push({
      title: title.slice(0, 200), date, time,
      ...(durationMinutes ? { durationMinutes: durationMinutes as number } : {}),
    });
  }
  return out;
}
