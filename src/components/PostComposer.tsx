import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PostKind } from '../utils/eventPosts';

/** Form to write a sale or announcement. Only shown to admins; the caller decides where the post goes. */
export function PostComposer({ onPost }: { onPost: (post: { kind: PostKind; title: string; body: string }) => void }) {
  const [kind, setKind] = useState<PostKind>('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onPost({ kind, title: title.trim(), body: body.trim() });
    setTitle('');
    setBody('');
  }

  return (
    <form className="form post-composer" onSubmit={onSubmit}>
      <div className="two-col">
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as PostKind)}>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="SALE">Sale</option>
          </select>
        </label>
        <label>
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'SALE' ? 'Early bird: 20% off this week' : 'Doors now open at 5 PM'}
          />
        </label>
      </div>
      <label>
        Details
        <textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="modal-actions">
        <button className="btn btn-primary" disabled={!title.trim()}>
          Post
        </button>
      </div>
    </form>
  );
}
