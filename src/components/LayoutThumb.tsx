import type { VenueLayout } from '../api/types';
import { SEAT_R } from '../utils/venueLayout';

/** A small, read-only picture of a seat plan: seats as dots in their section colours, with the stage, labels and walls. */
export function LayoutThumb({ layout, label }: { layout: VenueLayout; label: string }) {
  return (
    <svg className="layout-thumb" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect width={layout.width} height={layout.height} fill="#ffffff" />
      {(layout.shapes ?? []).map((sh, i) => (
        <g key={i} transform={`translate(${sh.x} ${sh.y}) rotate(${sh.rotation ?? 0})`}>
          {sh.type === 'LABEL' ? (
            <text fontSize={20} fontWeight={600} fill="#111827">
              {sh.text}
            </text>
          ) : (
            <rect width={sh.width ?? 0} height={sh.height ?? 0} rx={6} fill={sh.type === 'STAGE' ? '#1f2937' : '#94a3b8'} />
          )}
        </g>
      ))}
      {layout.sections.map((sec) => (
        <g key={sec.id} transform={`translate(${sec.x} ${sec.y}) rotate(${sec.rotation ?? 0})`}>
          {sec.rows.map((r) =>
            r.seats.map((s) => <circle key={`${r.label}${s.number}`} cx={s.x + (r.offset ?? 0)} cy={s.y} r={SEAT_R} fill={sec.color} opacity={s.type === 'BLOCKED' ? 0.25 : 1} />),
          )}
        </g>
      ))}
    </svg>
  );
}
