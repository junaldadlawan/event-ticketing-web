import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { Button } from '../components/Button';
import { CONTACT_EMAIL, CONTACT_PHONE, telHref } from '../config';
import { ApplyOrganizerPage } from './ApplyOrganizerPage';

const STEPS = [
  { title: 'Contact us', text: 'Tell us about your organization and the events you plan to run. We reply with what to send.' },
  { title: 'Send your application', text: 'Fill in the form below with your organization details and verification documents.' },
  { title: 'Get approved', text: 'Our team reviews every application. Once approved, you can create events and sell tickets.' },
];

/** Public company page: who approves organizers, how to reach us, and the organizer application form. */
export function ContactPage() {
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  return (
    <div className="about">
      <section className="about-hero">
        <h1>Host with us. Every organizer is approved by our team.</h1>
        <p>
          Hosting events on this platform needs our company's approval. Contact us first, share your details, and we will
          guide you through the application so your events can go on sale.
        </p>
        <div className="about-hero-actions">
          {CONTACT_EMAIL && (
            <a className="btn btn-cta btn-lg" href={`mailto:${CONTACT_EMAIL}?subject=Organizer%20approval`}>
              Email us
            </a>
          )}
          {CONTACT_PHONE && (
            <a className="btn btn-invert" href={telHref(CONTACT_PHONE)}>
              Call {CONTACT_PHONE}
            </a>
          )}
        </div>
      </section>

      <section className="about-grid">
        <div>
          <h2>Why we approve organizers</h2>
          <p className="about-lede">
            Buyers trust that every event listed here is run by a verified organization. We check who you are before you
            publish, so tickets are genuine and payouts go to the right people.
          </p>
          <ol className="about-steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside className="about-contact" aria-label="Contact details">
          <h2>Get in touch</h2>
          <p className="muted">Send us your organization name, what you plan to host, and the best way to reach you.</p>
          {CONTACT_EMAIL && (
            <p>
              <span className="about-label">Email</span>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          )}
          {CONTACT_PHONE && (
            <p>
              <span className="about-label">Phone or text</span>
              <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>
            </p>
          )}
        </aside>
      </section>

      <section className="about-apply" id="apply">
        <h2>Organization application</h2>
        <p className="about-lede">
          Already talked to us? Send your application here. An admin reviews it and you will see the result on your account.
        </p>
        {user ? (
          <ApplyOrganizerPage embedded />
        ) : (
          <div className="about-login">
            <p>Log in or create an account to send your application.</p>
            <Button variant="cta" onClick={() => openAuth('login', '/contact')}>
              Log in to apply
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
