export interface Exam {
  id: string;
  title: string;
  /** ISO date, e.g. "2026-09-28" */
  date: string;
  /** 24-hour time, e.g. "09:00" */
  time: string;
  /** Naive ISO datetime (no zone) — "2026-09-28T09:00:00" */
  datetime: string;
  /** Hex colour used as an accent in the UI */
  color: string;
}

/** The subset of an exam that travels in the wallpaper URL. */
export type ExamInput = Pick<Exam, 'title' | 'date' | 'time'>;

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  success: boolean;
  exams: Exam[];
  errors: ParseError[];
}

export interface Countdown {
  title: string;
  /** Calendar days until the exam; null when there is nothing upcoming */
  days: number | null;
  /** "Mon, 28 Sep 2026, 9:00 am" */
  dateLabel: string;
  /** Position of the next exam in the sorted list (0-based) */
  index: number;
  total: number;
  /** Fraction of the exam period that has elapsed, 0..1 */
  progress: number;
}
