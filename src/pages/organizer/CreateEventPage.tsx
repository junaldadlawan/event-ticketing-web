import { isAdmin as isAdminRole } from '../../auth/roles';
import { useRef, useState } from 'react';
import type { FocusEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assetUrl, errorMessage } from '../../api/client';
import { eventApi, organizationApi, uploadApi, venueApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { BackgroundMenu } from '../../components/BackgroundMenu';
import { CategorySelect } from '../../components/CategorySelect';
import { ImageIcon, SpinnerIcon } from '../../components/DesignerIcons';
import { Popover } from '../../components/Popover';
import { SuspendedOrgNotice } from '../../components/SuspendedOrgNotice';
import { Empty, ErrorBox, Spinner, PageHeader } from '../../components/ui';
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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  // A row's warning shows once focus has left that row (or on submit), not while it is being filled in.
  const [left, setLeft] = useState({ start: false, end: false });
  const leaveRow = (row: 'start' | 'end') => (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLeft((l) => ({ ...l, [row]: true }));
  };
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  // The event's images, in order: uploaded files and pasted links alike.
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** Adds the typed link; false (with a message) when it is not an http(s) address. */
  function addLink(): boolean {
    const link = linkInput.trim();
    if (!/^https?:\/\/\S+$/i.test(link)) {
      setUploadError('Enter a full image link starting with http:// or https://.');
      return false;
    }
    setUploadError(null);
    setImageUrls((list) => (list.includes(link) ? list : [...list, link]));
    setLinkInput('');
    return true;
  }

  async function uploadFiles(files: File[]) {
    const tooBig = files.filter((f) => f.size > 5 * 1024 * 1024);
    const ok = files.filter((f) => f.size <= 5 * 1024 * 1024);
    setUploadError(tooBig.length ? `Over 5 MB, not uploaded: ${tooBig.map((f) => f.name).join(', ')}` : null);
    setUploading(true);
    try {
      for (const file of ok) {
        const { url } = await uploadApi.image(file);
        setImageUrls((list) => [...list, url]);
      }
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const orgs = useAsync(() => loadMyOrganizations(isAdminRole(user?.role)), [user?.role]);
  // One organization is used silently; with several, the first is preselected and a name dropdown is shown.
  const organizationId = orgChoice || orgs.data?.[0]?.id || '';
  const { data: venues } = useAsync(
    () => (organizationId ? venueApi.listForOrg(organizationId) : Promise.resolve([])),
    [organizationId],
  );

  // Each warning shows once its date and time are both filled in, read in the chosen timezone.
  const now = Date.now();
  const startMs = startDate && startTime ? Date.parse(zonedToIso(startDate, startTime, timezone)) : null;
  const endMs = endDate && endTime ? Date.parse(zonedToIso(endDate, endTime, timezone)) : null;
  const startWarning = startMs !== null && startMs <= now ? 'The start must be in the future.' : null;
  const endWarning =
    endMs === null
      ? null
      : endMs <= now
        ? 'The end must be in the future.'
        : startMs !== null && endMs <= startMs
          ? 'The end must be after the start.'
          : null;

  // A row's problem shows once focus has left it; otherwise the line under the dates gives the event's length.
  const shownWarning = (left.start && startWarning) || (left.end && endWarning) || null;
  const duration = startMs !== null && endMs !== null && endMs > startMs ? formatDuration(endMs - startMs) : null;

  // Create stays off until every required field is filled in and the dates make sense.
  const missing = [
    !organizationId && 'organization',
    !title.trim() && 'title',
    !description.trim() && 'description',
    !category && 'category',
    startMs === null && 'start date and time',
    endMs === null && 'end date and time',
    !timezone && 'timezone',
  ].filter(Boolean);
  const blocked = missing.length > 0 || Boolean(startWarning || endWarning);
  const blockedHint =
    missing.length > 0 ? `Fill in: ${missing.join(', ')}` : (startWarning ?? endWarning ?? undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (startWarning || endWarning) {
      setLeft({ start: true, end: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const imageList = imageUrls;
      const created = await eventApi.create({
        organizationId,
        title,
        description,
        category,
        venueId: venueId || undefined,
        // The date and time are the event's local time in the chosen timezone, not the browser's.
        startAt: zonedToIso(startDate, startTime, timezone),
        endAt: zonedToIso(endDate, endTime, timezone),
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
      <PageHeader title="New event" />
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
        {/* Date and time stay on one line at every width. */}
        <div className="date-time-row" onBlur={leaveRow('start')}>
          <label>
            Start date
            <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Start time
            <TimeField value={startTime} onChange={setStartTime} />
          </label>
        </div>
        <div className="date-time-row" onBlur={leaveRow('end')}>
          <label>
            End date
            <input type="date" required min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            End time
            <TimeField value={endTime} onChange={setEndTime} />
          </label>
        </div>
        {/* Always one line tall, so the form never jumps: the date problem, else how long the event lasts. */}
        <p className={`date-status small ${shownWarning ? 'warn' : 'muted'}`} role={shownWarning ? 'alert' : undefined}>
          {shownWarning ?? (duration ? `Duration: ${duration}` : '\u00a0')}
        </p>
        <label>
          Timezone
          <select required value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezoneOptions(timezone).map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
        <div className="event-images">
          <div className="row-between">
            <span>
              Images <span className="hint">(optional)</span>
            </span>
            {/* Same button as the ticket designer's background: upload a file or use a link. */}
            <Popover
              label={uploading ? 'Uploading image…' : 'Add image'}
              icon={uploading ? <SpinnerIcon /> : <ImageIcon />}
              disabled={uploading}
            >
              {(close) => (
                <BackgroundMenu
                  url={linkInput}
                  onUrlChange={setLinkInput}
                  urlLabel="Image link"
                  placeholder="https://example.com/event.png"
                  onUpload={() => {
                    close();
                    fileInput.current?.click();
                  }}
                  onUseUrl={() => {
                    if (addLink()) close();
                  }}
                />
              )}
            </Popover>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length) void uploadFiles(files);
            }}
          />
          <ErrorBox message={uploadError} />
          {imageUrls.length > 0 ? (
            <ul className="event-image-list">
              {imageUrls.map((url) => (
                <li key={url}>
                  <img src={assetUrl(url) ?? url} alt="" />
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setImageUrls((list) => list.filter((u) => u !== url))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <small className="muted">{uploading ? 'Uploading…' : 'None yet. Use the image button to upload one or add a link.'}</small>
          )}
        </div>
        <button className="btn btn-primary" disabled={busy || blocked || uploading} title={uploading ? 'Wait for the images to finish uploading' : blocked ? blockedHint : undefined}>
          {busy ? 'Creating...' : 'Create draft event'}
        </button>
      </form>
      )}
    </>
  );
}

/** Every IANA timezone the browser knows, as "(UTC+08:00) Asia/Manila", ordered by offset then name. */
let zoneCache: { id: string; offset: number; label: string }[] | null = null;
function timezoneOptions(current: string): { id: string; label: string }[] {
  // Built once: about 400 zones, each needing an offset lookup.
  zoneCache ??= zoneList(Intl.supportedValuesOf('timeZone'));
  // The browser's own zone may be an alias missing from the list, e.g. "UTC".
  return zoneCache.some((z) => z.id === current) ? zoneCache : zoneList([current, ...zoneCache.map((z) => z.id)]);
}

function zoneList(ids: string[]): { id: string; offset: number; label: string }[] {
  const now = new Date();
  return ids
    .map((id) => {
      const offset = utcOffsetMinutes(id, now);
      return { id, offset, label: `(UTC${formatOffset(offset)}) ${id.replace(/_/g, ' ')}` };
    })
    .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
}

/** "2026-11-15" + "18:14" as wall-clock time in `timeZone` -> the UTC instant, as ISO. */
function zonedToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The offset depends on the instant (daylight saving), so look it up at the first guess and correct once.
  let at = wall - utcOffsetMinutes(timeZone, new Date(wall)) * 60_000;
  at = wall - utcOffsetMinutes(timeZone, new Date(at)) * 60_000;
  return new Date(at).toISOString();
}

/** The zone's offset from UTC at an instant, in minutes (daylight saving included). */
function utcOffsetMinutes(timeZone: string, at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** 480 -> "+08:00", -210 -> "-03:30", 0 -> "+00:00". */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** 788_100_000 ms -> "1 week, 2 days, 3 hrs, 15 min"; parts that are 0 are left out. */
function formatDuration(ms: number): string {
  let minutes = Math.round(ms / 60_000);
  const units: [number, string, string][] = [
    [7 * 24 * 60, 'week', 'weeks'],
    [24 * 60, 'day', 'days'],
    [60, 'hr', 'hrs'],
    [1, 'min', 'min'],
  ];
  const parts: string[] = [];
  for (const [size, one, many] of units) {
    const n = Math.floor(minutes / size);
    minutes -= n * size;
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts.join(', ') || 'less than a minute';
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const HALVES = ['AM', 'PM'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "13:05" -> { hour: "1", minute: "05", half: "PM" }; "" -> no hour or minute yet, AM (the dropdown has no blank). */
function timeParts(value: string): { hour: string; minute: string; half: string } {
  if (!value) return { hour: '', minute: '', half: 'AM' };
  const [h, m] = value.split(':').map(Number);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: pad2(m), half: h < 12 ? 'AM' : 'PM' };
}

/**
 * A time as hour, minute and AM / PM dropdowns, each with its own up / down arrows. `value` is "HH:mm" (24-hour), or ""
 * until the hour and minute are chosen.
 */
function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // The parts live here so a half-picked time (hour chosen, minute not yet) is kept while value is still "".
  const [parts, setParts] = useState(() => timeParts(value));
  function pick(next: Partial<typeof parts>) {
    const p = { ...parts, ...next };
    setParts(p);
    if (!p.hour || !p.minute || !p.half) return onChange('');
    const h = (Number(p.hour) % 12) + (p.half === 'PM' ? 12 : 0);
    onChange(`${pad2(h)}:${p.minute}`);
  }
  return (
    <span className="time-field">
      <StepSelect label="Hour" placeholder="--" options={HOURS} value={parts.hour} onChange={(hour) => pick({ hour })} />
      <StepSelect label="Minute" placeholder="--" options={MINUTES} value={parts.minute} onChange={(minute) => pick({ minute })} />
      <StepSelect label="AM or PM" options={HALVES} value={parts.half} onChange={(half) => pick({ half })} />
    </span>
  );
}

/** A dropdown with up / down arrows beside it that move to the next / previous option, wrapping around at the ends. */
function StepSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  /** Shown while nothing is chosen; without one the first option is the starting value. */
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  function step(by: number) {
    const i = options.indexOf(value);
    // Nothing chosen yet: up starts at the first option, down at the last.
    const next = i < 0 ? (by > 0 ? 0 : options.length - 1) : (i + by + options.length) % options.length;
    onChange(options[next]);
  }
  return (
    <span className="time-part">
      <select required value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="time-steps">
        <button type="button" aria-label={`${label} up`} onClick={() => step(1)}>
          <svg viewBox="0 0 10 6" aria-hidden="true">
            <path d="M1 5l4-4 4 4" />
          </svg>
        </button>
        <button type="button" aria-label={`${label} down`} onClick={() => step(-1)}>
          <svg viewBox="0 0 10 6" aria-hidden="true">
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
      </span>
    </span>
  );
}
