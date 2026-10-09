import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import type { Post } from '../../api/types';
import { postApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { PlusIcon } from '../../components/DesignerIcons';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EventPostsFeed } from '../../components/EventPostsFeed';
import { PostComposer } from '../../components/PostComposer';
import { PostViewToggle, usePostView } from '../../components/PostViewToggle';
import { Empty, ErrorBox, Pagination, Spinner } from '../../components/ui';
import { notifyPostsChanged } from '../../utils/livePosts';
import { useAsync } from '../../utils/useAsync';

/** Admin tab: write sales and announcements (for everyone on Home, or for one event) and remove old ones. */
export function AdminPostsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [page, setPage] = useState(0);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [view, setView] = usePostView();
  const [composing, setComposing] = useState(false);
  // The post being edited (opens the same window as "Create post", filled in).
  const [editing, setEditing] = useState<Post | null>(null);
  // A post waiting for a "yes" before it is hidden or deleted (showing a hidden post needs no confirmation).
  const [confirming, setConfirming] = useState<{ post: Post; action: 'hide' | 'delete' } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const open = composing || editing !== null;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [composing, editing]);
  const posts = useAsync(() => postApi.list({ page, size: 20, all: true }), [page]);

  /** Refresh this list, and tell other open tabs (Home, landing pages) so they update at once. */
  function afterChange() {
    posts.reload();
    notifyPostsChanged();
  }

  async function setHidden(post: Post, hidden: boolean) {
    setRemoveError(null);
    try {
      await postApi.update(post.id, { hidden });
      afterChange();
    } catch (e) {
      setRemoveError(errorMessage(e));
    }
  }

  async function confirmAction() {
    const c = confirming;
    setConfirming(null);
    if (!c) return;
    if (c.action === 'hide') {
      await setHidden(c.post, true);
      return;
    }
    setRemoveError(null);
    try {
      await postApi.remove(c.post.id);
      afterChange();
    } catch (e) {
      setRemoveError(errorMessage(e));
    }
  }

  if (authLoading) return <Spinner />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <div className="row-between page-header">
        <h1>Posts</h1>
        <button type="button" className="btn btn-primary" onClick={() => setComposing(true)}>
          <PlusIcon />
          Create post
        </button>
      </div>
      <p className="muted">Sales and announcements buyers see on the Home page and on each event's landing page.</p>

      <dialog
        ref={dialog}
        className="modal post-dialog"
        aria-labelledby="new-post-title"
        onCancel={(e) => {
          e.preventDefault(); // Escape closes it
          setComposing(false);
          setEditing(null);
        }}
      >
        <div className="modal-head">
          <h2 id="new-post-title">{editing ? 'Edit post' : 'Create post'}</h2>
        </div>
        {(composing || editing) && (
          <PostComposer
            key={editing?.id ?? 'new'}
            initial={
              editing
                ? {
                    kind: editing.kind,
                    title: editing.title,
                    body: editing.body,
                    publishAt: editing.publishAt,
                    expiresAt: editing.expiresAt,
                    hidden: editing.hidden,
                    imageUrl: editing.imageUrl,
                  }
                : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Post'}
            onCancel={() => {
              setComposing(false);
              setEditing(null);
            }}
            onPost={async (p) => {
              if (editing) {
                await postApi.update(editing.id, {
                  kind: p.kind,
                  title: p.title,
                  body: p.body,
                  publishAt: p.publishAt,
                  expiresAt: p.expiresAt,
                  hidden: p.hidden,
                  imageUrl: p.imageUrl,
                  clearPublishAt: p.clearPublishAt,
                  clearExpiresAt: p.clearExpiresAt,
                });
                setEditing(null);
                afterChange();
              } else {
                await postApi.create(p);
                setComposing(false);
                if (page === 0) afterChange();
                else {
                  setPage(0);
                  notifyPostsChanged();
                }
              }
            }}
          />
        )}
      </dialog>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.action === 'delete' ? `Delete "${confirming.post.title}"?` : `Hide "${confirming?.post.title ?? ''}"?`}
        confirmLabel={confirming?.action === 'delete' ? 'Delete' : 'Hide'}
        cancelLabel="Cancel"
        danger={confirming?.action === 'delete'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmAction()}
      >
        {confirming?.action === 'delete'
          ? "This removes the post for good. If you only want it off the site for now, hide it instead."
          : 'It stops showing to the public right away. You can show it again at any time.'}
      </ConfirmDialog>

      <div className="row-between">
        <h2>Published</h2>
        <PostViewToggle view={view} onChange={setView} />
      </div>
      <ErrorBox message={posts.error ?? removeError} />
      {posts.loading && !posts.data ? (
        <Spinner />
      ) : !posts.data || posts.data.content.length === 0 ? (
        <Empty>No posts yet.</Empty>
      ) : (
        <>
          <EventPostsFeed
            posts={posts.data.content}
            showEvent
            layout={view}
            showSchedule
            onEdit={setEditing}
            onToggleHidden={(post) => (post.hidden ? void setHidden(post, false) : setConfirming({ post, action: 'hide' }))}
            onRemove={(id) => {
              const post = posts.data?.content.find((x) => x.id === id);
              if (post) setConfirming({ post, action: 'delete' });
            }}
          />
          <Pagination page={posts.data} onChange={setPage} />
        </>
      )}
    </>
  );
}
