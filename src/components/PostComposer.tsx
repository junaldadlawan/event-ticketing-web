import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { uploadApi } from '../api/endpoints';
import type { Event, PostKind } from '../api/types';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { ErrorBox } from './ui';

/** Form to write a sale or announcement. Only shown to admins; the caller decides where the post goes. */
export function PostComposer({
  onPost,
  events,
  initial,
  submitLabel = 'Post',
  onCancel,
}: {
  /** Saves the post; throw to show the error under the form. */
  onPost: (post: {
    kind: PostKind;
    title: string;
    body: string;
    eventId?: string;
    publishAt?: string;
    expiresAt?: string;
    hidden: boolean;
    /** The picture to keep / set: a URL, '' = remove it (editing), undefined = no picture / unchanged. */
    imageUrl?: string;
    /** Editing only: the post had this date and it was emptied. */
    clearPublishAt?: boolean;
    clearExpiresAt?: boolean;
  }) => Promise<void>;
  /** When given, a "Where" choice appears: the whole site (Home) or one of these events. */
  events?: Event[];
  /** Fill the form with an existing post to edit it (the "Where" choice is then not shown). */
  initial?: { kind: PostKind; title: string; body: string; publishAt?: string | null; expiresAt?: string | null; hidden?: boolean; imageUrl?: string | null };
  submitLabel?: string;
  /** When given, a Cancel button is shown next to Post (used when the form sits in a dialog). */
  onCancel?: () => void;
}) {
  const [eventId, setEventId] = useState('');
  const [kind, setKind] = useState<PostKind>(initial?.kind ?? 'ANNOUNCEMENT');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  // Optional schedule, as datetime-local values (empty = publish now / never expires).
  const [publishAt, setPublishAt] = useState(initial?.publishAt ? isoToLocalInput(initial.publishAt) : '');
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? isoToLocalInput(initial.expiresAt) : '');
  const [hidden, setHidden] = useState(initial?.hidden ?? false);
  // Optional picture: the post's current one (editing), or a newly chosen file that is uploaded on save.
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!imageFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    // A new post must expire in the future; when editing, a past expiry just ends the post now.
    if (!initial && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setError('The expiry must be in the future.');
      return;
    }
    if (expiresAt && publishAt && new Date(expiresAt).getTime() <= new Date(publishAt).getTime()) {
      setError('The expiry must be after the publish time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // A newly chosen picture is uploaded first; its URL then goes with the post.
      const uploaded = imageFile ? (await uploadApi.image(imageFile)).url : null;
      const finalImage = uploaded ?? imageUrl;
      await onPost({
        kind,
        title: title.trim(),
        body: body.trim(),
        eventId: eventId || undefined,
        publishAt: publishAt ? localInputToIso(publishAt) : undefined,
        expiresAt: expiresAt ? localInputToIso(expiresAt) : undefined,
        hidden,
        // unchanged picture -> leave it out; removed -> ''; new one -> its URL
        imageUrl: finalImage === (initial?.imageUrl ?? null) ? undefined : (finalImage ?? ''),
        clearPublishAt: Boolean(initial?.publishAt) && !publishAt,
        clearExpiresAt: Boolean(initial?.expiresAt) && !expiresAt,
      });
      if (!initial) {
        setTitle('');
        setBody('');
        setPublishAt('');
        setExpiresAt('');
        setHidden(false);
        setImageUrl(null);
        setImageFile(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form post-composer" onSubmit={onSubmit}>
      <div className="post-composer-grid">
        <label className="span-2">
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'SALE' ? 'Early bird: 20% off this week' : 'Doors now open at 5 PM'}
          />
        </label>
        {events && !initial && (
          <label>
            Where
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Everyone (Home page)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="span-2">
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as PostKind)}>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="SALE">Sale</option>
          </select>
        </label>
        <label className="span-2">
          Details
          <textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="span-2 post-picture">
          <span>
            Picture <span className="muted">(optional)</span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                setError('That picture is over 5 MB. Please choose a smaller one.');
                return;
              }
              setError(null);
              setImageFile(file);
            }}
          />
          {preview || imageUrl ? (
            <div className="post-picture-row">
              <img src={preview ?? imageUrl ?? ''} alt="" />
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                Change
              </button>
              <button
                type="button"
                className="btn-link"
                disabled={busy}
                onClick={() => {
                  setImageFile(null);
                  setImageUrl(null);
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-sm post-picture-add" disabled={busy} onClick={() => fileRef.current?.click()}>
              Add a picture
            </button>
          )}
        </div>
        <label title="Leave empty to publish right away">
          <span>
            Publish at <span className="muted">(optional)</span>
          </span>
          <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
        </label>
        <label title="Leave empty to keep the post up">
          <span>
            Expires at <span className="muted">(optional)</span>
          </span>
          <input
            type="datetime-local"
            value={expiresAt}
            min={publishAt || undefined}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <label className="span-2 check-row">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          Hide from the public (keep it as a draft)
        </label>
      </div>
      <ErrorBox message={error} />
      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" disabled={!title.trim() || busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
