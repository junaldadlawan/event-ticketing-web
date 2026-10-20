import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { organizationApi, payoutCardApi } from '../../api/endpoints';
import type { PayoutCardRequest } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { CardManager } from '../../components/CardManager';
import type { NewCard } from '../../components/CardManager';
import { Empty, ErrorBox, Spinner, PageHeader } from '../../components/ui';
import { LogsButton } from '../../components/LogsButton';
import { useAsync } from '../../utils/useAsync';

/** Settings tab for an organization's owner and organizers. For now: where payouts are sent (Payment). */
export function ManageSettingsPage() {
  const orgs = useAsync(
    async () => (await organizationApi.mine()).filter((o) => o.status === 'APPROVED' || o.status === 'SUSPENDED'),
    [],
  );
  const [orgId, setOrgId] = useState('');
  const selected = orgId || orgs.data?.[0]?.id || '';

  if (orgs.loading && !orgs.data) return <Spinner />;
  if (orgs.error) return <ErrorBox message={orgs.error} />;
  if (!orgs.data || orgs.data.length === 0) return <Empty>You don&apos;t have an organization yet.</Empty>;

  return (
    <>
      <PageHeader
        title="Settings"
        lede={
          orgs.data.length > 1 ? (
            <select value={selected} onChange={(e) => setOrgId(e.target.value)} aria-label="Organization">
              {orgs.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            orgs.data[0].name
          )
        }
        actions={
          <LogsButton
            area="SETTINGS"
            title="Settings"
            organizations={[{ id: selected, name: orgs.data.find((o) => o.id === selected)?.name ?? '' }]}
          />
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings">
          <NavLink to="/manage/settings" end>
            Payment
          </NavLink>
        </nav>
        <div className="settings-panel">
          <h2>Payment</h2>
          <PayoutCards orgId={selected} />
        </div>
      </div>
    </>
  );
}

/** The cards payouts are sent to. Only the owner changes them (the API refuses organizers); an organizer sees the list. */
function PayoutCards({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const members = useAsync(() => organizationApi.members(orgId), [orgId]);
  const isOwner = (members.data ?? []).some((m) => m.userId === user?.id && m.roles.includes('OWNER'));
  const calls = useMemo(
    () => ({
      list: () => payoutCardApi.list(orgId),
      add: (body: NewCard) => payoutCardApi.add(orgId, body as PayoutCardRequest),
      setPrimary: (id: string) => payoutCardApi.setPrimary(id),
      remove: (id: string) => payoutCardApi.remove(id),
    }),
    [orgId],
  );
  return (
    <CardManager
      key={orgId}
      calls={calls}
      canEdit={isOwner}
      intro="Payouts are sent to the primary payout account."
      emptyText="No payout account yet. Add one to receive payouts."
      addLabel="Add payout account"
    />
  );
}
