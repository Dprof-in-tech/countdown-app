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

/**
 * The line under the character. Escalates as the exam nears — but the last exam swaps dread for
 * the finish line, because by then the only thing left to say is how close freedom is.
 */
export function messageFor(days: number | null, isFinal = false): string {
  if (days === null) return 'Exams done. Go rest.';
  if (isFinal) {
    if (days <= 0) return 'Last one. Go enjoy it.';
    if (days === 1) return "It's nearly over.";
    if (days === 2) return 'So close you can taste it.';
    if (days === 3) return 'Almost there now.';
    if (days === 4) return 'Nearly through it all.';
    if (days === 5) return 'The end is in sight.';
    if (days <= 6) return "One left. Then you're free.";
    if (days <= 13) return 'Just the one left now.';
    if (days <= 29) return 'One to go. Nearly there.';
    return 'One left. Eventually.';
  }
  if (days <= 0) return "You've got this.";
  if (days === 1) return 'Last night of cramming.';
  if (days <= 6) return 'Exams are coming. Go study.';
  if (days <= 13) return 'Put your phone down and study.';
  if (days <= 29) return 'Plenty of time. Still — go study.';
  return 'Not urgent. Yet.';
}
