import type { Exam } from './types';

export const STORAGE_KEY = 'examCountdownExams';

function store(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return store() !== null;
}

/** Returns false when localStorage is unavailable (private mode, quota, SSR). */
export function saveExams(exams: Exam[]): boolean {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(exams));
    return true;
  } catch {
    return false;
  }
}

export function loadExams(): Exam[] {
  const s = store();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function clearExams(): void {
  store()?.removeItem(STORAGE_KEY);
}

export const STYLE_KEY = 'examCountdownStyle';

export function saveStyle(style: string): void {
  try { store()?.setItem(STYLE_KEY, style); } catch { /* ignore */ }
}

export function loadStyle(): string | null {
  return store()?.getItem(STYLE_KEY) ?? null;
}

export const GUIDE_KEY = 'examCountdownGuideSeen';

export function guideSeen(): boolean {
  return store()?.getItem(GUIDE_KEY) === '1';
}

export function markGuideSeen(): void {
  try { store()?.setItem(GUIDE_KEY, '1'); } catch { /* ignore */ }
}
