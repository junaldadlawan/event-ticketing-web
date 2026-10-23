import type { ReactNode } from 'react';

/**
 * One label, one control, an optional hint and an error: the one way every form field is laid out. A required field gets
 * the red asterisk, an optional one the quiet "(optional)". The control goes inside, so the label is tied to it.
 */
export function Field({
  label,
  hint,
  optional,
  required,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  required?: boolean;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field${className ? ` ${className}` : ''}`}>
      <span className="field-label">
        {label}
        {required && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="hint"> (optional)</span>}
      </span>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/** Several controls that belong to one question (a date and a time, hours and minutes): a fieldset with a legend. */
export function FieldGroup({ legend, hint, children }: { legend: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="fieldset field-group">
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </fieldset>
  );
}
