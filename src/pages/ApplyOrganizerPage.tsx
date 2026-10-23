import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { organizationApi } from '../api/endpoints';
import { DOCUMENT_TYPES } from '../utils/orgFields';
import { useAsync } from '../utils/useAsync';
import type { Organization, OrganizationDocument } from '../api/types';
import { ErrorBox, StatusBadge, PageHeader, Spinner } from '../components/ui';
import { CONTACT_EMAIL, CONTACT_PHONE, telHref } from '../config';


/** Apply to host events. Someone whose application is still pending sees it here to edit and resubmit instead of a blank form. */
export function ApplyOrganizerPage() {
  const mine = useAsync(async () => (await organizationApi.mine()).find((o) => o.status === 'PENDING') ?? null, []);
  if (mine.loading && mine.data === null) return <Spinner />;
  return <ApplicationForm key={mine.data?.id ?? 'new'} existing={mine.data ?? undefined} />;
}

function ApplicationForm({ existing }: { existing?: Organization }) {
  const [name, setName] = useState(existing?.name ?? '');
  // Optional details; they become the organization's first values, and an admin sees them when reviewing.
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [documents, setDocuments] = useState<OrganizationDocument[]>(
    existing?.documents.length ? existing.documents.map((d) => ({ ...d })) : [{ type: DOCUMENT_TYPES[0], url: '' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<Organization | null>(null);

  function updateDoc(index: number, patch: Partial<OrganizationDocument>) {
    setDocuments((docs) => docs.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const docs = documents.map((d) => ({ type: d.type.trim(), url: d.url.trim() }));
      const details = Object.fromEntries(
        Object.entries({ contactEmail, contactPhone, address, description })
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v),
      );
      // Editing sends every field (an empty one clears it); a new application only the ones that were filled in.
      setSubmitted(
        existing
          ? await organizationApi.editApplication(existing.id, {
              name: name.trim(),
              contactEmail: contactEmail.trim(),
              contactPhone: contactPhone.trim(),
              address: address.trim(),
              description: description.trim(),
              documents: docs,
            })
          : await organizationApi.apply(name.trim(), docs, details),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="narrow">
        <PageHeader title={existing ? 'Application updated' : 'Application sent'} />
        <p>
          {existing && 'The admins have been told. '}Thanks! <strong>{submitted.name}</strong> is now <StatusBadge status={submitted.status} />.
          An admin will review your documents. Once approved, a Manage tab appears at the top and you can create
          events from there.
        </p>
      </div>
    );
  }

  return (
    <div className="narrow">
      <PageHeader
        title={existing ? 'Your application' : 'Host your own events'}
        lede={
          <>
            Tell us about your organization and attach at least one verification document. An admin
            reviews every application before you can publish events.
            {(CONTACT_EMAIL || CONTACT_PHONE) && (
              <>
                {' '}
                Questions? Contact us at{' '}
                {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
                {CONTACT_EMAIL && CONTACT_PHONE && ' or '}
                {CONTACT_PHONE && <a href={telHref(CONTACT_PHONE)}>{CONTACT_PHONE}</a>}.
              </>
            )}
          </>
        }
      />
      {existing?.revisionRequested && (
        <p className="alert alert-warning" role="status">
          An admin asked you to change your application: {existing.revisionMessage}
        </p>
      )}
      <ErrorBox message={error} />
      <form className="form" onSubmit={onSubmit}>
        <label>
          Organization name
          <input required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          About the organization <span className="hint">(optional)</span>
          <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <fieldset className="fieldset">
          <legend>Contact details</legend>
          <p className="hint">Optional. An admin sees these when reviewing your application, and you can ask to change them later in Settings.</p>
          <label>
            Contact email
            <input type="email" maxLength={255} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </label>
          <label>
            Contact phone
            <input type="tel" maxLength={30} pattern="[0-9 +()\-.]*" title="Digits, spaces and + ( ) - ." value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </label>
          <label>
            Address
            <input maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Verification documents</legend>
          <p className="hint">Link to each document (e.g. a shared file URL).</p>
          {documents.map((doc, i) => (
            <div key={i} className="doc-row">
              <select
                aria-label={`Document ${i + 1} type`}
                value={doc.type}
                onChange={(e) => updateDoc(i, { type: e.target.value })}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="url"
                required
                maxLength={500}
                placeholder="https://..."
                aria-label={`Document ${i + 1} URL`}
                value={doc.url}
                onChange={(e) => updateDoc(i, { url: e.target.value })}
              />
              {documents.length > 1 && (
                <button
                  type="button"
                  className="btn btn-link danger"
                  aria-label={`Remove document ${i + 1}`}
                  onClick={() => setDocuments((docs) => docs.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-link"
            onClick={() => setDocuments((docs) => [...docs, { type: DOCUMENT_TYPES[0], url: '' }])}
          >
            + Add another document
          </button>
        </fieldset>

        <button className="btn btn-cta" disabled={busy}>
          {busy ? 'Submitting...' : existing ? 'Save and resubmit' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}
