import { useState } from 'react';
import { FormActions, IconButton } from './Button';
import { DocumentRows } from './fields/DocumentRows';
import type { DocRow } from './fields/DocumentRows';
import { FieldGroup } from './fields/Field';
import { SelectField, TextAreaField, TextField } from './fields/TextField';
import { SettingRow } from './SettingsLayout';
import type { FormEvent } from 'react';
import { assetUrl, errorMessage } from '../api/client';
import { organizationApi } from '../api/endpoints';
import type { OrganizationDocument, OrganizationUpdate } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useHasPermission } from '../auth/useCanManage';
import { formatDateTime } from '../utils/format';
import { usePlatformRegions } from '../utils/usePlatformRegions';
import { ORG_FIELDS } from '../utils/orgFields';
import { useAsync } from '../utils/useAsync';
import { EditIcon } from './DesignerIcons';
import { FormDialog } from './FormDialog';
import { OrgChangeLines } from './OrgChangeLines';
import { ErrorBox, SuccessBox, Spinner } from './ui';

/**
 * An organization's details. The owner (or an organizer with Team) edits them, but an edit only asks: an admin approves it
 * first, and the details shown stay as they were until then. One request waits at a time; a new one replaces it.
 */
export function OrganizationDetails({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const canEdit = useHasPermission('TEAM', orgId);
  const org = useAsync(() => organizationApi.get(orgId), [orgId]);
  const { regions } = usePlatformRegions();
  const requests = useAsync(() => organizationApi.changeRequests(orgId), [orgId]);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  // The documents in the edit window; a row is read-only until Change is pressed (a new one starts open).
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const o = org.data;
  const all = requests.data ?? [];
  const pending = all.find((r) => r.status === 'PENDING');
  const decided = all.filter((r) => r.status !== 'PENDING').slice(0, 5);
  const current = (key: string) => (o ? ((o as unknown as Record<string, string | null | undefined>)[key] ?? '') : '');

  function startEdit() {
    // A waiting request is replaced by the new one, so start from its values and keep them.
    const start: Record<string, string> = {};
    for (const f of ORG_FIELDS) start[f.key] = pending && typeof pending.requested[f.key] === 'string' ? (pending.requested[f.key] as string) : pending && f.key in pending.requested ? '' : current(f.key);
    start.country = pending && typeof pending.requested.country === 'string' ? pending.requested.country : current('country');
    setValues(start);
    // A waiting request that changes the documents is the starting point too (it is replaced by the new one).
    const waitingDocs = pending?.requested.documents;
    setDocs((Array.isArray(waitingDocs) ? waitingDocs : (o?.documents ?? [])).map((d) => ({ ...d, edit: false })));
    setErr(null);
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const changed: OrganizationUpdate = {};
    for (const f of ORG_FIELDS) if (values[f.key].trim() !== current(f.key)) changed[f.key] = values[f.key].trim();
    if (values.country && values.country !== current('country')) changed.country = values.country;
    // Documents go along only when they differ from the ones on file.
    const nextDocs = docs.filter((d) => d.url.trim()).map((d) => ({ type: d.type, url: d.url.trim() }));
    if (JSON.stringify(nextDocs) !== JSON.stringify(o?.documents.map((d) => ({ type: d.type, url: d.url })) ?? [])) changed.documents = nextDocs;
    if (Object.keys(changed).length === 0) {
      setErr('Nothing to change: the details are the same as now.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await organizationApi.requestChange(orgId, changed);
      setEditing(false);
      setMsg('Sent for approval. The details change once an admin approves it.');
      requests.reload();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!pending) return;
    setErr(null);
    setMsg(null);
    try {
      await organizationApi.withdrawChange(orgId, pending.id);
      setMsg('Request withdrawn.');
      requests.reload();
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  if (org.loading && !o) return <Spinner />;

  return (
    <>
      <div className="org-heading">
        <h2>Organization</h2>
        {canEdit && (
          <IconButton label="Edit details" onClick={startEdit} disabled={!o}>
            <EditIcon />
          </IconButton>
        )}
      </div>
      <ErrorBox message={org.error ?? requests.error ?? (editing ? null : err)} />
      <SuccessBox message={msg} />
      <dl className="org-details">
        {ORG_FIELDS.map((f) => (
          <SettingRow key={f.key} label={f.label}>
            {current(f.key) || <span className="muted">Not set</span>}
          </SettingRow>
        ))}
        <SettingRow label="Country">{regions?.countries.find((c) => c.code === current('country'))?.name ?? (current('country') || <span className="muted">Not set</span>)}</SettingRow>
        <SettingRow label="Currency">{o?.currency ?? <span className="muted">Set when an admin approves it</span>}</SettingRow>
        {/* The verification documents (the business permit...): shown, not editable here; the API does not take new ones for an approved organization. */}
        <SettingRow label="Documents">
          <DocumentLinks documents={o?.documents ?? []} />
        </SettingRow>
      </dl>
      {!canEdit && <p className="muted small">Only the owner, or an organizer allowed to manage the team, can ask to change these.</p>}

      {pending && (
        <section className="org-pending" aria-label="Change waiting for approval">
          <h3>Waiting for approval</h3>
          <p className="muted small">Asked {formatDateTime(pending.createdAt)}. The details above stay as they are until an admin approves it.</p>
          <OrgChangeLines request={pending} />
          {pending.requestedBy === user?.id && (
            <button type="button" className="btn btn-sm" onClick={() => void withdraw()}>
              Withdraw request
            </button>
          )}
        </section>
      )}

      {decided.length > 0 && (
        <section aria-label="Earlier requests">
          <h3>Earlier requests</h3>
          <ul className="plain-list">
            {decided.map((r) => (
              <li key={r.id} className="org-decided">
                <strong>{r.status === 'APPROVED' ? 'Approved' : 'Rejected'}</strong>{' '}
                <span className="muted small">{formatDateTime(r.decidedAt ?? r.createdAt)}</span>
                <OrgChangeLines request={r} />
                {r.rejectionReason && <p className="small">Reason: {r.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormDialog open={editing} title="Edit organization details" onClose={() => setEditing(false)}>
        <form className="form" onSubmit={save}>
          <p className="small muted">
            An admin has to approve a change before it shows. {pending ? 'This replaces your request that is waiting. ' : ''}Leave a field empty to clear it.
          </p>
          <TextField label="Name" required maxLength={255} value={values.name ?? ''} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          <TextField label="Contact email" type="email" maxLength={255} value={values.contactEmail ?? ''} onChange={(e) => setValues({ ...values, contactEmail: e.target.value })} />
          <TextField label="Contact phone" type="tel" maxLength={30} value={values.contactPhone ?? ''} onChange={(e) => setValues({ ...values, contactPhone: e.target.value })} />
          <TextField label="Address" maxLength={500} value={values.address ?? ''} onChange={(e) => setValues({ ...values, address: e.target.value })} />
          <SelectField label="Country" hint="The currency stays the one you were approved with." value={values.country ?? ''} onChange={(e) => setValues({ ...values, country: e.target.value })}>
            {values.country && !regions?.countries.some((c) => c.code === values.country) && <option value={values.country}>{values.country}</option>}
            {(regions?.countries ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextAreaField label="Description" rows={4} maxLength={2000} value={values.description ?? ''} onChange={(e) => setValues({ ...values, description: e.target.value })} />
          <FieldGroup legend="Verification documents" hint="Link to each document (e.g. a shared file URL). Like the other details, a change waits for an admin.">
            <DocumentRows docs={docs} onChange={setDocs} />
          </FieldGroup>
          <ErrorBox message={editing ? err : null} />
          <FormActions onCancel={() => setEditing(false)} busy={busy} busyLabel="Sending…" submitLabel="Send for approval" />
        </form>
      </FormDialog>
    </>
  );
}

/** The organization's verification documents (the business permit...) as links. */
function DocumentLinks({ documents }: { documents: OrganizationDocument[] }) {
  if (documents.length === 0) return <span className="muted">None</span>;
  return (
    <>
      {documents.map((d, i) => (
        <span key={`${d.url}-${i}`}>
          {i > 0 && ', '}
          <a href={assetUrl(d.url)} target="_blank" rel="noreferrer">
            {d.type}
          </a>
        </span>
      ))}
    </>
  );
}
