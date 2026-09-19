import type { Exam, ExamInput, ParseError, ParseResult } from './types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export const DATE_ERROR = "Invalid date. Use format like '28 Sep 2026' or '09/28/2026'";
export const TIME_ERROR = "Invalid time. Use format like '9:00 am', '09:00' or '9am'";
export const FORMAT_ERROR = "Couldn't read this line. Use: Course Name, Date, Time";

const pad = (n: number) => String(n).padStart(2, '0');

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 1970 || y > 2200) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toIsoDate(y: number, m: number, d: number): string | null {
  return isValidDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/**
 * Accepts "28 Sep 2026", "28 September 2026", "Sep 28, 2026", "Mon, 28 Sep 2026",
 * "09/28/2026" (US), "28/09/2026" (when day > 12), "2026-09-28".
 * Returns an ISO date or null.
 */
export function parseDate(raw: string): string | null {
  let s = raw.trim().replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  // Strip a leading weekday ("Mon, 28 Sep 2026" / "Monday 28 Sep 2026")
  s = s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, '');

  let m: RegExpMatchArray | null;

  // 2026-09-28 or 2026/09/28
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) {
    return toIsoDate(+m[1], +m[2], +m[3]);
  }
  // 28 Sep 2026 / 28-Sep-2026
  if ((m = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s,-]+(\d{4})$/i))) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? toIsoDate(+m[3], mon, +m[1]) : null;
  }
  // Sep 28, 2026 / September 28 2026
  if ((m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    const mon = MONTHS[m[1].toLowerCase()];
    return mon ? toIsoDate(+m[3], mon, +m[2]) : null;
  }
  // 09/28/2026 (US, preferred) or 28/09/2026 (only when first number can't be a month)
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12 && b <= 12) return toIsoDate(y, b, a);
    return toIsoDate(y, a, b);
  }
  return null;
}

/** Accepts "9:00 am", "09:00", "9am", "2.30 pm", "14:30". Returns "HH:MM" or null. */
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ampm = m[3]?.replace(/\./g, '');
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'am' && h === 12) h = 0;
    if (ampm === 'pm' && h !== 12) h += 12;
  } else if (h > 23) {
    return null;
  }
  return `${pad(h)}:${pad(min)}`;
}

/** Deterministic pastel-ish accent colour derived from the title. */
export function colorFor(title: string): string {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return hslToHex(hue, 70, 55);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

let counter = 0;
export function makeId(): string {
  counter += 1;
  return `exam-${Date.now().toString(36)}-${counter}`;
}

/** Build a full Exam from the three user-facing fields. */
export function toExam(input: ExamInput, id = makeId()): Exam {
  return {
    id,
    title: input.title,
    date: input.date,
    time: input.time,
    datetime: `${input.date}T${input.time}:00`,
    color: colorFor(input.title),
  };
}

/** Parse a single "Title, Date, Time" line. Title may itself contain commas. */
export function parseLine(line: string): { exam?: ExamInput; error?: string } {
  const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return { error: FORMAT_ERROR };

  const timeRaw = parts[parts.length - 1];
  // Date may be "Mon, 28 Sep 2026" — try the last one or two chunks before the time.
  let dateEnd = parts.length - 1;
  let date = parseDate(parts[dateEnd - 1]);
  let dateStart = dateEnd - 1;
  if (!date && dateEnd - 2 >= 1) {
    date = parseDate(`${parts[dateEnd - 2]}, ${parts[dateEnd - 1]}`);
    dateStart = dateEnd - 2;
  }
  if (!date) return { error: DATE_ERROR };

  const time = parseTime(timeRaw);
  if (!time) return { error: TIME_ERROR };

  const title = parts.slice(0, dateStart).join(', ');
  if (!title) return { error: FORMAT_ERROR };
  return { exam: { title, date, time } };
}

export function sortExams<T extends ExamInput>(exams: T[]): T[] {
  return [...exams].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

/** Parse bulk text, one exam per line. Blank lines are ignored. Output is sorted by date. */
export function parseExams(text: string): ParseResult {
  const exams: Exam[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const { exam, error } = parseLine(line);
    if (exam) exams.push(toExam(exam));
    else errors.push({ line: i + 1, message: error! });
  });
  return { success: errors.length === 0, exams: sortExams(exams), errors };
}
