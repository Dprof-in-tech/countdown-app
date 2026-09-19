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

/** First exam whose date is today or later, by date then time. */
export function findNextExam<T extends ExamInput>(exams: T[], now: Date, tz: string): T | null {
  return sortExams(exams).find((e) => daysUntil(e, now, tz) >= 0) ?? null;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, 28 Sep 2026, 9:00 am" */
export function formatExamDate(exam: ExamInput): string {
  const [y, m, d] = exam.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const [hh, mm] = exam.time.split(':').map(Number);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? 'am' : 'pm';
  return `${DOW[dt.getUTCDay()]}, ${d} ${MON[m - 1]} ${y}, ${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
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
