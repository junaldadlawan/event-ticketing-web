import { useEffect, useState } from 'react';
import { MapPinPicker } from '../../components/MapPinPicker';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { organizationApi, venueApi } from '../../api/endpoints';
import type { Venue, VenueType } from '../../api/types';
import { useHasPermission } from '../../auth/useCanManage';
import { Button, FormActions } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon, PlusIcon } from '../../components/DesignerIcons';
import { Field } from '../../components/fields/Field';
import { QuantityField } from '../../components/fields/QuantityField';
import { SelectField, TextAreaField, TextField } from '../../components/fields/TextField';
import { FormDialog } from '../../components/FormDialog';
import { RefreshButton } from '../../components/RefreshButton';
import { VenueTabs } from '../../components/VenueTabs';
import { Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { COUNTRIES } from '../../utils/countries';
import { usePlatformRegions } from '../../utils/usePlatformRegions';
import { loadCities, loadProvinces } from '../../utils/places';
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
  latitude: string;
  longitude: string;
};

const EMPTY: Draft = { id: null, orgId: '', name: '', venueType: '', country: '', province: '', city: '', address: '', description: '', maxCapacity: '', latitude: '', longitude: '' };

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
  // A venue can only be in a country the admin enabled.
  const { regions } = usePlatformRegions();
  const canEdit = useHasPermission('EVENTS', 'any');
  const { data, error, loading, reload } = useAsync(async () => {
    const orgs: Org[] = (await organizationApi.mine()).filter((o) => o.status === 'APPROVED').map(({ id, name }) => ({ id, name }));
    const lists = await Promise.all(orgs.map((o) => venueApi.listForOrg(o.id)));
    return { orgs, venues: lists.flat() };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    openDraft({ id: v.id, orgId: v.organizationId, name: v.name, venueType: v.venueType ?? '', country: v.country ?? '', province: v.province ?? '', city: v.city ?? '', address: v.address ?? '', description: v.description ?? '', maxCapacity: v.maxCapacity == null ? '' : String(v.maxCapacity), latitude: v.latitude == null ? '' : String(v.latitude), longitude: v.longitude == null ? '' : String(v.longitude) });
  }

  // The pin on the map is the venue's position; both numbers are set, or neither.
  const lat = draft?.latitude.trim() ?? '';
  const pin = draft && lat !== '' ? { lat: Number(draft.latitude), lng: Number(draft.longitude) } : null;
  const capacity = draft?.maxCapacity.trim() ?? '';
  const invalid = !draft?.name.trim();

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
      <VenueTabs />
      <PageHeader
        title="Venues & seat layouts"
        lede="The places your events happen in. Pick one when you create an event."
        actions={
          <>
            {canEdit && orgs.length > 0 && (
              <Button variant="cta" onClick={openAdd}>
                <PlusIcon />
                Add venue
              </Button>
            )}
          </>
        }
      />
      <ErrorBox message={error} />
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
          <p className="muted small venue-count">
            {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
            <RefreshButton onClick={reload} busy={loading} label="Reload venues" />
          </p>
          <ul className="venue-grid">
              {venues.map((v) => (
                <VenueCard key={v.id} venue={v} orgLabel={orgs.length > 1 ? orgName(v.organizationId) : null} canEdit={canEdit} onEdit={() => openEdit(v)} />
              ))}
            </ul>
        </>
      )}

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
                {/* A venue saved in a country that was turned off since keeps it. */}
                {draft.country && !regions?.countries.some((c) => c.code === draft.country) && <option value={draft.country}>{countryName(draft.country)}</option>}
                {(regions?.countries ?? []).map((c) => (
                  <option key={c.code} value={c.code}>
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
      </div>
      {canEdit && (
        <button type="button" className="icon-button" onClick={onEdit} title={`Edit ${v.name}`} aria-label={`Edit ${v.name}`}>
          <EditIcon />
        </button>
      )}
    </li>
  );
}
