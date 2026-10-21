import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, assetUrl, errorMessage } from '../api/client';
import { recapApi, reviewApi, ticketApi, uploadApi } from '../api/endpoints';
import type { Event, EventReview } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';
import { useHasPermission } from '../auth/useCanManage';
import { useManagementHidden } from '../auth/ViewMode';
import { formatDateTime } from '../utils/format';
import { useAsync } from '../utils/useAsync';
import { ConfirmDialog } from './ConfirmDialog';
import { FormDialog } from './FormDialog';
import { TrashIcon } from './DesignerIcons';
import { ErrorBox } from './ui';

/** Five stars, filled up to `value` (rounded for an average). */
function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * A finished event: the public rating, thanks and a review form for the people who were let in, the attendees'
 * comments for the organizers, and the organizer's recap feed.
 */
export function EventRecap({ event }: { event: Event }) {
  const { user } = useAuth();
  const managementHidden = useManagementHidden();
  // The API decides; these only choose what to show (comments: ANALYTICS; posting: EVENTS, which admins can't).
  const seesComments = useHasPermission('ANALYTICS', event.organizationId) && !managementHidden;
  const canEdit = useHasPermission('EVENTS', event.organizationId) && !managementHidden;
  const canPost = canEdit && !isAdmin(user?.role);

  const summary = useAsync(() => reviewApi.summary(event.id), [event.id]);
  // Only people who were let in (a used ticket) may rate it; the API refuses anyone else.
  const attended = useAsync(
    () =>
      user
        ? ticketApi.mine({ eventId: event.id, status: 'USED', size: 1 }).then((p) => p.totalElements > 0)
        : Promise.resolve(false),
    [user?.id, event.id],
  );
  // Their own review: null = none yet (the API answers 404).
  const mine = useAsync(
    () =>
      attended.data
        ? reviewApi
            .mine(event.id)
            .catch((e: unknown) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)))
        : Promise.resolve(null),
    [attended.data, event.id],
  );
  const [rating, setRating] = useState(false);

  // The first time an attendee opens the event without having rated it, ask once; this browser remembers it asked.
  useEffect(() => {
    if (!user || !attended.data || mine.loading || mine.error || mine.data) return;
    const key = `et.ratePrompted.${user.id}.${event.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return; // no storage: never pop up, the star button is still there
    }
    setRating(true);
  }, [user, attended.data, mine.loading, mine.error, mine.data, event.id]);

  return (
    <section className="event-ended">
      <div className="row-between event-ended-head">
        <h2>This event has ended</h2>
        <span className="event-ended-rating">
          {summary.data && (
            <span className="rating-summary">
              {summary.data.averageRating !== null ? (
                <>
                  <Stars value={summary.data.averageRating} />
                  <strong>{summary.data.averageRating.toFixed(1)}</strong>
                  <span className="muted small">
                    {summary.data.count} {summary.data.count === 1 ? 'rating' : 'ratings'}
                  </span>
                </>
              ) : (
                <span className="muted small">No ratings yet</span>
              )}
            </span>
          )}
          {attended.data && !mine.loading && (
            <button type="button" className="btn btn-sm rate-button" onClick={() => setRating(true)}>
              <span className="rate-star" aria-hidden="true">
                ★
              </span>
              {mine.data ? `You rated it ${mine.data.rating}` : 'Rate this event'}
            </button>
          )}
        </span>
      </div>

      {attended.data && (
        <p className="event-thanks">Thanks for coming to {event.title}! We hope you had a great time.</p>
      )}
      <ErrorBox message={mine.error} />
      <FormDialog open={rating} title={`Rate ${event.title}`} onClose={() => setRating(false)}>
        <ReviewForm
          event={event}
          review={mine.data}
          onDone={(saved) => {
            mine.setData(saved);
            summary.reload();
            setRating(false);
          }}
          onCancel={() => setRating(false)}
        />
      </FormDialog>
      {seesComments && <ReviewComments eventId={event.id} />}
      <RecapFeed event={event} canPost={canPost} canDelete={canEdit} />
    </section>
  );
}

/** The visitor's own review, in the rating pop-up: stars and an optional comment only the organizers see. */
function ReviewForm({
  event,
  review,
  onDone,
  onCancel,
}: {
  event: Event;
  review: EventReview | null;
  /** Saved (the new review) or deleted (null). */
  onDone: (review: EventReview | null) => void;
  onCancel: () => void;
}) {
  // The pop-up mounts this afresh each time it opens, so the saved review is the starting point.
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      const text = comment.trim() || null;
      onDone(review ? await reviewApi.update(event.id, rating, text) : await reviewApi.create(event.id, rating, text));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmingDelete(false);
    setBusy(true);
    setError(null);
    try {
      await reviewApi.remove(event.id);
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form review-form" onSubmit={save}>
      <p className="small muted">We hope you had a great time. How was it?</p>
      <div className="star-input" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className={n <= rating ? 'is-on' : ''}
            disabled={busy}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <label>
        Anything to tell the organizer? (optional)
        <textarea rows={3} maxLength={1000} value={comment} disabled={busy} onChange={(e) => setComment(e.target.value)} />
      </label>
      <small className="muted">Everyone sees your stars. Only the organizer sees your comment.</small>
      <ErrorBox message={error} />
      <div className="modal-actions">
        {review && (
          <button type="button" className="btn danger review-delete" disabled={busy} onClick={() => setConfirmingDelete(true)}>
            Delete review
          </button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {review ? 'Cancel' : 'Not now'}
        </button>
        <button className="btn btn-primary" disabled={busy || rating < 1}>
          {busy ? 'Saving…' : review ? 'Update rating' : 'Send rating'}
        </button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete your review?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingDelete(false)}
      >
        Your rating and comment are removed. You can rate it again afterwards.
      </ConfirmDialog>
    </form>
  );
}

/** What attendees said, comments included: only the owner, ANALYTICS organizers and admins get this list. */
function ReviewComments({ eventId }: { eventId: string }) {
  // shortcut: the newest 50 only, no paging; add Pagination once events get more reviews than that.
  const reviews = useAsync(() => reviewApi.list(eventId, { size: 50 }), [eventId]);
  if (!reviews.data) return <ErrorBox message={reviews.error} />;
  return (
    <div className="review-comments">
      <h3>What attendees said</h3>
      <p className="muted small">Only you and the other organizers see these comments.</p>
      {reviews.data.content.length === 0 ? (
        <p className="muted small">No reviews yet.</p>
      ) : (
        <ul className="plain-list">
          {reviews.data.content.map((r) => (
            <li key={r.id} className="review-comment">
              <div className="row-between">
                <span>
                  <Stars value={r.rating} /> <strong>{r.reviewerName ?? 'Attendee'}</strong>
                </span>
                <span className="muted small">{formatDateTime(r.createdAt)}</span>
              </div>
              {r.comment ? <p>{r.comment}</p> : <p className="muted small">No comment.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The organizer's messages and pictures after the event, like a chat, oldest first. */
function RecapFeed({ event, canPost, canDelete }: { event: Event; canPost: boolean; canDelete: boolean }) {
  const feed = useAsync(() => recapApi.list(event.id), [event.id]);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = feed.data ?? [];

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !file) return;
    setBusy(true);
    setError(null);
    try {
      // A chosen picture is uploaded first; its URL then goes with the message.
      const imageUrl = file ? (await uploadApi.image(file)).url : null;
      const sent = await recapApi.post(event.id, body.trim() || null, imageUrl);
      feed.setData([...messages, sent]);
      setBody('');
      setFile(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    setError(null);
    try {
      await recapApi.remove(event.id, id);
      feed.setData(messages.filter((m) => m.id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // Nothing to show a visitor until the organizer has posted.
  if (!canPost && messages.length === 0) return <ErrorBox message={feed.error} />;

  return (
    <div className="recap">
      <h3>From the organizer</h3>
      {messages.length === 0 ? (
        <p className="muted small">Share photos and a few words about how the event went. Everyone can see them.</p>
      ) : (
        <ol className="recap-feed">
          {messages.map((m) => (
            <li key={m.id} className="recap-message">
              <div className="recap-meta small">
                <strong>{m.organizationName ?? m.authorName ?? 'Organizer'}</strong>
                <time className="muted" dateTime={m.createdAt}>
                  {formatDateTime(m.createdAt, event.timezone)}
                </time>
                {canDelete && (
                  <button
                    type="button"
                    className="icon-button recap-delete"
                    title="Delete message"
                    aria-label="Delete message"
                    onClick={() => setDeleting(m.id)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
              <div className="recap-bubble">
                {m.imageUrl && <img src={assetUrl(m.imageUrl)} alt="" loading="lazy" />}
                {m.body && <p>{m.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <ErrorBox message={error ?? feed.error} />
      {canPost && (
        <form className="recap-composer" onSubmit={send}>
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="Write a message…"
            aria-label="Message"
            value={body}
            disabled={busy}
            onChange={(e) => setBody(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = ''; // allow choosing the same picture again
            }}
          />
          <div className="recap-composer-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {file ? 'Change picture' : 'Add a picture'}
            </button>
            {file && (
              <span className="small muted">
                {file.name}{' '}
                <button type="button" className="btn btn-link btn-sm" disabled={busy} onClick={() => setFile(null)}>
                  Remove
                </button>
              </span>
            )}
            <button className="btn btn-primary btn-sm" disabled={busy || (!body.trim() && !file)}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this message?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      >
        It disappears from the recap for everyone.
      </ConfirmDialog>
    </div>
  );
}
