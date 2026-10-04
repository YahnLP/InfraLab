import { DAY, HOUR } from '../core';

/**
 * Calendrier du simulateur : t = 0 est le lundi (jour 1) à 08:00. Heures ouvrées : du lundi au vendredi, de 08:00 à 18:00.
 * Dans ces coordonnées, la fenêtre ouvrée du jour d commence en d × DAY et dure 10 h ; les jours d ≡ 5, 6 (mod 7) sont le week-end.
 */
export const OPEN_HOURS = 10 * HOUR;
export const SLA_CALENDAR_LABEL = { continuous: 'Continu (24 h / 24, 7 j / 7)', business: 'Heures ouvrées (lun–ven, 8 h–18 h)' } as const;
export type SlaCalendar = keyof typeof SLA_CALENDAR_LABEL;
export const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as const;
export const weekdayOf = (t: number): number => ((Math.floor(t / DAY) % 7) + 7) % 7; // 0 = lundi
/** Vrai si t tombe dans une heure ouvrée. */
export function isBusinessTime(t: number): boolean {
  const d = Math.floor(t / DAY); return ((d % 7) + 7) % 7 < 5 && t - d * DAY < OPEN_HOURS;
}
/** Temps ouvré écoulé entre a et b (a ≤ b), en ms. */
export function businessMs(a: number, b: number): number {
  if (b <= a) return 0; let sum = 0;
  for (let d = Math.floor(a / DAY); d * DAY <= b; d++) {
    if (((d % 7) + 7) % 7 >= 5) continue;
    const lo = Math.max(a, d * DAY), hi = Math.min(b, d * DAY + OPEN_HOURS); if (hi > lo) sum += hi - lo;
  }
  return sum;
}
