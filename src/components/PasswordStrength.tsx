import { checkPassword } from '../utils/passwordStrength';
import { InfoIcon } from './DesignerIcons';

/**
 * Live feedback under a "new password" field: a four-step strength bar and one tip. The checklist of what makes a
 * good password sits in an info icon (hover, or focus with the keyboard / a tap). Advice only: it never blocks the form.
 */
export function PasswordStrength({ password, avoid = [] }: { password: string; avoid?: string[] }) {
  const report = checkPassword(password, avoid);

  return (
    <div className="pw-info">
      <div className="pw-meter" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={report.level >= step ? `on level-${report.level}` : ''} />
        ))}
      </div>
      <div className="pw-line">
        <p className="pw-status" aria-live="polite">
          {report.level === 0 ? (
            'Use at least 8 characters. A longer password is stronger.'
          ) : (
            <>
              <strong className={`level-${report.level}`}>{report.label}</strong>
              {report.tip && <span> {report.tip}</span>}
            </>
          )}
        </p>
        <span className="pw-tip">
          <button type="button" className="pw-tip-button" aria-label="What makes a good password?">
            <InfoIcon />
          </button>
          <span className="pw-pop" role="tooltip">
            <strong>A good password has</strong>
            <ul className="pw-checks">
              {report.checks.map((c) => (
                <li key={c.label} className={c.ok ? 'ok' : ''}>
                  <span aria-hidden="true">{c.ok ? '✓' : '○'}</span>
                  {c.label}
                  <span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span>
                </li>
              ))}
            </ul>
            <small>Longer is stronger. A few random words in a row works well.</small>
          </span>
        </span>
      </div>
    </div>
  );
}
