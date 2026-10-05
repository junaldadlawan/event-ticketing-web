import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { eventApi, venueApi } from '../../api/endpoints';
import { ErrorBox } from '../../components/ui';
import { localInputToIso } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CreateEventPage() {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [images, setImages] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // There is no "my organizations" endpoint for non-admins, so suggest the
  // org ids seen on events the caller already manages.
  const { data: knownOrgIds } = useAsync(
    () =>
      eventApi
        .managed({ size: 100 })
        .then((p) => [...new Set(p.content.map((e) => e.organizationId))])
        .catch(() => [] as string[]),
    [],
  );

  const orgValid = UUID_RE.test(organizationId.trim());
  const { data: venues } = useAsync(
    () => (orgValid ? venueApi.listForOrg(organizationId.trim()) : Promise.resolve([])),
    [orgValid, organizationId],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const imageList = images
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await eventApi.create({
        organizationId: organizationId.trim(),
        title,
        description,
        category,
        venueId: venueId || undefined,
        startAt: localInputToIso(startAt),
        endAt: localInputToIso(endAt),
        timezone,
        images: imageList.length ? imageList : undefined,
      });
      navigate(`/manage/events/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>New event</h1>
      <ErrorBox message={error} />
      <form className="form card narrow" onSubmit={onSubmit}>
        <label>
          Organization ID
          <input
            required
            list="known-orgs"
            placeholder="UUID of an organization you own or organize for"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          />
          <datalist id="known-orgs">
            {knownOrgIds?.map((id) => <option key={id} value={id} />)}
          </datalist>
        </label>
        <label>
          Title
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Description
          <textarea
            required
            maxLength={2000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Category
          <input
            required
            maxLength={100}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label>
          Venue
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">Online / no venue</option>
            {venues?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.address}
              </option>
            ))}
          </select>
        </label>
        <div className="two-col">
          <label>
            Starts
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
        </div>
        <label>
          Timezone
          <input required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
        <label>
          Image URLs <span className="hint">(one per line, optional)</span>
          <textarea rows={2} value={images} onChange={(e) => setImages(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating...' : 'Create draft event'}
        </button>
      </form>
    </>
  );
}
