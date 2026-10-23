import { assetUrl } from '../api/client';
import type { ChangeValue, OrganizationChangeRequest } from '../api/types';
import { orgFieldLabel } from '../utils/orgFields';

/** A changed value: text, or a document list as links to the files. */
function Value({ value, empty }: { value: ChangeValue | undefined; empty: string }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <>None</>;
    return (
      <>
        {value.map((d, i) => (
          <span key={`${d.url}-${i}`}>
            {i > 0 && ', '}
            <a href={assetUrl(d.url)} target="_blank" rel="noreferrer">
              {d.type}
            </a>
          </span>
        ))}
      </>
    );
  }
  return <>{value || empty}</>;
}

/** What a change request changes, one line per field: the value now, then the requested one. */
export function OrgChangeLines({ request }: { request: OrganizationChangeRequest }) {
  return (
    <ul className="org-change-lines">
      {Object.keys(request.requested).map((key) => (
        <li key={key}>
          <strong>{orgFieldLabel(key)}</strong>
          <span className="muted">
            <Value value={request.current[key]} empty="Not set" />
          </span>
          <span aria-hidden="true">→</span>
          <span>
            <Value value={request.requested[key]} empty="Cleared" />
          </span>
        </li>
      ))}
    </ul>
  );
}
