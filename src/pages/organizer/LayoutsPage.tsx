import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { layoutApi, organizationApi, presetApi } from '../../api/endpoints';
import type { PresetLayoutSummary, SeatLayoutSummary, UUID } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { useHasPermission } from '../../auth/useCanManage';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CopyPresetButton } from '../../components/CopyPresetButton';
import { SelectField } from '../../components/fields/TextField';
import { LayoutCard } from '../../components/LayoutCard';
import { RefreshButton } from '../../components/RefreshButton';
import { VenueTabs } from '../../components/VenueTabs';
import { Tabs } from '../../components/Tabs';
import { Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';

type OrgLayouts = { id: UUID; name: string; layouts: SeatLayoutSummary[] };
type Tab = 'mine' | 'presets';

/** The seat layouts of the organizations you work for: design one, or open an admin preset and copy it. Events copy their seats from these. */
export function LayoutsPage() {
  const { user } = useAuth();
  const canEdit = useHasPermission('EVENTS', 'any') && !isAdmin(user?.role);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'presets' && canEdit ? 'presets' : 'mine';
  const { data, error, loading, reload } = useAsync(async () => {
    const orgs = (await organizationApi.mine()).filter((o) => o.status === 'APPROVED');
    const groups: OrgLayouts[] = await Promise.all(orgs.map(async (o) => ({ id: o.id, name: o.name, layouts: await layoutApi.listForOrg(o.id) })));
    // Presets are only for those who can start a layout; a failure here must not hide the layouts.
    const presets = canEdit ? await presetApi.list().catch(() => [] as PresetLayoutSummary[]) : [];
    return { groups, presets };
  }, [canEdit]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SeatLayoutSummary | null>(null);
  // The organization a preset is copied into (only asked when you work for several).
  const [copyOrg, setCopyOrg] = useState('');

  const groups = data?.groups ?? [];
  const presets = (data?.presets ?? []).filter((p) => p.active);
  const intoOrg = copyOrg || groups[0]?.id || '';

  async function confirmDelete() {
    const l = deleting;
    if (!l) return;
    setDeleting(null);
    setActionError(null);
    try {
      await layoutApi.remove(l.id);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <>
      <VenueTabs />
      <PageHeader
        title="Venues & seat layouts"
        lede="Design a seating plan once, then copy its sections into the events that sell reserved seats."
      />
      {canEdit && (
        <Tabs<Tab>
          label="Seat layouts"
          value={tab}
          onChange={(t) => setParams(t === 'presets' ? { tab: 'presets' } : {})}
          items={[
            { key: 'mine', label: 'My layouts' },
            { key: 'presets', label: 'Presets', count: presets.length },
          ]}
        />
      )}
      <ErrorBox message={error ?? actionError} />
      {loading && !data ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty>No approved organization yet, so there are no layouts.</Empty>
      ) : tab === 'presets' ? (
        <section className="card">
          <div className="section-head">
            <div className="section-title">
              <h2>Presets</h2>
              <RefreshButton onClick={reload} busy={loading} label="Reload presets" />
            </div>
            {groups.length > 1 && (
              <SelectField label="Copy into" value={intoOrg} onChange={(e) => setCopyOrg(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
          <p className="muted small">Ready-made plans from the admin. Open one to look at it, then copy it to get your own version to change.</p>
          {presets.length === 0 ? (
            <Empty>No presets are available yet.</Empty>
          ) : (
            <ul className="layout-grid">
              {presets.map((p) => (
                <LayoutCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  seatCount={p.seatCount}
                  note={p.description && <span className="layout-card-about">{p.description}</span>}
                  to={`/manage/layouts/presets/${p.id}`}
                  openLabel="View"
                  load={() => presetApi.get(p.id)}
                  actions={<CopyPresetButton presetId={p.id} presetName={p.name} orgId={intoOrg} onError={setActionError} />}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="card">
            <div className="section-head">
              <div className="section-title">
                <h2>{groups.length > 1 ? g.name : 'Your layouts'}</h2>
                <RefreshButton onClick={reload} busy={loading} label="Reload layouts" />
              </div>
              {canEdit && (
                <div className="page-actions">
                  <Link to={`/manage/layouts/new?org=${g.id}`} className="btn btn-cta">
                    New layout
                  </Link>
                </div>
              )}
            </div>
            {g.layouts.length === 0 ? (
              <Empty>
                No layouts yet.
                {canEdit && presets.length > 0 && (
                  <>
                    {' '}
                    <button type="button" className="btn-link" onClick={() => setParams({ tab: 'presets' })}>
                      Start from a preset
                    </button>
                  </>
                )}
              </Empty>
            ) : (
              <ul className="layout-grid">
                {g.layouts.map((l) => (
                  <LayoutCard
                    key={l.id}
                    id={l.id}
                    name={l.name}
                    seatCount={l.seatCount}
                    to={`/manage/layouts/${l.id}`}
                    openLabel={canEdit ? 'Edit layout' : 'View layout'}
                    load={() => layoutApi.get(l.id)}
                    actions={
                      canEdit && (
                        <Button size="sm" variant="danger" onClick={() => setDeleting(l)}>
                          Delete
                        </Button>
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this layout'}?`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        The layout is removed. Events that already copied seats from it keep them, but it can't be deleted while an event that hasn't ended still uses it.
      </ConfirmDialog>
    </>
  );
}
