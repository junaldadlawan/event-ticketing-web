import { assetUrl } from '../../api/client';
import { DOCUMENT_TYPES } from '../../utils/orgFields';

/** One document being edited: its type and link; `edit: false` shows an existing one as a link with a Change button. */
export interface DocRow {
  type: string;
  url: string;
  edit?: boolean;
}

/**
 * The verification documents of an organization (type + link per row, "+ Add another"). A row marked `edit: false` is shown as
 * a link until Change is pressed; `allowRemove` lets more than one row be dropped (an application needs at least one).
 */
export function DocumentRows({
  docs,
  onChange,
  allowRemove,
}: {
  docs: DocRow[];
  onChange: (next: DocRow[]) => void;
  allowRemove?: boolean;
}) {
  const update = (i: number, patch: Partial<DocRow>) => onChange(docs.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <>
      {docs.length === 0 && <p className="muted small">None yet.</p>}
      {docs.map((d, i) => (
        <div key={i} className="doc-row">
          {d.edit === false ? (
            <>
              <a href={assetUrl(d.url)} target="_blank" rel="noreferrer">
                {d.type}
              </a>
              <button type="button" className="btn btn-sm" onClick={() => update(i, { edit: true })}>
                Change document
              </button>
            </>
          ) : (
            <>
              <select aria-label={`Document ${i + 1} type`} value={d.type} onChange={(e) => update(i, { type: e.target.value })}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="url"
                required
                maxLength={500}
                placeholder="https://..."
                aria-label={`Document ${i + 1} URL`}
                value={d.url}
                onChange={(e) => update(i, { url: e.target.value })}
              />
              {allowRemove && docs.length > 1 && (
                <button type="button" className="btn btn-link danger" aria-label={`Remove document ${i + 1}`} onClick={() => onChange(docs.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-link" onClick={() => onChange([...docs, { type: DOCUMENT_TYPES[0], url: '', edit: true }])}>
        {docs.length === 0 ? '+ Add document' : '+ Add another document'}
      </button>
    </>
  );
}
