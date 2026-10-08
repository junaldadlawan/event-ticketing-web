import { Link } from 'react-router-dom';
import { useIsHost } from '../auth/useCanManage';
import { CONTACT_EMAIL, CONTACT_PHONE, telHref } from '../config';

/**
 * "Host your own event" call-to-action shown under the events list - only to
 * people who don't host yet (customers and logged-out visitors). Hidden for
 * admins and organization owners/organizers, and while that's being checked.
 */
export function HostCta() {
  const isHost = useIsHost();
  const hasContact = Boolean(CONTACT_EMAIL || CONTACT_PHONE);
  if (isHost !== false) return null;
  return (
    <section className="host-cta" aria-labelledby="host-cta-title">
      <div>
        <h2 id="host-cta-title">Wanna host your own event?</h2>
        <p className="muted">
          Apply as an organizer to create events and sell tickets
          {hasContact ? ', or get in touch if you have questions.' : '.'}
        </p>
        {CONTACT_PHONE && (
          <p className="muted small host-cta-phone">
            Call or text <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>
          </p>
        )}
      </div>
      <div className="host-cta-actions">
        <Link to="/apply" className="btn btn-cta">
          Apply now
        </Link>
        {CONTACT_EMAIL && (
          <a href={`mailto:${CONTACT_EMAIL}?subject=Hosting%20an%20event`} className="btn">
            Contact us
          </a>
        )}
      </div>
    </section>
  );
}
