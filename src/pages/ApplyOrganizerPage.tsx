import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { organizationApi } from '../api/endpoints';
import { DOCUMENT_TYPES } from '../utils/orgFields';
import { useAsync } from '../utils/useAsync';
import type { Organization } from '../api/types';
import { Button } from '../components/Button';
import { DocumentRows } from '../components/fields/DocumentRows';
import type { DocRow } from '../components/fields/DocumentRows';
import { FieldGroup } from '../components/fields/Field';
import { SelectField, TextAreaField, TextField } from '../components/fields/TextField';
import { ErrorBox, StatusBadge, PageHeader, Spinner } from '../components/ui';
import { usePlatformRegions } from '../utils/usePlatformRegions';
import { CONTACT_EMAIL, CONTACT_PHONE, telHref } from '../config';


/** Apply to host events. Someone whose application is still pending sees it here to edit and resubmit instead of a blank form. */
export function ApplyOrganizerPage({ embedded = false }: { embedded?: boolean }) {
  const mine = useAsync(async () => (await organizationApi.mine()).find((o) => o.status === 'PENDING') ?? null, []);
  if (mine.loading && mine.data === null) return <Spinner />;
  return <ApplicationForm key={mine.data?.id ?? 'new'} existing={mine.data ?? undefined} embedded={embedded} />;
}

function ApplicationForm({ existing, embedded }: { existing?: Organization; embedded: boolean }) {
  const [name, setName] = useState(existing?.name ?? '');
  // The country decides the currency the organization sells in; only the countries the admin enabled can be picked.
  const { regions } = usePlatformRegions();
  const [country, setCountry] = useState(existing?.country ?? '');
  const chosen = regions?.countries.find((c) => c.code === country);
  // Optional details; they become the organization's first values, and an admin sees them when reviewing.
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [documents, setDocuments] = useState<DocRow[]>(
    existing?.documents.length ? existing.documents.map((d) => ({ ...d })) : [{ type: DOCUMENT_TYPES[0], url: '' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<Organization | null>(null);

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
              country,
              contactEmail: contactEmail.trim(),
              contactPhone: contactPhone.trim(),
              address: address.trim(),
              description: description.trim(),
              documents: docs,
            })
          : await organizationApi.apply(name.trim(), docs, { country, ...details }),
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
    <div className={embedded ? undefined : 'narrow'}>
      {!embedded && (
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
      )}
      {existing?.revisionRequested && (
        <p className="alert alert-warning" role="status">
          An admin asked you to change your application: {existing.revisionMessage}
        </p>
      )}
      <ErrorBox message={error} />
      <form className="form" onSubmit={onSubmit}>
        <TextField label="Organization name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField
          label="Country"
          required
          hint={chosen ? `You will sell tickets in ${chosen.currencyCode}.` : 'Decides the currency you sell tickets in.'}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">Choose a country</option>
          {/* An application already on file keeps its country even if the admin has since turned it off. */}
          {country && !chosen && <option value={country}>{country}</option>}
          {(regions?.countries ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField label="About the organization" optional rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />

        <FieldGroup legend="Contact details" hint="Optional. An admin sees these when reviewing your application, and you can ask to change them later in Settings.">
          <TextField label="Contact email" type="email" maxLength={255} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <TextField
            label="Contact phone"
            type="tel"
            maxLength={30}
            pattern="[0-9 +()\-.]*"
            title="Digits, spaces and + ( ) - ."
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <TextField label="Address" maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
        </FieldGroup>

        <FieldGroup legend="Verification documents" hint="Link to each document (e.g. a shared file URL).">
          <DocumentRows docs={documents} onChange={setDocuments} allowRemove />
        </FieldGroup>

        <Button type="submit" variant="cta" busy={busy} busyLabel="Submitting...">
          {existing ? 'Save and resubmit' : 'Submit application'}
        </Button>
      </form>
    </div>
  );
}
