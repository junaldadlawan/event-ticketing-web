import { useRef, useState } from 'react';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const HALVES = ['AM', 'PM'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "13:05" -> { hour: "1", minute: "05", half: "PM" }; "" -> no hour or minute yet, AM (the dropdown has no blank). */
function timeParts(value: string): { hour: string; minute: string; half: string } {
  if (!value) return { hour: '', minute: '', half: 'AM' };
  const [h, m] = value.split(':').map(Number);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: pad2(m), half: h < 12 ? 'AM' : 'PM' };
}

/**
 * A time as hour, minute and AM / PM dropdowns, each with its own up / down arrows. `value` is "HH:mm" (24-hour), or ""
 * until the hour and minute are chosen.
 */
export function TimeField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  // The parts live here so a half-picked time (hour chosen, minute not yet) is kept while value is still "".
  const [parts, setParts] = useState(() => timeParts(value));
  // A value set from outside (cleared, or filled in by the form) replaces the parts shown. The value this picker
  // last produced itself is remembered, so a half-picked time is not wiped while its value is still "".
  const produced = useRef(value);
  if (value !== produced.current) {
    produced.current = value;
    const next = timeParts(value);
    if (next.hour !== parts.hour || next.minute !== parts.minute || next.half !== parts.half) setParts(next);
  }
  function pick(next: Partial<typeof parts>) {
    const p = { ...parts, ...next };
    setParts(p);
    if (!p.hour || !p.minute || !p.half) return onChange('');
    const h = (Number(p.hour) % 12) + (p.half === 'PM' ? 12 : 0);
    onChange(`${pad2(h)}:${p.minute}`);
  }
  return (
    <span className="time-field">
      <StepSelect label="Hour" placeholder="--" options={HOURS} value={parts.hour} onChange={(hour) => pick({ hour })} disabled={disabled} />
      <StepSelect label="Minute" placeholder="--" options={MINUTES} value={parts.minute} onChange={(minute) => pick({ minute })} disabled={disabled} />
      <StepSelect label="AM or PM" options={HALVES} value={parts.half} onChange={(half) => pick({ half })} disabled={disabled} />
    </span>
  );
}

/** A dropdown with up / down arrows beside it that move to the next / previous option, wrapping around at the ends. */
function StepSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  /** Shown while nothing is chosen; without one the first option is the starting value. */
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  function step(by: number) {
    const i = options.indexOf(value);
    // Nothing chosen yet: up starts at the first option, down at the last.
    const next = i < 0 ? (by > 0 ? 0 : options.length - 1) : (i + by + options.length) % options.length;
    onChange(options[next]);
  }
  return (
    <span className="time-part">
      <select required disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="time-steps">
        <button type="button" disabled={disabled} aria-label={`${label} up`} onClick={() => step(1)}>
          <svg viewBox="0 0 10 6" aria-hidden="true">
            <path d="M1 5l4-4 4 4" />
          </svg>
        </button>
        <button type="button" disabled={disabled} aria-label={`${label} down`} onClick={() => step(-1)}>
          <svg viewBox="0 0 10 6" aria-hidden="true">
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
      </span>
    </span>
  );
}
