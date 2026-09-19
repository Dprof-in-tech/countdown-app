/** Wallpaper style metadata and copy. Pure — safe to import in the browser. */

export type WallpaperStyle = 'minimal' | 'call' | 'sign' | 'stare' | 'panic';

export const WALLPAPER_STYLES: { id: WallpaperStyle; name: string; blurb: string }[] = [
  { id: 'minimal', name: 'Minimal', blurb: 'Big number, course, date. Nothing else.' },
  { id: 'call', name: 'Incoming call', blurb: 'Your exam is calling. Decline is not an option.' },
  { id: 'sign', name: 'Sign', blurb: 'A little guy holding up the countdown. And an opinion.' },
  { id: 'stare', name: 'Stare', blurb: 'Arms crossed. Looking at you. Yes, you.' },
  { id: 'panic', name: 'Panic', blurb: 'Hands on head. Mouth open. Gets louder as the exam gets closer.' },
];

export function parseStyle(raw: string | null | undefined): WallpaperStyle {
  return WALLPAPER_STYLES.some((s) => s.id === raw) ? (raw as WallpaperStyle) : 'minimal';
}

/** The nag line. Escalates as the exam gets closer. */
export function messageFor(days: number | null): string {
  if (days === null) return 'Exams done. Go rest.';
  if (days <= 0) return "It's today. You've got this.";
  if (days === 1) return 'Tomorrow. Put the phone down.';
  if (days <= 6) return 'Exams are coming. Go study.';
  if (days <= 13) return 'Put your phone down and study.';
  if (days <= 29) return 'Plenty of time. Still — go study.';
  return 'Not urgent. Yet.';
}
