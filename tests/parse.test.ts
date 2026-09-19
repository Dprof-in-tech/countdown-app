import { describe, it, expect } from 'vitest';
import { parseExams, parseDate, parseTime, sortExams } from '../src/lib/parse';

describe('parsing', () => {
  it('1.1 parses valid bulk input', () => {
    const input = `EEE 576: Introduction to Optimal Control, 28 Sep 2026, 9:00 am
EEE 574: Discrete Control Systems, 2 Oct 2026, 9:00 am`;
    const result = parseExams(input);
    expect(result.success).toBe(true);
    expect(result.exams).toMatchObject([
      { title: 'EEE 576: Introduction to Optimal Control', date: '2026-09-28', time: '09:00' },
      { title: 'EEE 574: Discrete Control Systems', date: '2026-10-02', time: '09:00' },
    ]);
    expect(result.exams[0].id).toBeTruthy();
    expect(result.exams[0].datetime).toBe('2026-09-28T09:00:00');
  });

  it('1.2 parses date format variations', () => {
    expect(parseExams('EEE 576, 9/28/2026, 9:00 am').exams[0]).toMatchObject({ date: '2026-09-28', time: '09:00' });
    expect(parseDate('09/28/2026')).toBe('2026-09-28');
    expect(parseDate('2026-09-28')).toBe('2026-09-28');
    expect(parseDate('28 Sep 2026')).toBe('2026-09-28');
    expect(parseDate('28 September 2026')).toBe('2026-09-28');
    expect(parseDate('Sep 28, 2026')).toBe('2026-09-28');
    expect(parseDate('Mon, 28 Sep 2026')).toBe('2026-09-28');
    expect(parseDate('28/09/2026')).toBe('2026-09-28'); // day > 12 so unambiguous DD/MM
  });

  it('1.3 parses time format variations', () => {
    expect(parseExams('EEE 576, 28 Sep 2026, 9am').exams[0].time).toBe('09:00');
    expect(parseExams('EEE 576, 28 Sep 2026, 09:00').exams[0].time).toBe('09:00');
    expect(parseTime('9:00 am')).toBe('09:00');
    expect(parseTime('9:00AM')).toBe('09:00');
    expect(parseTime('2pm')).toBe('14:00');
    expect(parseTime('12pm')).toBe('12:00');
    expect(parseTime('12am')).toBe('00:00');
    expect(parseTime('14:30')).toBe('14:30');
    expect(parseTime('2.30 pm')).toBe('14:30');
  });

  it('1.4 handles invalid input gracefully', () => {
    const result = parseExams('EEE 576, 99 Sep 2026, 9:00 am');
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      { line: 1, message: "Invalid date. Use format like '28 Sep 2026' or '09/28/2026'" },
    ]);
  });

  it('1.4b reports errors per line and keeps line numbers', () => {
    const result = parseExams(`EEE 576, 28 Sep 2026, 9:00 am
just some garbage
EEE 574, 2 Oct 2026, 25:00`);
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(result.errors[0].message).toMatch(/Course Name, Date, Time/);
    expect(result.errors[1].message).toMatch(/Invalid time/);
  });

  it('1.5 sorts exams by date', () => {
    const result = parseExams(`EEE 576, 28 Sep 2026, 9:00 am
EEE 512, 5 Oct 2026, 9:00 am
EEE 574, 2 Oct 2026, 9:00 am`);
    expect(result.exams.map((e) => e.title)).toEqual(['EEE 576', 'EEE 574', 'EEE 512']);
  });

  it('1.5b sortExams orders by date then time', () => {
    const sorted = sortExams([
      { id: 'a', title: 'A', date: '2026-10-02', time: '14:00', datetime: '', color: '' },
      { id: 'b', title: 'B', date: '2026-10-02', time: '09:00', datetime: '', color: '' },
      { id: 'c', title: 'C', date: '2026-09-28', time: '09:00', datetime: '', color: '' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('ignores blank lines and tolerates titles containing commas', () => {
    const result = parseExams(`

EEE 512: Renewable, New & Emerging Energy Systems, 5 Oct 2026, 9:00 am

`);
    expect(result.success).toBe(true);
    expect(result.exams).toHaveLength(1);
    expect(result.exams[0].title).toBe('EEE 512: Renewable, New & Emerging Energy Systems');
  });

  it('tolerates weekday annotations, durations and loose separators', () => {
    const result = parseExams(`EEE 576: Introduction to Optimal Control, 28 Sep 2026 (Monday), 9:00 am, 3 hours
EEE 574: Discrete Control Systems, 2 Oct 2026 (Friday), 9:00 am, 3 hours
CVE 551: 05 oct 2026- 9:00am
MTH 101 - Calculus I | 12/10/2026 | 2pm
PHY 202 Waves: Friday 16 Oct 2026 at 14:30 (Hall B)
CHM 110: 2026-10-20 8am`);
    expect(result.errors).toEqual([]);
    expect(result.exams.map((e) => [e.title, e.date, e.time])).toEqual([
      ['EEE 576: Introduction to Optimal Control', '2026-09-28', '09:00'],
      ['EEE 574: Discrete Control Systems', '2026-10-02', '09:00'],
      ['CVE 551', '2026-10-05', '09:00'],
      ['PHY 202 Waves', '2026-10-16', '14:30'],
      ['CHM 110', '2026-10-20', '08:00'],
      ['MTH 101 - Calculus I', '2026-12-10', '14:00'], // sorted: 12/10 is December
    ]);
  });

  it('accepts time before date and still reports a missing time', () => {
    expect(parseExams('EEE 576, 9:00 am, 28 Sep 2026').exams[0]).toMatchObject({ title: 'EEE 576', date: '2026-09-28', time: '09:00' });
    const missing = parseExams('EEE 576, 28 Sep 2026');
    expect(missing.success).toBe(false);
    expect(missing.errors[0].message).toMatch(/Invalid time/);
  });

  it('assigns a stable colour per exam', () => {
    const result = parseExams('EEE 576, 28 Sep 2026, 9:00 am');
    expect(result.exams[0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
