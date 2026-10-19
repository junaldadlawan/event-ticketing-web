export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The 3-hour window (wrapping past midnight) with the most tickets: its first hour, and the tickets in it. */
export function bestWindow(byHour: number[], width = 3): { start: number; tickets: number } {
  let best = { start: 0, tickets: -1 };
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let k = 0; k < width; k++) sum += byHour[(h + k) % 24];
    if (sum > best.tickets) best = { start: h, tickets: sum };
  }
  return best;
}

/** "7 PM" for 19. */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh < 12 ? 'AM' : 'PM'}`;
}
