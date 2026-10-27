import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { presetApi } from '../../api/endpoints';
import type { PresetLayoutSummary } from '../../api/types';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LayoutCard } from '../../components/LayoutCard';
import { RefreshButton } from '../../components/RefreshButton';
import { Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

/** Ready-made seat layouts organizers can copy into their organization. Copies already made are never changed. */
export function AdminLayoutPresetsPage() {
  const { data, error, loading, reload } = useAsync(() => presetApi.list(), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PresetLayoutSummary | null>(null);

  async function confirmDelete() {
    const p = deleting;
    if (!p) return;
    setDeleting(null);
    setActionError(null);
    try {
      await presetApi.remove(p.id);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <AdminOnly>
      <PageHeader
        title="Seat layout presets"
        lede="Organizers see the active ones and can copy them into their organization."
        actions={
          <>
            <RefreshButton onClick={reload} busy={loading} label="Reload presets" />
            <Link className="btn btn-cta" to="/admin/layout-presets/new">
              New preset
            </Link>
          </>
        }
      />
      <ErrorBox message={error ?? actionError} />
      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <Empty>No presets yet.</Empty>
      ) : (
        <ul className="layout-grid">
          {data.map((p) => (
            <LayoutCard
              key={p.id}
              id={p.id}
              name={p.name}
              seatCount={p.seatCount}
              note={
                <>
                  {!p.active && ' · inactive'}
                  {p.description && <span> · {p.description}</span>}
                </>
              }
              to={`/admin/layout-presets/${p.id}`}
              openLabel="Edit preset"
              load={() => presetApi.get(p.id)}
              actions={
                <Button size="sm" variant="danger" onClick={() => setDeleting(p)}>
                  Delete
                </Button>
              }
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this preset'}?`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        Organizers can no longer copy it. Layouts already copied from it are kept.
      </ConfirmDialog>
    </AdminOnly>
  );
}
