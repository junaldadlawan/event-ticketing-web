// Organizer posts for an event's landing page. The API has no announcements endpoint yet, so they are kept in
// this browser only (localStorage): a stand-in until the backend can store and serve them to every buyer.

export type PostKind = 'ANNOUNCEMENT' | 'SALE';

export interface EventPost {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  createdAt: string;
}

const key = (eventId: string) => `eventPosts:${eventId}`;

export function loadPosts(eventId: string): EventPost[] {
  try {
    const raw = localStorage.getItem(key(eventId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as EventPost[]) : [];
  } catch {
    return [];
  }
}

function savePosts(eventId: string, posts: EventPost[]) {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(posts));
  } catch {
    /* private window or blocked storage: the post just won't be remembered */
  }
}

/** Newest first. */
export function addPost(eventId: string, post: Pick<EventPost, 'kind' | 'title' | 'body'>): EventPost[] {
  const next: EventPost = {
    ...post,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const posts = [next, ...loadPosts(eventId)];
  savePosts(eventId, posts);
  return posts;
}

export function removePost(eventId: string, postId: string): EventPost[] {
  const posts = loadPosts(eventId).filter((p) => p.id !== postId);
  savePosts(eventId, posts);
  return posts;
}
