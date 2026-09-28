import type { Countdown, ExamInput } from './types';
import { sortExams } from './parse';

const DAY_MS = 86_400_000;

/** Calendar date (Y, M, D) of `now` as seen in `tz`. */
export function localDateParts(now: Date, tz: string): { y: number; m: number; d: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function isoToUtcMidnight(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole calendar days from "today in tz" to the exam date.
 * An exam later today is 0 days away — even if its start time has passed.
 */
export function daysUntil(exam: ExamInput, now: Date, tz: string): number {
  const { y, m, d } = localDateParts(now, tz);
  const today = Date.UTC(y, m - 1, d);
  return Math.floor((isoToUtcMidnight(exam.date) - today) / DAY_MS);
}

/** How far `tz` is from UTC at a given instant, in ms. 0 for an unknown zone. */
function tzOffsetMs(utcMs: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const p: Record<string, number> = {};
    for (const { type, value } of parts) if (type !== 'literal') p[type] = Number(value);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - utcMs;
  } catch {
    return 0;
  }
}

/** A wall-clock time in `tz` as a UTC timestamp. Two passes so DST changeovers land correctly. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const utc = naive - tzOffsetMs(naive, tz);
  return naive - tzOffsetMs(utc, tz);
}

/**
 * When the exam is over, as a UTC timestamp. With a known duration that is start + duration;
 * without one we only know the day, so it runs until that day ends.
 */
export function examEndsAt(exam: ExamInput, tz: string): number {
  const [y, m, d] = exam.date.split('-').map(Number);
  if (!exam.durationMinutes) return zonedToUtc(y, m, d + 1, 0, 0, tz);
  const [hh, mm] = exam.time.split(':').map(Number);
  return zonedToUtc(y, m, d, hh, mm, tz) + exam.durationMinutes * 60_000;
}

/** First exam that has not finished yet, by date then time. */
export function findNextExam<T extends ExamInput>(exams: T[], now: Date, tz: string): T | null {
  return sortExams(exams).find((e) => now.getTime() < examEndsAt(e, tz)) ?? null;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clock = (hh: number, mm: number) => {
  const h = hh % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** "Mon, 28 Sep 2026, 9:00 am", or "… 9:00 am – 12:00 pm" when the length is known. */
export function formatExamDate(exam: ExamInput): string {
  const [y, m, d] = exam.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const [hh, mm] = exam.time.split(':').map(Number);
  let time = clock(hh, mm);
  if (exam.durationMinutes) {
    const end = hh * 60 + mm + exam.durationMinutes;
    time += ` – ${clock(Math.floor(end / 60), end % 60)}`;
  }
  return `${DOW[dt.getUTCDay()]}, ${d} ${MON[m - 1]} ${y}, ${time}`;
}

/** Everything the wallpaper needs to render for `now`. */
export function getCountdown(exams: ExamInput[], now: Date, tz: string): Countdown {
  const sorted = sortExams(exams);
  if (sorted.length === 0) {
    return { title: 'No exams yet', days: null, dateLabel: '', index: 0, total: 0, progress: 0 };
  }
  const next = findNextExam(sorted, now, tz);
  if (!next) {
    return { title: 'Exams complete!', days: null, dateLabel: '', index: sorted.length, total: sorted.length, progress: 1 };
  }
  const index = sorted.indexOf(next);
  const first = isoToUtcMidnight(sorted[0].date);
  const last = isoToUtcMidnight(sorted[sorted.length - 1].date);
  const { y, m, d } = localDateParts(now, tz);
  const today = Date.UTC(y, m - 1, d);
  const progress = last > first ? Math.min(1, Math.max(0, (today - first) / (last - first))) : 0;
  return {
    title: next.title,
    days: daysUntil(next, now, tz),
    dateLabel: formatExamDate(next),
    index,
    total: sorted.length,
    progress,
  };
}
