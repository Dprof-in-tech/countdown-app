import { describe, it, expect } from 'vitest';
import { parseDuration, parseExams } from '../src/lib/parse';
import { examEndsAt, findNextExam, formatExamDate, getCountdown } from '../src/lib/countdown';
import { buildWallpaperUrl, decodeExamsParam } from '../src/lib/link';
import type { ExamInput } from '../src/lib/types';

const exam = (title: string, date: string, time: string, durationMinutes?: number): ExamInput => ({
  title, date, time, ...(durationMinutes ? { durationMinutes } : {}),
});

describe('duration parsing', () => {
  it('reads the common ways people write a length', () => {
    expect(parseDuration('3 hours')).toBe(180);
    expect(parseDuration('3hrs')).toBe(180);
    expect(parseDuration('3h')).toBe(180);
    expect(parseDuration('1.5 hours')).toBe(90);
    expect(parseDuration('90 minutes')).toBe(90);
    expect(parseDuration('90 mins')).toBe(90);
    expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('2h 30m')).toBe(150);
    expect(parseDuration('2 hours 30 minutes')).toBe(150);
  });

  it('rejects things that are not durations', () => {
    expect(parseDuration('Hall B')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('9:00')).toBeNull();
    expect(parseDuration('0 hours')).toBeNull();
    expect(parseDuration('30 hours')).toBeNull(); // implausible for an exam
  });

  it('captures a trailing duration from a line', () => {
    const { exams, errors } = parseExams('EEE 576: Introduction to Optimal Control, 28 Sep 2026 (Monday), 9:00 am, 3 hours');
    expect(errors).toEqual([]);
    expect(exams[0]).toMatchObject({ title: 'EEE 576: Introduction to Optimal Control', time: '09:00', durationMinutes: 180 });
  });

  it('derives the duration from an explicit time range', () => {
    const { exams, errors } = parseExams('CVE 551: 05 oct 2026, 9:00am - 12:00pm');
    expect(errors).toEqual([]);
    expect(exams[0]).toMatchObject({ date: '2026-10-05', time: '09:00', durationMinutes: 180 });
  });

  it('leaves duration off when the line does not say one', () => {
    const { exams } = parseExams('EEE 574: Discrete Control Systems, 2 Oct 2026, 9:00 am');
    expect(exams[0].durationMinutes).toBeUndefined();
  });

  it('still ignores non-duration trailing fields', () => {
    const { exams, errors } = parseExams('PHY 202 Waves: Friday 16 Oct 2026 at 14:30 (Hall B)');
    expect(errors).toEqual([]);
    expect(exams[0]).toMatchObject({ title: 'PHY 202 Waves', time: '14:30' });
    expect(exams[0].durationMinutes).toBeUndefined();
  });
});

describe('exam end time', () => {
  it('ends at start + duration, in the viewer timezone', () => {
    // 09:00 in Lagos (UTC+1) is 08:00Z; +3h ends 11:00Z
    expect(examEndsAt(exam('A', '2026-09-28', '09:00', 180), 'Africa/Lagos')).toBe(Date.parse('2026-09-28T11:00:00Z'));
    expect(examEndsAt(exam('A', '2026-09-28', '09:00', 180), 'UTC')).toBe(Date.parse('2026-09-28T12:00:00Z'));
  });

  it('assumes three hours when the schedule does not say', () => {
    // 09:00 Lagos is 08:00Z, so the assumed end is 11:00Z
    expect(examEndsAt(exam('A', '2026-09-28', '09:00'), 'Africa/Lagos')).toBe(Date.parse('2026-09-28T11:00:00Z'));
    expect(examEndsAt(exam('A', '2026-09-28', '09:00'), 'UTC')).toBe(Date.parse('2026-09-28T12:00:00Z'));
  });

  it('handles a duration that runs past midnight', () => {
    expect(examEndsAt(exam('A', '2026-09-28', '23:00', 180), 'UTC')).toBe(Date.parse('2026-09-29T02:00:00Z'));
  });
});

describe('rolling over when an exam ends', () => {
  const exams = [
    exam('EEE 576', '2026-09-28', '09:00', 180), // ends 12:00
    exam('EEE 574', '2026-09-28', '14:00', 120), // ends 16:00 — same day
    exam('EEE 512', '2026-10-02', '09:00', 180),
  ];
  const at = (iso: string) => new Date(iso);

  it('keeps showing the exam while it is running', () => {
    expect(findNextExam(exams, at('2026-09-28T08:00:00Z'), 'UTC')?.title).toBe('EEE 576');
    expect(findNextExam(exams, at('2026-09-28T10:30:00Z'), 'UTC')?.title).toBe('EEE 576');
    expect(findNextExam(exams, at('2026-09-28T11:59:00Z'), 'UTC')?.title).toBe('EEE 576');
  });

  it('moves to the next exam once the current one has ended', () => {
    expect(findNextExam(exams, at('2026-09-28T12:01:00Z'), 'UTC')?.title).toBe('EEE 574');
    expect(findNextExam(exams, at('2026-09-28T15:00:00Z'), 'UTC')?.title).toBe('EEE 574');
    expect(findNextExam(exams, at('2026-09-28T16:01:00Z'), 'UTC')?.title).toBe('EEE 512');
  });

  it('respects the viewer timezone', () => {
    // 12:01Z is 13:01 in Lagos — the 09:00–12:00 Lagos exam is over
    expect(findNextExam(exams, at('2026-09-28T12:01:00Z'), 'Africa/Lagos')?.title).toBe('EEE 574');
    // but 10:30Z is only 11:30 in Lagos — still sitting it
    expect(findNextExam(exams, at('2026-09-28T10:30:00Z'), 'Africa/Lagos')?.title).toBe('EEE 576');
  });

  it('rolls over on the assumed length when none is given — old links included', () => {
    const noDuration = [exam('EEE 576', '2026-09-28', '09:00'), exam('EEE 574', '2026-10-02', '09:00')];
    expect(findNextExam(noDuration, at('2026-09-28T11:00:00Z'), 'UTC')?.title).toBe('EEE 576');
    expect(findNextExam(noDuration, at('2026-09-28T12:30:00Z'), 'UTC')?.title).toBe('EEE 574');
  });

  it('never presents an assumed length as if it were known', () => {
    expect(formatExamDate(exam('A', '2026-09-28', '09:00'))).toBe('Mon, 28 Sep 2026, 9:00 am');
  });

  it('reports all exams complete once the last one ends', () => {
    const c = getCountdown(exams, at('2026-10-02T12:30:00Z'), 'UTC');
    expect(c).toMatchObject({ title: 'Exams complete!', days: null });
  });

  it('the countdown still says Today while the exam is running', () => {
    const c = getCountdown(exams, at('2026-09-28T10:00:00Z'), 'UTC');
    expect(c).toMatchObject({ title: 'EEE 576', days: 0 });
  });
});

describe('labels and links carry the duration', () => {
  it('shows the end time in the date label when known', () => {
    expect(formatExamDate(exam('A', '2026-09-28', '09:00', 180))).toBe('Mon, 28 Sep 2026, 9:00 am – 12:00 pm');
    expect(formatExamDate(exam('A', '2026-09-28', '09:00'))).toBe('Mon, 28 Sep 2026, 9:00 am');
  });

  it('round-trips through the wallpaper URL', () => {
    const url = buildWallpaperUrl('https://example.com', [exam('A', '2026-09-28', '09:00', 180), exam('B', '2026-10-02', '09:00')], 'UTC');
    const decoded = decodeExamsParam(new URL(url).searchParams.get('exams')!);
    expect(decoded).toEqual([
      { title: 'A', date: '2026-09-28', time: '09:00', durationMinutes: 180 },
      { title: 'B', date: '2026-10-02', time: '09:00' },
    ]);
  });

  it('rejects a malformed duration in the link', () => {
    expect(decodeExamsParam(JSON.stringify([{ title: 'A', date: '2026-09-28', time: '09:00', durationMinutes: 'long' }]))).toBeNull();
    expect(decodeExamsParam(JSON.stringify([{ title: 'A', date: '2026-09-28', time: '09:00', durationMinutes: -5 }]))).toBeNull();
    expect(decodeExamsParam(JSON.stringify([{ title: 'A', date: '2026-09-28', time: '09:00', durationMinutes: 5000 }]))).toBeNull();
  });

  it('old links without a duration still decode', () => {
    const decoded = decodeExamsParam(JSON.stringify([{ title: 'A', date: '2026-09-28', time: '09:00' }]));
    expect(decoded).toEqual([{ title: 'A', date: '2026-09-28', time: '09:00' }]);
  });
});
