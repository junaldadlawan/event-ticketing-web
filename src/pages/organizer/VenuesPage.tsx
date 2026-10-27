import { useEffect, useState } from 'react';
import { MapPinPicker } from '../../components/MapPinPicker';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assetUrl, errorMessage } from '../../api/client';
import { organizationApi, uploadApi, venueApi } from '../../api/endpoints';
import type { Venue, VenueLayout, VenueType } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { useHasPermission } from '../../auth/useCanManage';
import { Button, FormActions } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon, PlusIcon } from '../../components/DesignerIcons';
import { Field } from '../../components/fields/Field';
import { QuantityField } from '../../components/fields/QuantityField';
import { SelectField, TextAreaField, TextField } from '../../components/fields/TextField';
import { FormDialog } from '../../components/FormDialog';
import { LayoutThumb } from '../../components/LayoutThumb';
import { Segmented } from '../../components/Segmented';
import { RefreshButton } from '../../components/RefreshButton';
import { Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { COUNTRIES } from '../../utils/countries';
import { loadCities, loadProvinces } from '../../utils/places';
import { seatCount } from '../../utils/venueLayout';
import { useAsync } from '../../utils/useAsync';

type Org = { id: string; name: string };
type Draft = {
  id: string | null;
  orgId: string;
  name: string;
  venueType: VenueType | '';
  country: string;
  province: string;
  city: string;
  address: string;
  description: string;
  maxCapacity: string;
  coverImageUrl: string | null;
  latitude: string;
  longitude: string;
};

const EMPTY: Draft = { id: null, orgId: '', name: '', venueType: '', country: '', province: '', city: '', address: '', description: '', maxCapacity: '', coverImageUrl: null, latitude: '', longitude: '' };

const VENUE_TYPES: [VenueType, string][] = [
  ['THEATER', 'Theater'],
  ['ARENA', 'Arena'],
  ['STADIUM', 'Stadium'],
  ['CONCERT_HALL', 'Concert hall'],
  ['CONFERENCE_CENTER', 'Conference center'],
  ['CLUB_BAR', 'Club or bar'],
  ['RESTAURANT', 'Restaurant'],
  ['CHURCH', 'Church'],
  ['OUTDOOR', 'Outdoor'],
  ['SCHOOL', 'School'],
  ['OTHER', 'Other'],
  ['VIRTUAL', 'Virtual (online)'],
];
const typeLabel = (t?: VenueType | null) => VENUE_TYPES.find(([k]) => k === t)?.[1] ?? null;
const countryName = (iso?: string | null) => COUNTRIES.find((c) => c.iso === iso)?.name ?? iso ?? null;

/** The organization's venues: the places its events happen in. Add one, or change a name, an address or a map position. */
export function VenuesPage() {
  const canEdit = useHasPermission('EVENTS', 'any');
  const { user } = useAuth();
  const navigate = useNavigate();
  // Starting a layout follows the layout editor's rule: Events access, and not an admin (admins can only read layouts).
  const canLayout = canEdit && !isAdmin(user?.role);
  const { data, error, loading, reload } = useAsync(async () => {
    const orgs: Org[] = (await organizationApi.mine()).filter((o) => o.status === 'APPROVED').map(({ id, name }) => ({ id, name }));
    const lists = await Promise.all(orgs.map((o) => venueApi.listForOrg(o.id)));
    return { orgs, venues: lists.flat() };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  // Venues, or a grid of their seat layouts (each venue's saved layout is fetched when the grid is opened).
  const [view, setView] = useState<'venues' | 'layouts'>('venues');
  const [layouts, setLayouts] = useState<Record<string, VenueLayout | null> | null>(null);
  const venueKey = (data?.venues ?? []).map((v) => v.id).join();
  useEffect(() => {
    if (view !== 'layouts') return;
    let current = true;
    const list = data?.venues ?? [];
    setLayouts(null);
    void Promise.all(list.map((v) => venueApi.layout(v.id).then((l) => [v.id, l] as const).catch(() => [v.id, null] as const))).then((rows) => current && setLayouts(Object.fromEntries(rows)));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, venueKey]);
  // The provinces of the chosen country, and the cities of the chosen province (empty: the user types the name instead).
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [placesBusy, setPlacesBusy] = useState(false);
  const country = draft?.country ?? '';
  const province = draft?.province ?? '';
  useEffect(() => {
    let current = true;
    setPlacesBusy(true);
    void loadProvinces(country).then((list) => {
      if (!current) return;
      setProvinces(list);
      setPlacesBusy(false);
    });
    return () => {
      current = false;
    };
  }, [country]);
  useEffect(() => {
    let current = true;
    setCities([]);
    void loadCities(country, province).then((list) => current && setCities(list));
    return () => {
      current = false;
    };
  }, [country, province]);
  const orgs = data?.orgs ?? [];
  const venues = data?.venues ?? [];
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? '';

  // "New layout": pick the venue (when there are several), ask first if it already has a saved layout, then open a blank plan.
  const [choosing, setChoosing] = useState(false);
  const [chosenId, setChosenId] = useState('');
  const [replacing, setReplacing] = useState<Venue | null>(null);
  const [checking, setChecking] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const openBlank = (v: Venue) => navigate(`/manage/venues/${v.id}/layout`, { state: { blank: true } });
  async function beginNewLayout(v: Venue) {
    setChoosing(false);
    setChecking(true);
    setLayoutError(null);
    try {
      // A saved layout is replaced when the new one is saved; opening the editor saves nothing.
      if (((await venueApi.layout(v.id)).version ?? 0) > 0) setReplacing(v);
      else openBlank(v);
    } catch (e) {
      setLayoutError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }
  function startNewLayout() {
    if (venues.length === 1) void beginNewLayout(venues[0]!);
    else {
      setChosenId(venues[0]?.id ?? '');
      setChoosing(true);
    }
  }

  // The form as it was opened: closing it with other values asks before throwing them away.
  const [initial, setInitial] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const closeForm = () => (draft && JSON.stringify(draft) !== initial ? setDiscarding(true) : setDraft(null));
  function openDraft(d: Draft) {
    setFormError(null);
    setInitial(JSON.stringify(d));
    setDraft(d);
  }
  function openAdd() {
    openDraft({ ...EMPTY, orgId: orgs[0]?.id ?? '' });
  }
  function openEdit(v: Venue) {
    openDraft({ id: v.id, orgId: v.organizationId, name: v.name, venueType: v.venueType ?? '', country: v.country ?? '', province: v.province ?? '', city: v.city ?? '', address: v.address ?? '', description: v.description ?? '', maxCapacity: v.maxCapacity == null ? '' : String(v.maxCapacity), coverImageUrl: v.coverImageUrl ?? null, latitude: v.latitude == null ? '' : String(v.latitude), longitude: v.longitude == null ? '' : String(v.longitude) });
  }

  // The pin on the map is the venue's position; both numbers are set, or neither.
  const lat = draft?.latitude.trim() ?? '';
  const pin = draft && lat !== '' ? { lat: Number(draft.latitude), lng: Number(draft.longitude) } : null;
  const capacity = draft?.maxCapacity.trim() ?? '';
  const invalid = !draft?.name.trim() || coverBusy;

  async function uploadCover(file: File) {
    if (!draft) return;
    if (file.size > 5 * 1024 * 1024) return setFormError(`Over 5 MB, not uploaded: ${file.name}`);
    setFormError(null);
    setCoverBusy(true);
    try {
      const { url } = await uploadApi.image(file, 'venues');
      setDraft((d) => (d ? { ...d, coverImageUrl: url } : d));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setCoverBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || invalid) return;
    setBusy(true);
    setFormError(null);
    try {
      // An empty box clears the field when editing (null) and is simply left out when adding.
      const blank = draft.id ? null : undefined;
      const text = (v: string) => v.trim() || blank;
      const body = {
        name: draft.name.trim(),
        venueType: draft.venueType || blank,
        country: draft.country || blank,
        province: text(draft.province),
        city: text(draft.city),
        address: draft.address.trim() || (draft.id ? '' : undefined),
        description: text(draft.description),
        maxCapacity: capacity === '' ? blank : Number(capacity),
        coverImageUrl: draft.coverImageUrl ?? blank,
        ...(pin && { latitude: pin.lat, longitude: pin.lng }),
      };
      if (draft.id) await venueApi.update(draft.id, body);
      else await venueApi.create(draft.orgId, body);
      setDraft(null);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Venues"
        lede="The places your events happen in. Pick one when you create an event."
        actions={
          <>
            {canLayout && venues.length > 0 && (
              <Button onClick={startNewLayout} disabled={checking} title="Start a blank seat plan for a venue">
                {checking ? 'Checking…' : 'New layout'}
              </Button>
            )}
            {canEdit && orgs.length > 0 && (
              <Button variant="cta" onClick={openAdd}>
                <PlusIcon />
                Add venue
              </Button>
            )}
          </>
        }
      />
      <ErrorBox message={error ?? layoutError} />
      {loading && !data ? (
        <Spinner />
      ) : venues.length === 0 ? (
        <Empty>
          No venues yet.{canEdit && orgs.length > 0 && (
            <>
              {' '}
              <button type="button" className="btn-link" onClick={openAdd}>
                Add your first venue
              </button>
            </>
          )}
        </Empty>
      ) : (
        <>
          <div className="venue-bar">
            <p className="muted small venue-count">
              {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
              <RefreshButton onClick={reload} busy={loading} label="Reload venues" />
            </p>
            <Segmented
              label="Show"
              text
              value={view}
              onChange={setView}
              options={[
                { value: 'venues', label: 'Venues' },
                { value: 'layouts', label: 'Seat layouts' },
              ]}
            />
          </div>
          {view === 'venues' ? (
            <ul className="venue-grid">
              {venues.map((v) => (
                <VenueCard key={v.id} venue={v} orgLabel={orgs.length > 1 ? orgName(v.organizationId) : null} canEdit={canEdit} onEdit={() => openEdit(v)} />
              ))}
            </ul>
          ) : layouts === null ? (
            <Spinner />
          ) : (
            <ul className="layout-grid">
              {venues.map((v) => {
                const l = layouts[v.id];
                const saved = l && (l.version ?? 0) > 0 && l.sections.length + (l.shapes ?? []).length > 0 ? l : null;
                const counts = saved ? seatCount(saved) : null;
                return (
                  <li key={v.id} className="layout-card">
                    <Link to={`/manage/venues/${v.id}/layout`} className="layout-card-preview" aria-label={`Open the seat layout of ${v.name}`}>
                      {saved ? <LayoutThumb layout={saved} label={`Seat layout of ${v.name}`} /> : <span className="muted">No layout yet</span>}
                    </Link>
                    <strong className="layout-card-name">{v.name}</strong>
                    <p className="muted small">
                      {counts ? `${saved!.sections.length} ${saved!.sections.length === 1 ? 'section' : 'sections'} · ${counts.total.toLocaleString()} seats · ${counts.sellable.toLocaleString()} for sale` : 'Not designed yet'}
                      {counts && v.maxCapacity != null && counts.total > v.maxCapacity ? ' · more seats than the venue capacity' : ''}
                    </p>
                    <Link to={`/manage/venues/${v.id}/layout`} className="btn btn-sm">
                      {saved ? (canLayout ? 'Edit layout' : 'View layout') : canLayout ? 'Design layout' : 'View'}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <FormDialog open={choosing} title="Which venue is the layout for?" onClose={() => setChoosing(false)}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = venues.find((x) => x.id === chosenId);
            if (v) void beginNewLayout(v);
          }}
        >
          <SelectField label="Venue" value={chosenId} onChange={(e) => setChosenId(e.target.value)}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </SelectField>
          <FormActions submitLabel="Continue" submitDisabled={!chosenId} onCancel={() => setChoosing(false)} />
        </form>
      </FormDialog>

      <ConfirmDialog
        open={replacing !== null}
        title="Start a new layout?"
        confirmLabel="Open a blank plan"
        cancelLabel="Keep the current one"
        onCancel={() => setReplacing(null)}
        onConfirm={() => {
          const v = replacing;
          setReplacing(null);
          if (v) openBlank(v);
        }}
      >
        {replacing?.name} already has a seat layout. A new layout replaces it once you press Save in the editor; until then nothing changes. Events that already copied seats from the old layout are not affected.
      </ConfirmDialog>

      <FormDialog open={draft !== null} title={draft?.id ? 'Edit venue' : 'Add a venue'} size="large" onClose={closeForm}>
        {draft && (
          <form className="form" onSubmit={save}>
            <ErrorBox message={formError} />
            {!draft.id && orgs.length > 1 && (
              <SelectField label="Organization" value={draft.orgId} onChange={(e) => setDraft({ ...draft, orgId: e.target.value })}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectField>
            )}
            <div className="venue-form">
              <div className="vf-fields">
              <div className="vf-2">
                <TextField label="Venue name" required maxLength={255} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <SelectField label="Venue type" optional value={draft.venueType} onChange={(e) => setDraft({ ...draft, venueType: e.target.value as VenueType | '' })}>
                <option value="">Choose a type</option>
                {VENUE_TYPES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Country" optional value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value, province: '', city: '' })}>
                <option value="">Choose a country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              {provinces.length > 0 ? (
                <SelectField label="Province or state" optional value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value, city: '' })}>
                  <option value="">Choose a province</option>
                  {draft.province && !provinces.includes(draft.province) && <option value={draft.province}>{draft.province}</option>}
                  {provinces.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <TextField label="Province or state" optional maxLength={100} placeholder={placesBusy ? 'Loading…' : undefined} value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })} />
              )}
              {cities.length > 0 ? (
                <SelectField label="City" optional value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })}>
                  <option value="">Choose a city</option>
                  {draft.city && !cities.includes(draft.city) && <option value={draft.city}>{draft.city}</option>}
                  {cities.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <TextField label="City" optional maxLength={100} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              )}
              <div className="vf-2">
                <TextField label="Complete address" optional maxLength={500} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} title="Street, building and number. Shown to buyers on the event page." />
              </div>
              <Field label="Maximum capacity" optional hint="0 means not set. It can be more than the seats in the layout.">
                <QuantityField
                  value={Number(capacity) || 0}
                  min={0}
                  max={1000000}
                  label="Maximum capacity"
                  lessLabel="Lower capacity"
                  moreLabel="Higher capacity"
                  onCommit={(n) => setDraft({ ...draft, maxCapacity: n === 0 ? '' : String(n) })}
                />
              </Field>
              <div className="vf-2">
                <TextAreaField label="Description" optional maxLength={2000} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="field">
                <span className="field-label">
                  Cover image <span className="field-hint">(optional)</span>
                </span>
                <div className="venue-cover-field">
                  {draft.coverImageUrl ? <img className="venue-cover-preview" src={assetUrl(draft.coverImageUrl) ?? draft.coverImageUrl} alt="Venue cover" /> : <div className="venue-cover-empty">{coverBusy ? 'Uploading…' : 'No image'}</div>}
                  <div className="venue-cover-actions">
                    <label className="btn btn-sm">
                      {draft.coverImageUrl ? 'Change' : 'Upload'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        hidden
                        disabled={coverBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadCover(file);
                        }}
                      />
                    </label>
                    {draft.coverImageUrl && (
                      <button type="button" className="btn btn-sm" onClick={() => setDraft({ ...draft, coverImageUrl: null })}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </div>
              <div className="field vf-map">
                <span className="field-label">
                  Pin on the map <span className="field-hint">(optional)</span>
                </span>
                <MapPinPicker position={pin} onChange={(next) => setDraft({ ...draft, latitude: next ? String(next.lat) : '', longitude: next ? String(next.lng) : '' })} />
              </div>
            </div>
            <FormActions busy={busy} busyLabel="Saving…" submitLabel={draft.id ? 'Save changes' : 'Add venue'} submitDisabled={invalid} onCancel={closeForm} />
          </form>
        )}
      </FormDialog>

      <ConfirmDialog
        open={discarding}
        title="Discard your changes?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false);
          setDraft(null);
        }}
      >
        What you entered for this venue has not been saved and will be lost.
      </ConfirmDialog>
    </>
  );
}

/** One venue: its details and the seat layout link. */
function VenueCard({ venue: v, orgLabel, canEdit, onEdit }: { venue: Venue; orgLabel: string | null; canEdit: boolean; onEdit: () => void }) {
  return (
    <li className="venue-card">
      <div>
        {v.coverImageUrl && <img className="venue-card-cover" src={assetUrl(v.coverImageUrl) ?? v.coverImageUrl} alt="" />}
        <strong className="venue-name">{v.name}</strong>
        {(typeLabel(v.venueType) || v.maxCapacity != null) && (
          <p className="muted small">{[typeLabel(v.venueType), v.maxCapacity != null ? `Holds ${v.maxCapacity.toLocaleString()}` : null].filter(Boolean).join(' · ')}</p>
        )}
        <p className="muted">{v.address || 'No address'}</p>
        {[v.city, v.province, countryName(v.country)].some(Boolean) && <p className="muted small">{[v.city, v.province, countryName(v.country)].filter(Boolean).join(', ')}</p>}
        {v.description && <p className="venue-card-about">{v.description}</p>}
        {orgLabel && <p className="muted small">{orgLabel}</p>}
        {v.latitude != null && v.longitude != null ? (
          <a className="small" href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer">
            View on a map
          </a>
        ) : (
          <p className="muted small">No map position</p>
        )}
        <div className="venue-layout-actions">
          <Link to={`/manage/venues/${v.id}/layout`} className="btn btn-sm venue-layout-link">
            Seat layout
          </Link>
        </div>
      </div>
      {canEdit && (
        <button type="button" className="icon-button" onClick={onEdit} title={`Edit ${v.name}`} aria-label={`Edit ${v.name}`}>
          <EditIcon />
        </button>
      )}
    </li>
  );
}
