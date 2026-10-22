import { isAdmin as isAdminRole } from '../../auth/roles';
import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl, errorMessage } from '../../api/client';
import { eventApi, organizationApi, uploadApi, venueApi } from '../../api/endpoints';
import type { Event } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { BackgroundMenu } from '../../components/BackgroundMenu';
import { CategorySelect } from '../../components/CategorySelect';
import { ImageIcon, SpinnerIcon } from '../../components/DesignerIcons';
import { Popover } from '../../components/Popover';
import { SuspendedOrgNotice } from '../../components/SuspendedOrgNotice';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';
import { formatOffset, utcOffsetMinutes, zonedParts, zonedToIso } from '../../utils/zonedTime';
import { MINUTES, StepSelect, TimeField } from '../../components/TimeField';
import { isEventOver } from '../../utils/eventState';
import { useOrgNames } from '../../utils/useOrgNames';
import { formatDateTime, minutesText } from '../../utils/format';

/** 0 to 24: the API takes a gate time of at most 24 hours (1440 minutes) before the start. */
const GATE_HOURS = Array.from({ length: 25 }, (_, i) => String(i));

/** The organizations the signed-in user can create events for (id + name). */
async function loadMyOrganizations(isAdmin: boolean): Promise<{ id: string; name: string }[]> {
  if (isAdmin) return (await organizationApi.list('APPROVED')).map(({ id, name }) => ({ id, name }));
  // Only approved organizations can host events (a suspended or pending one cannot).
  return (await organizationApi.mine()).filter((o) => o.status === 'APPROVED').map(({ id, name }) => ({ id, name }));
}

/**
 * New event (or, with `existing`, Edit event) as a floating window over the page it was opened from, with the
 * page blurred behind it. The form starts fresh each time it opens.
 */
export function EventFormDialog({
  open,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing?: Event;
  onClose: () => void;
  /** The created or updated event, as the API returned it. */
  onSaved: (event: Event) => void;
}) {
  // Closing (×, Cancel, Escape) with something changed asks first; nothing changed closes at once.
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  function requestClose() {
    if (dirty) setConfirming(true);
    else onClose();
  }
  return (
    <>
      <FormDialog open={open} title={existing ? 'Edit event' : 'New event'} onClose={requestClose}>
        <EventForm existing={existing} onSaved={onSaved} onCancel={requestClose} onDirtyChange={setDirty} />
      </FormDialog>
      <ConfirmDialog
        open={confirming}
        title={existing ? 'Discard your changes?' : 'Discard this new event?'}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setDirty(false);
          onClose();
        }}
      >
        {existing
          ? 'Your changes to this event have not been saved and will be lost.'
          : 'What you have entered for this event has not been saved and will be lost.'}
      </ConfirmDialog>
    </>
  );
}

/**
 * Create a new event, or (with `existing`) edit one. After creation the API lets only the title, description,
 * category, images and gate time change, so editing shows the organization, venue, dates and timezone locked.
 */
function EventForm({
  existing,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  existing?: Event;
  onSaved: (event: Event) => void;
  onCancel: () => void;
  /** Called with true once anything differs from how the form opened, and false when it matches again. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { user } = useAuth();
  const locked = Boolean(existing);
  const ended = existing ? isEventOver(existing) : false;
  const [orgChoice, setOrgChoice] = useState('');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [venueId, setVenueId] = useState(existing?.venue?.id ?? '');
  // A new event starts as tomorrow, 12:00 AM to 1:00 AM; an existing one shows its own times in its timezone.
  const savedStart = existing ? zonedParts(existing.startAt, existing.timezone) : null;
  const savedEnd = existing ? zonedParts(existing.endAt, existing.timezone) : null;
  const [startDate, setStartDate] = useState(savedStart?.date ?? tomorrow);
  const [startTime, setStartTime] = useState(savedStart?.time ?? '00:00');
  const [endDate, setEndDate] = useState(savedEnd?.date ?? tomorrow);
  const [endTime, setEndTime] = useState(savedEnd?.time ?? '01:00');
  // While ticked, the end date follows the start date (a new event starts ticked: both default to tomorrow).
  const [sameDay, setSameDay] = useState(startDate === endDate);
  // A row's warning shows once focus has left that row (or on submit), not while it is being filled in.
  const [left, setLeft] = useState({ start: false, end: false });
  const leaveRow = (row: 'start' | 'end') => (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLeft((l) => ({ ...l, [row]: true }));
  };
  const [timezone, setTimezone] = useState(
    () => existing?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  // The event's images, in order: uploaded files and pasted links alike.
  const [imageUrls, setImageUrls] = useState<string[]>(existing?.images ?? []);
  // How long before the start the gates open, as hours and minutes; both blank = not set. Still editable after creation.
  const savedGate = existing?.gateOpensMinutesBefore ?? null;
  const [gateH, setGateH] = useState(savedGate == null ? '' : String(Math.floor(savedGate / 60)));
  const [gateM, setGateM] = useState(savedGate == null ? '' : String(savedGate % 60).padStart(2, '0'));
  // One part picked and the other still blank counts the blank one as 0.
  const gateMinutes = gateH === '' && gateM === '' ? null : Number(gateH || 0) * 60 + Number(gateM || 0);
  const gateWarning =
    gateMinutes !== null && !(gateMinutes >= 0 && gateMinutes <= 1440) ? 'Gates can open at most 24 hours before the start.' : null;
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

  // Everything the form holds, compared with how it opened, to know whether closing would lose anything.
  const current = JSON.stringify([
    orgChoice, title, description, category, venueId, startDate, startTime, endDate, endTime, timezone, imageUrls, gateH, gateM,
  ]);
  const [initial] = useState(current);
  const dirty = current !== initial;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const orgs = useAsync(
    () => (existing ? Promise.resolve([]) : loadMyOrganizations(isAdminRole(user?.role))),
    [user?.role, existing],
  );
  // One organization is used silently; with several, the first is preselected and a name dropdown is shown.
  const organizationId = existing?.organizationId ?? (orgChoice || orgs.data?.[0]?.id || '');
  const ownerName = useOrgNames(existing ? [existing.organizationId] : []).get(existing?.organizationId ?? '');
  const { data: venues } = useAsync(
    () => (organizationId && !existing ? venueApi.listForOrg(organizationId) : Promise.resolve([])),
    [organizationId, existing],
  );

  // Each warning shows once its date and time are both filled in, read in the chosen timezone.
  const now = Date.now();
  const startMs = startDate && startTime ? Date.parse(zonedToIso(startDate, startTime, timezone)) : null;
  const endMs = endDate && endTime ? Date.parse(zonedToIso(endDate, endTime, timezone)) : null;
  const startWarning = !locked && startMs !== null && startMs <= now ? 'The start must be in the future.' : null;
  const endWarning =
    locked || endMs === null
      ? null
      : endMs <= now
        ? 'The end must be in the future.'
        : startMs !== null && endMs <= startMs
          ? 'The end must be after the start.'
          : null;

  // A row's problem shows once focus has left it; otherwise the line under the dates gives the event's length.
  const shownWarning = (left.start && startWarning) || (left.end && endWarning) || null;
  const duration = startMs !== null && endMs !== null && endMs > startMs ? formatDuration(endMs - startMs) : null;
  // Calendar days from today to the start date, both read in the event's timezone; only while the start is ahead.
  const daysAway =
    startMs !== null && startMs > now
      ? (Date.parse(startDate) - Date.parse(zonedParts(new Date(now).toISOString(), timezone).date)) / 86_400_000
      : null;
  const startsIn =
    daysAway === null ? null : daysAway === 0 ? 'Starts today' : daysAway === 1 ? 'Starts tomorrow' : `Starts in ${daysAway} days`;

  // Create stays off until every required field is filled in and the dates make sense.
  const missing = [
    !organizationId && 'organization',
    !title.trim() && 'title',
    !description.trim() && 'description',
    !category && 'category',
    !locked && startMs === null && 'start date and time',
    !locked && endMs === null && 'end date and time',
    !timezone && 'timezone',
  ].filter(Boolean);
  const blocked = ended || missing.length > 0 || Boolean(startWarning || endWarning || gateWarning);
  const blockedHint = ended
    ? 'This event has ended and can no longer be changed'
    : missing.length > 0
      ? `Fill in: ${missing.join(', ')}`
      : (startWarning ?? endWarning ?? gateWarning ?? undefined);

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
      if (existing) {
        onSaved(
          await eventApi.update(existing.id, {
            title,
            description,
            category,
            images: imageList,
            ...(gateMinutes !== savedGate && { gateOpensMinutesBefore: gateMinutes }),
          }),
        );
        return;
      }
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
        gateOpensMinutesBefore: gateMinutes,
      });
      onSaved(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ErrorBox message={ended ? 'This event has ended, so it can no longer be changed.' : error} />
      {!existing && orgs.loading && !orgs.data ? (
        <Spinner />
      ) : !existing && orgs.data?.length === 0 ? (
        <Empty>
          <SuspendedOrgNotice organizationIds={[]} />
          No approved organization to create events for. <Link to="/apply">Apply to host events</Link>
        </Empty>
      ) : (
      <form className="form" onSubmit={onSubmit}>
        {orgs.data && orgs.data.length > 1 && (
          <label>
            <span>
              Organization
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <select value={organizationId} onChange={(e) => setOrgChoice(e.target.value)}>
              {orgs.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!existing && orgs.data?.length === 1 && (
          <p className="muted small">
            Hosting as <strong>{orgs.data[0]!.name}</strong>
          </p>
        )}
        {existing && (
          <p className="muted small">
            Hosting as <strong>{ownerName ?? '…'}</strong>
          </p>
        )}
        <label>
          <span>
            Title
            <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>
            Description
            <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <textarea
            required
            maxLength={2000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          <span>
            Category
            <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <CategorySelect value={category} onChange={setCategory} required />
        </label>
        <label>
          Venue
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)} disabled={locked}>
            <option value="">Online / no venue</option>
            {existing?.venue && (
              <option value={existing.venue.id}>
                {existing.venue.name} — {existing.venue.address}
              </option>
            )}
            {venues?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.address}
              </option>
            ))}
          </select>
        </label>
        {locked && (
          <p className="hint">The organization, venue, dates and timezone can't be changed after the event is created.</p>
        )}
        {/* Date and time stay on one line at every width. */}
        <div className="date-time-row" onBlur={leaveRow('start')}>
          <label>
            <span>
              Start date
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              type="date"
              required
              disabled={locked}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (sameDay) setEndDate(e.target.value);
              }}
            />
          </label>
          <label>
            <span>
              Start time
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <TimeField value={startTime} onChange={setStartTime} disabled={locked} />
          </label>
        </div>
        {!locked && (
          // Not a <label>: only the box itself toggles it, not the whole row.
          <div className="same-day">
            <input
              type="checkbox"
              aria-label="Same-day event"
              checked={sameDay}
              onChange={(e) => {
                setSameDay(e.target.checked);
                if (e.target.checked) setEndDate(startDate);
              }}
            />
            <span aria-hidden="true">Same-day event</span>
          </div>
        )}
        <div className="date-time-row" onBlur={leaveRow('end')}>
          <label>
            <span>
              End date
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              type="date"
              required
              disabled={locked || sameDay}
              title={!locked && sameDay ? 'Same as the start date. Untick "Same-day event" to change it.' : undefined}
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <label>
            <span>
              End time
              <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <TimeField value={endTime} onChange={setEndTime} disabled={locked} />
          </label>
        </div>
        {/* Always one line tall, so the form never jumps: the date problem, else how long the event lasts. */}
        <p className={`date-status small ${shownWarning ? 'warn' : 'muted'}`} role={shownWarning ? 'alert' : undefined}>
          {shownWarning ?? ([duration && `Duration: ${duration}`, startsIn].filter(Boolean).join(' · ') || '\u00a0')}
        </p>
        <label>
          <span>
            Timezone
            <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <select required disabled={locked} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezoneOptions(timezone).map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Gates open <span className="hint">(before the start, optional)</span>
          </span>
          {/* The start and end time pickers' dropdowns, as hours and minutes. */}
          <span className="time-field gate-field">
            <StepSelect label="Hours" placeholder="--" options={GATE_HOURS} value={gateH} onChange={setGateH} disabled={ended} required={false} />
            <span className="muted small">hr</span>
            <StepSelect label="Minutes" placeholder="--" options={MINUTES} value={gateM} onChange={setGateM} disabled={ended} required={false} />
            <span className="muted small">min</span>
            {gateMinutes !== null && !ended && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setGateH('');
                  setGateM('');
                }}
              >
                Clear
              </button>
            )}
          </span>
        </label>
        {(gateWarning || (gateMinutes !== null && startMs !== null)) && (
          <p className={`hint${gateWarning ? ' warn' : ''}`} role={gateWarning ? 'alert' : undefined}>
            {gateWarning ??
              `Gates open at ${formatDateTime(new Date(startMs! - gateMinutes! * 60_000).toISOString(), timezone)}${
                gateMinutes! > 0 ? `, ${minutesText(gateMinutes!)} before the start.` : ', when the event starts.'
              }`}
          </p>
        )}
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
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || blocked || uploading}
            title={uploading ? 'Wait for the images to finish uploading' : blocked ? blockedHint : undefined}
          >
            {existing ? (busy ? 'Saving...' : 'Save changes') : busy ? 'Creating...' : 'Create draft event'}
          </button>
        </div>
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

/** Tomorrow's date on this computer, as "YYYY-MM-DD" (what a date input holds). */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
