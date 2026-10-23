import type { FocusEventHandler, ReactNode } from 'react';
import { MINUTES, StepSelect, TimeField } from '../TimeField';
import { Field } from './Field';

/** A date and a time side by side on one line at every width (event start / end, ticket sale start / end). */
export function DateTimeField({
  dateLabel,
  timeLabel,
  date,
  time,
  onDate,
  onTime,
  required,
  disabled,
  dateDisabled,
  dateTitle,
  minDate,
  maxDate,
  timeKey,
  onBlur,
}: {
  dateLabel: ReactNode;
  timeLabel: ReactNode;
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  required?: boolean;
  /** Both boxes. */
  disabled?: boolean;
  /** Only the date (a same-day event's end date follows its start). */
  dateDisabled?: boolean;
  dateTitle?: string;
  minDate?: string;
  maxDate?: string;
  /** A new key clears a half-picked time (the time picker is remounted). */
  timeKey?: string;
  /** Fires when focus leaves the row (to check the pair together). */
  onBlur?: FocusEventHandler<HTMLDivElement>;
}) {
  return (
    <div className="date-time-row" onBlur={onBlur}>
      <Field label={dateLabel} required={required}>
        <input
          type="date"
          required={required}
          disabled={disabled || dateDisabled}
          title={dateTitle}
          min={minDate}
          max={maxDate}
          value={date}
          onChange={(e) => onDate(e.target.value)}
        />
      </Field>
      <Field label={timeLabel} required={required}>
        <TimeField key={timeKey} value={time} onChange={onTime} disabled={disabled} />
      </Field>
    </div>
  );
}

/** "Gates open 1 hr 30 min before": an hour box and a minute box that may both stay empty, with a Clear link. */
export function HourMinuteField({
  label,
  hint,
  optional,
  hourOptions,
  hours,
  minutes,
  onHours,
  onMinutes,
  disabled,
  onClear,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  hourOptions: string[];
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
  disabled?: boolean;
  /** Shows Clear when given. */
  onClear?: () => void;
}) {
  return (
    <Field label={label} hint={hint} optional={optional}>
      <span className="time-field gate-field">
        <StepSelect label="Hours" placeholder="--" options={hourOptions} value={hours} onChange={onHours} disabled={disabled} required={false} />
        <span className="muted small">hr</span>
        <StepSelect label="Minutes" placeholder="--" options={MINUTES} value={minutes} onChange={onMinutes} disabled={disabled} required={false} />
        <span className="muted small">min</span>
        {onClear && (
          <button type="button" className="btn-link" onClick={onClear}>
            Clear
          </button>
        )}
      </span>
    </Field>
  );
}
