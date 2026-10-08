import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { organizationApi } from '../api/endpoints';
import type { Organization, OrganizationDocument } from '../api/types';
import { ErrorBox, StatusBadge } from '../components/ui';
import { CONTACT_EMAIL, CONTACT_PHONE, telHref } from '../config';

const DOCUMENT_TYPES = ['Business permit', 'Government ID', 'Tax registration', 'Other'];

export function ApplyOrganizerPage() {
  const [name, setName] = useState('');
  const [documents, setDocuments] = useState<OrganizationDocument[]>([
    { type: DOCUMENT_TYPES[0], url: '' },
  ]);
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
      setSubmitted(await organizationApi.apply(name.trim(), docs));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="narrow">
        <h1>Application sent</h1>
        <p>
          Thanks! <strong>{submitted.name}</strong> is now <StatusBadge status={submitted.status} />.
          An admin will review your documents. Once approved you can create events from{' '}
          <Link to="/manage">Manage</Link>.
        </p>
        <p className="muted small">
          Keep your organization ID, you'll need it when creating events:{' '}
          <code>{submitted.id}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1>Host your own events</h1>
      <p className="muted">
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
      </p>
      <ErrorBox message={error} />
      <form className="form" onSubmit={onSubmit}>
        <label>
          Organization name
          <input required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

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
          {busy ? 'Submitting...' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}
