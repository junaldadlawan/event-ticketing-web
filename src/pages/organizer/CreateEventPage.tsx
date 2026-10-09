import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { eventApi, organizationApi, venueApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { CategorySelect } from '../../components/CategorySelect';
import { SuspendedOrgNotice } from '../../components/SuspendedOrgNotice';
import { Empty, ErrorBox, Spinner } from '../../components/ui';
import { localInputToIso } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

/** The organizations the signed-in user can create events for (id + name). */
async function loadMyOrganizations(isAdmin: boolean): Promise<{ id: string; name: string }[]> {
  if (isAdmin) return (await organizationApi.list('APPROVED')).map(({ id, name }) => ({ id, name }));
  // Only approved organizations can host events (a suspended or pending one cannot).
  return (await organizationApi.mine()).filter((o) => o.status === 'APPROVED').map(({ id, name }) => ({ id, name }));
}

export function CreateEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orgChoice, setOrgChoice] = useState('');
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

  const orgs = useAsync(() => loadMyOrganizations(user?.role === 'ADMIN'), [user?.role]);
  // One organization is used silently; with several, the first is preselected and a name dropdown is shown.
  const organizationId = orgChoice || orgs.data?.[0]?.id || '';
  const { data: venues } = useAsync(
    () => (organizationId ? venueApi.listForOrg(organizationId) : Promise.resolve([])),
    [organizationId],
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
        organizationId,
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
      {orgs.loading && !orgs.data ? (
        <Spinner />
      ) : orgs.data?.length === 0 ? (
        <Empty>
          <SuspendedOrgNotice organizationIds={[]} />
          No approved organization to create events for. <Link to="/apply">Apply to host events</Link>
        </Empty>
      ) : (
      <form className="form card narrow" onSubmit={onSubmit}>
        {orgs.data && orgs.data.length > 1 && (
          <label>
            Organization
            <select value={organizationId} onChange={(e) => setOrgChoice(e.target.value)}>
              {orgs.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {orgs.data?.length === 1 && (
          <p className="muted small">
            Hosting as <strong>{orgs.data[0]!.name}</strong>
          </p>
        )}
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
          <CategorySelect value={category} onChange={setCategory} required />
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
      )}
    </>
  );
}
