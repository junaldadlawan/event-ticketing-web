import { useEffect, useRef } from 'react';
import type { PageResponse, Post } from '../api/types';

const CHANNEL = 'et.posts';

/** Tells every other open tab of the app that posts changed (hidden, deleted, added...), so they refresh at once. */
export function notifyPostsChanged() {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  } catch {
    /* BroadcastChannel not available: the other tabs still catch up on their next refresh */
  }
}

/**
 * Keeps a public post list up to date without a page reload: re-fetches quietly every `everyMs`, when the tab
 * comes back into view, and right away when another tab reports a change. A failed refresh is ignored (the list
 * on screen stays as it is). `apply` is the list's own setter.
 */
export function useLivePosts(
  fetchPosts: () => Promise<PageResponse<Post>>,
  apply: (page: PageResponse<Post>) => void,
  everyMs = 30_000,
) {
  const fetchRef = useRef(fetchPosts);
  const applyRef = useRef(apply);
  fetchRef.current = fetchPosts;
  applyRef.current = apply;

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      fetchRef.current().then((page) => applyRef.current(page)).catch(() => {});
    };
    const timer = window.setInterval(refresh, everyMs);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = refresh;
    } catch {
      /* no cross-tab messages */
    }
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      channel?.close();
    };
  }, [everyMs]);
}
