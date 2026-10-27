import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { layoutApi, organizationApi, presetApi } from '../../api/endpoints';
import type { PresetLayoutSummary, SeatLayoutSummary, UUID } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { useHasPermission } from '../../auth/useCanManage';
import { Button, FormActions } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SelectField } from '../../components/fields/TextField';
import { FormDialog } from '../../components/FormDialog';
import { LayoutCard } from '../../components/LayoutCard';
import { RefreshButton } from '../../components/RefreshButton';
import { Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';

type OrgLayouts = { id: UUID; name: string; layouts: SeatLayoutSummary[] };

/** The seat layouts of the organizations you work for: design one, or copy an admin preset and change it. Events copy their seats from these. */
export function LayoutsPage() {
  const canEdit = useHasPermission('EVENTS', 'any') && !isAdmin(useAuth().user?.role);
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(async () => {
    const orgs = (await organizationApi.mine()).filter((o) => o.status === 'APPROVED');
    const groups: OrgLayouts[] = await Promise.all(orgs.map(async (o) => ({ id: o.id, name: o.name, layouts: await layoutApi.listForOrg(o.id) })));
    // Presets are only for those who can start a layout; a failure here must not hide the layouts.
    const presets = canEdit ? await presetApi.list().catch(() => [] as PresetLayoutSummary[]) : [];
    return { groups, presets };
  }, [canEdit]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SeatLayoutSummary | null>(null);
  // "From a preset": which organization it is copied into, and which preset.
  const [copyInto, setCopyInto] = useState<OrgLayouts | null>(null);
  const [presetId, setPresetId] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = data?.groups ?? [];
  const presets = (data?.presets ?? []).filter((p) => p.active);

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

  async function copyPreset(e: FormEvent) {
    e.preventDefault();
    if (!copyInto || !presetId) return;
    setBusy(true);
    setActionError(null);
    try {
      const copy = await layoutApi.fromPreset(copyInto.id, presetId);
      navigate(`/manage/layouts/${copy.id}`);
    } catch (ex) {
      setActionError(errorMessage(ex));
      setCopyInto(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Seat layouts" lede="Design a seating plan once, then copy its sections into the events that sell reserved seats." />
      <ErrorBox message={error ?? actionError} />
      {loading && !data ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty>No approved organization yet, so there are no layouts.</Empty>
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
                  {presets.length > 0 && (
                    <Button
                      onClick={() => {
                        setPresetId(presets[0]!.id);
                        setCopyInto(g);
                      }}
                    >
                      From a preset
                    </Button>
                  )}
                  <Button variant="cta" onClick={() => navigate(`/manage/layouts/new?org=${g.id}`)}>
                    New layout
                  </Button>
                </div>
              )}
            </div>
            {g.layouts.length === 0 ? (
              <Empty>No layouts yet.</Empty>
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

      <FormDialog open={copyInto !== null} title="Start from a preset" onClose={() => setCopyInto(null)}>
        <form className="form" onSubmit={copyPreset}>
          <SelectField label="Preset" hint="You get your own copy to change; the preset itself stays as it is." value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.seatCount} seats)
              </option>
            ))}
          </SelectField>
          <p className="muted small">{presets.find((p) => p.id === presetId)?.description}</p>
          <FormActions submitLabel={busy ? 'Copying…' : 'Copy preset'} submitDisabled={busy || !presetId} onCancel={() => setCopyInto(null)} />
        </form>
      </FormDialog>

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
