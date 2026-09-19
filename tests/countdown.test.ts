import { describe, it, expect } from 'vitest';
import { daysUntil, findNextExam, getCountdown } from '../src/lib/countdown';
import type { Exam } from '../src/lib/types';

const exam = (id: string, date: string, time = '09:00'): Exam => ({
  id, title: id, date, time, datetime: `${date}T${time}:00`, color: '#000000',
});

const TZ = 'UTC';

describe('countdown logic', () => {
  it('2.1 calculates days remaining (calendar days)', () => {
    const now = new Date('2026-09-19T10:00:00Z');
    expect(daysUntil(exam('EEE 576', '2026-09-28'), now, TZ)).toBe(9);
  });

  it('2.2 same-day countdown is 0 even after exam started', () => {
    const now = new Date('2026-09-28T10:00:00Z');
    expect(daysUntil(exam('EEE 576', '2026-09-28'), now, TZ)).toBe(0);
  });

  it('2.2b respects the user timezone when deciding what "today" is', () => {
    // 23:30 on 27 Sep in UTC is already 28 Sep in Lagos (UTC+1)
    const now = new Date('2026-09-27T23:30:00Z');
    expect(daysUntil(exam('EEE 576', '2026-09-28'), now, 'UTC')).toBe(1);
    expect(daysUntil(exam('EEE 576', '2026-09-28'), now, 'Africa/Lagos')).toBe(0);
  });

  it('2.3 finds next exam', () => {
    const exams = [exam('EEE 576', '2026-09-28'), exam('EEE 574', '2026-10-02'), exam('EEE 512', '2026-10-05')];
    const now = new Date('2026-09-30T12:00:00Z');
    expect(findNextExam(exams, now, TZ)?.id).toBe('EEE 574');
  });

  it('2.3b finds next exam regardless of input order', () => {
    const exams = [exam('EEE 512', '2026-10-05'), exam('EEE 576', '2026-09-28'), exam('EEE 574', '2026-10-02')];
    const now = new Date('2026-09-30T12:00:00Z');
    expect(findNextExam(exams, now, TZ)?.id).toBe('EEE 574');
  });

  it('2.4 no future exams', () => {
    const exams = [exam('EEE 576', '2026-09-28'), exam('EEE 574', '2026-10-02')];
    const now = new Date('2026-10-03T12:00:00Z');
    expect(findNextExam(exams, now, TZ)).toBeNull();
    expect(getCountdown(exams, now, TZ)).toMatchObject({ title: 'Exams complete!', days: null });
  });

  it('getCountdown returns full render data', () => {
    const exams = [exam('EEE 576', '2026-09-28'), exam('EEE 574', '2026-10-02'), exam('EEE 512', '2026-10-05')];
    const now = new Date('2026-09-30T12:00:00Z');
    const c = getCountdown(exams, now, TZ);
    expect(c).toMatchObject({
      title: 'EEE 574',
      days: 2,
      dateLabel: 'Fri, 2 Oct 2026, 9:00 am',
      index: 1,
      total: 3,
    });
    expect(c.progress).toBeGreaterThan(0);
    expect(c.progress).toBeLessThan(1);
  });

  it('getCountdown with no exams', () => {
    expect(getCountdown([], new Date(), TZ)).toMatchObject({ title: 'No exams yet', days: null });
  });
});
