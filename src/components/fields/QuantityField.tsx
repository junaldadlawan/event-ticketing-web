import { useEffect, useState } from 'react';

/**
 * A whole number set with − and + or typed (tickets in the cart, on the event page, a limit). `value` is the committed
 * number; `onCommit` gets a new one when it changes: a click on − / +, or Enter / leaving the box after typing. Typed
 * numbers are capped at `max`; one below `min` goes to `onBelowMin` (the cart asks to remove the line) or becomes `min`.
 */
export function QuantityField({
  value,
  onCommit,
  min = 1,
  max,
  disabled,
  onBelowMin,
  moreDisabled,
  label = 'Number of tickets',
  lessLabel = 'One fewer',
  moreLabel = 'One more',
  removeLabel = 'Remove',
}: {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** What − (or typing under the minimum) does at the lowest number; without it − is disabled there. */
  onBelowMin?: () => void;
  /** An extra reason + is off (for example nothing left to add). */
  moreDisabled?: boolean;
  label?: string;
  lessLabel?: string;
  moreLabel?: string;
  /** The − button's name at the lowest number when `onBelowMin` is given. */
  removeLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  // What the owner says the number is wins over what was typed.
  useEffect(() => setText(String(value)), [value]);

  function commitTyped() {
    const typed = Math.floor(Number(text));
    if (text.trim() === '' || Number.isNaN(typed)) return setText(String(value));
    const n = Math.min(typed, max ?? Infinity);
    if (n < min) {
      setText(String(value));
      if (onBelowMin) onBelowMin();
      else if (min !== value) onCommit(min);
      return;
    }
    setText(String(value)); // shows the number in use until the owner confirms a new one
    if (n !== value) onCommit(n);
  }

  return (
    <span className="qty-stepper" role="group" aria-label="Quantity">
      <button
        type="button"
        className="btn btn-sm"
        aria-label={value <= min && onBelowMin ? removeLabel : lessLabel}
        disabled={disabled || (value <= min && !onBelowMin)}
        onClick={() => (value <= min ? onBelowMin?.() : onCommit(value - 1))}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="qty-input"
        aria-label={label}
        min={onBelowMin ? 0 : min}
        max={max}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget.blur(); // the blur commits it
        }}
        onBlur={commitTyped}
      />
      <button
        type="button"
        className="btn btn-sm"
        aria-label={moreLabel}
        disabled={disabled || moreDisabled || (max !== undefined && value >= max)}
        onClick={() => onCommit(value + 1)}
      >
        +
      </button>
    </span>
  );
}
