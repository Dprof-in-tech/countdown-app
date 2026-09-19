import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveExams, loadExams, clearExams, STORAGE_KEY } from '../src/lib/storage';
import type { Exam } from '../src/lib/types';

const exams: Exam[] = [
  { id: '1', title: 'EEE 576', date: '2026-09-28', time: '09:00', datetime: '2026-09-28T09:00:00', color: '#111111' },
  { id: '2', title: 'EEE 574', date: '2026-10-02', time: '09:00', datetime: '2026-10-02T09:00:00', color: '#222222' },
  { id: '3', title: 'EEE 512', date: '2026-10-05', time: '09:00', datetime: '2026-10-05T09:00:00', color: '#333333' },
];

/** Minimal in-memory Storage — Node 25 ships a localStorage stub that shadows jsdom's. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

describe('storage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('4.1 saves exams to localStorage under the documented key', () => {
    expect(STORAGE_KEY).toBe('examCountdownExams');
    expect(saveExams(exams)).toBe(true);
    expect(JSON.parse(localStorage.getItem('examCountdownExams')!)).toEqual(exams);
  });

  it('4.2 loads exams back', () => {
    saveExams(exams);
    expect(loadExams()).toEqual(exams);
  });

  it('4.2b returns [] for missing or corrupt data', () => {
    expect(loadExams()).toEqual([]);
    localStorage.setItem('examCountdownExams', '{oops');
    expect(loadExams()).toEqual([]);
  });

  it('4.3 clears exams', () => {
    saveExams(exams);
    clearExams();
    expect(localStorage.getItem('examCountdownExams')).toBeNull();
    expect(loadExams()).toEqual([]);
  });
});
