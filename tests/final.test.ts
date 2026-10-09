import { describe, it, expect } from 'vitest';
import { getCountdown } from '../src/lib/countdown';
import { messageFor } from '../src/lib/styles';
import type { ExamInput } from '../src/lib/types';

const e = (title: string, date: string): ExamInput => ({ title, date, time: '09:00', durationMinutes: 180 });
const three = [e('A', '2026-10-02'), e('B', '2026-10-05'), e('C', '2026-10-16')];
const at = (iso: string) => new Date(iso);

describe('the last exam is marked', () => {
  it('is not final while earlier exams remain', () => {
    expect(getCountdown(three, at('2026-10-01T10:00:00Z'), 'UTC')).toMatchObject({ title: 'A', isFinal: false });
    expect(getCountdown(three, at('2026-10-03T10:00:00Z'), 'UTC')).toMatchObject({ title: 'B', isFinal: false });
  });

  it('is final once it is the only one left', () => {
    expect(getCountdown(three, at('2026-10-06T10:00:00Z'), 'UTC')).toMatchObject({ title: 'C', isFinal: true });
  });

  it('a lone exam is also the last one', () => {
    expect(getCountdown([e('Only', '2026-10-16')], at('2026-10-01T10:00:00Z'), 'UTC').isFinal).toBe(true);
  });

  it('the finished and empty states are not final', () => {
    expect(getCountdown(three, at('2026-10-17T10:00:00Z'), 'UTC')).toMatchObject({ title: 'Exams complete!', isFinal: false });
    expect(getCountdown([], at('2026-10-01T10:00:00Z'), 'UTC').isFinal).toBe(false);
  });
});

describe('the last exam reads differently', () => {
  it('swaps dread for the finish line', () => {
    for (const days of [0, 1, 4, 10, 20, 40]) {
      expect(messageFor(days, true)).not.toBe(messageFor(days, false));
    }
    // the ordinary voice nags; the final one points at the end of it
    expect(messageFor(10, false)).toMatch(/study/i);
    expect(messageFor(10, true)).toMatch(/one|last|left/i);
  });

  it('still escalates as the day approaches', () => {
    expect(messageFor(40, true)).not.toBe(messageFor(4, true));
    expect(messageFor(1, true)).not.toBe(messageFor(0, true));
  });

  it('leaves the all-done message alone', () => {
    expect(messageFor(null, true)).toBe(messageFor(null, false));
  });
});

describe('every day of the run-in has its own voice', () => {
  it('no two days in the final week read the same', () => {
    const lines = [6, 5, 4, 3, 2, 1, 0].map((d) => messageFor(d, true));
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe('the day-of and day-before wording', () => {
  it('never repeats the word the headline already shouts', () => {
    // The big word is "Today" / "Tomorrow"; the line above it must not say so again.
    for (const isFinal of [false, true]) {
      expect(messageFor(0, isFinal).toLowerCase()).not.toContain('today');
      expect(messageFor(1, isFinal).toLowerCase()).not.toContain('tomorrow');
    }
  });
});
