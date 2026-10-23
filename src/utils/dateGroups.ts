/**
 * When an event is, as a heading: "Today", "Tomorrow", a weekday this coming week, "Later this month", then the month
 * (with the year when it isn't this year). Past events read the same way backwards ("Yesterday", "Earlier this month").
 */
export function dateGroupLabel(startAt: string, now = new Date()): string {
  const day = new Date(startAt);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(day) - startOf(now)) / 86_400_000);
  const sameMonth = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return day.toLocaleDateString(undefined, { weekday: 'long' });
  if (sameMonth) return days > 0 ? 'Later this month' : 'Earlier this month';
  return day.toLocaleDateString(undefined, {
    month: 'long',
    year: day.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** Runs of tickets in a row that share a heading, so the list keeps its sorted order. A group is never empty. */
export function groupInRuns<T>(items: T[], labelOf: (t: T) => string | undefined) {
  const groups: { label?: string; start: number; items: T[] }[] = [];
  items.forEach((t, i) => {
    const label = labelOf(t);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, start: i, items: [t] });
  });
  return groups;
}
