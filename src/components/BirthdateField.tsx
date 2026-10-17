import { useState } from 'react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const parse = (value: string) => {
  const [y = '', m = '', d = ''] = value.split('-');
  return { year: y, month: m ? String(Number(m)) : '', day: d ? String(Number(d)) : '' };
};

/**
 * A birthdate as three dropdowns (month, day, year): quicker than paging a calendar back through the years.
 * `value` / `onChange` use YYYY-MM-DD, or '' while any part is still empty.
 */
export function BirthdateField({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [parts, setParts] = useState(() => parse(value));
  const thisYear = new Date().getFullYear();

  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    // Keep the day valid for the month (31 -> 30 -> 28/29) once month and year are known.
    const daysIn = merged.month ? new Date(Number(merged.year) || 2000, Number(merged.month), 0).getDate() : 31;
    if (merged.day && Number(merged.day) > daysIn) merged.day = String(daysIn);
    setParts(merged);
    const pad = (n: string) => n.padStart(2, '0');
    onChange(merged.year && merged.month && merged.day ? `${merged.year}-${pad(merged.month)}-${pad(merged.day)}` : '');
  }

  const daysInMonth = parts.month ? new Date(Number(parts.year) || 2000, Number(parts.month), 0).getDate() : 31;

  return (
    <div className="birth-row" role="group" aria-label="Birthdate">
      <select
        value={parts.month}
        required={required}
        autoComplete="bday-month"
        aria-label="Month"
        onChange={(e) => update({ month: e.target.value })}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={parts.day}
        required={required}
        autoComplete="bday-day"
        aria-label="Day"
        onChange={(e) => update({ day: e.target.value })}
      >
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>
            {i + 1}
          </option>
        ))}
      </select>
      <select
        value={parts.year}
        required={required}
        autoComplete="bday-year"
        aria-label="Year"
        onChange={(e) => update({ year: e.target.value })}
      >
        <option value="">Year</option>
        {Array.from({ length: 121 }, (_, i) => thisYear - i).map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
