import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'cta' | 'danger' | 'link';

const CLASS: Record<Variant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn',
  cta: 'btn btn-cta',
  danger: 'btn btn-danger',
  link: 'btn-link',
};

/**
 * The one button. primary = the main action of a form or window, secondary = Cancel and everything else, cta = the loud
 * page action ("New event"), danger = a filled red confirm (delete, reject), link = a quiet text action. While `busy` it is off
 * and shows `busyLabel`. It is type="button" unless it is a form's submit.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  busy,
  busyLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: {
  variant?: Variant;
  size?: 'sm' | 'md';
  busy?: boolean;
  busyLabel?: ReactNode;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const classes = [CLASS[variant], size === 'sm' && variant !== 'link' ? 'btn-sm' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

/** A round icon-only button; the label is both its tooltip and what a screen reader says. */
export function IconButton({
  label,
  danger,
  className,
  children,
  type = 'button',
  ...rest
}: { label: string; danger?: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>) {
  const classes = ['icon-button', danger ? 'icon-button-danger' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={classes} title={label} aria-label={label}>
      {children}
    </button>
  );
}

/**
 * The bottom row of a form window: Cancel and the main button (with its busy label), and an optional extra at the start
 * (a danger "Remove"). The main button submits the surrounding form.
 */
export function FormActions({
  submitLabel,
  busyLabel,
  busy,
  submitDisabled,
  submitTitle,
  onCancel,
  cancelLabel = 'Cancel',
  variant = 'primary',
  start,
}: {
  submitLabel: ReactNode;
  busyLabel?: ReactNode;
  busy?: boolean;
  submitDisabled?: boolean;
  /** Why the main button is off (shown as its tooltip). */
  submitTitle?: string;
  /** Without it there is no Cancel button. */
  onCancel?: () => void;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  start?: ReactNode;
}) {
  return (
    <div className="modal-actions">
      {start}
      {onCancel && (
        <Button disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" variant={variant} busy={busy} busyLabel={busyLabel} disabled={submitDisabled} title={submitTitle}>
        {submitLabel}
      </Button>
    </div>
  );
}
