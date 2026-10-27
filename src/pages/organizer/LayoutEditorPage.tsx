import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { QuantityField } from '../../components/fields/QuantityField';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { layoutApi, presetApi } from '../../api/endpoints';
import type { LayoutSection, LayoutShape, PresetLayoutRequest, SeatLayoutSummary, SeatType, UUID, VenueLayout } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { useHasPermission } from '../../auth/useCanManage';
import { CheckIcon, GridLinesIcon, MagnetIcon, PlusIcon, RedoIcon, SaveIcon, SpinnerIcon, UndoIcon, WarningIcon } from '../../components/DesignerIcons';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TextField } from '../../components/fields/TextField';
import { FormDialog } from '../../components/FormDialog';
import { Popover } from '../../components/Popover';
import { ErrorBox, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';
import { buildRows, DEFAULT_PARAMS, layoutIssues, newId, paramsOf, SEAT_R, seatCount, sectionBounds, sectionBox, shapeBounds, worldPoint } from '../../utils/venueLayout';
import type { Rect, SectionParams } from '../../utils/venueLayout';

type Sel = { t: 'section'; id: string } | { t: 'shape'; i: number } | null;
type Brush = 'move' | 'hand' | SeatType;
type DotKey = 'tl' | 'tr' | 'bl' | 'br' | 'c';

const COLORS = ['#6D28D9', '#D97706', '#0D9488', '#E11D48', '#2563EB', '#16A34A', '#64748B'];
const HISTORY = 100;
const BLANK: VenueLayout = { width: 1000, height: 800, sections: [], shapes: [] };

/** An organization's seat layout: design the plan once, with VIP and standard sections, then copy sections of it into events with reserved seating. */
export function LayoutEditorPage() {
  const { layoutId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(() => (layoutId ? layoutApi.get(layoutId) : Promise.resolve(null)), [layoutId]);
  // A new layout names its organization in the address (?org=); a saved one knows its own.
  const orgId = data?.organizationId ?? search.get('org') ?? '';
  const canEvents = useHasPermission('EVENTS', orgId || undefined);
  if (loading && !data) return <Spinner />;
  if (error || (!layoutId && !orgId)) return <ErrorBox message={error ?? 'Open a new layout from Seat layouts.'} />;
  return (
    <Editor
      key={layoutId ?? 'new'}
      initial={data ?? BLANK}
      name={data?.name ?? ''}
      orgId={orgId}
      layoutId={layoutId}
      // Admins can read a layout but not change it.
      canEdit={canEvents && !isAdmin(user?.role)}
      save={(body) => (layoutId ? layoutApi.replace(layoutId, body) : layoutApi.create(orgId, body))}
      onSaved={(saved) => !layoutId && navigate(`/manage/layouts/${saved.id}`, { replace: true })}
    />
  );
}

/** An admin preset: a ready-made layout organizers can copy into their organization. */
export function PresetEditorPage() {
  const { presetId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(() => (presetId ? presetApi.get(presetId) : Promise.resolve(null)), [presetId]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  return (
    <Editor
      key={presetId ?? 'new'}
      initial={data ?? BLANK}
      name={data?.name ?? ''}
      preset={{ description: data?.description ?? '', active: data?.active ?? true }}
      canEdit={isAdmin(user?.role)}
      save={(body) => (presetId ? presetApi.replace(presetId, body) : presetApi.create(body))}
      onSaved={(saved) => !presetId && navigate(`/admin/layout-presets/${saved.id}`, { replace: true })}
    />
  );
}

function Editor({
  initial,
  name: savedName,
  preset,
  orgId,
  layoutId,
  canEdit,
  save: send,
  onSaved,
}: {
  initial: VenueLayout;
  name: string;
  /** Only a preset has these. */
  preset?: { description: string; active: boolean };
  /** Only an organization layout has these: the layouts of the same organization can be copied from. */
  orgId?: UUID;
  layoutId?: UUID;
  canEdit: boolean;
  save: (body: PresetLayoutRequest) => Promise<VenueLayout & { id: UUID }>;
  onSaved: (saved: VenueLayout & { id: UUID }) => void;
}) {
  const [layout, setLayout] = useState<VenueLayout>(initial);
  const [version, setVersion] = useState(initial.version ?? 0);
  const [name, setName] = useState(savedName);
  const [description, setDescription] = useState(preset?.description ?? '');
  const [active, setActive] = useState(preset?.active ?? true);
  const [dirty, setDirty] = useState(false);
  // What is selected: one or several items, as keys ("s:<section id>" and "h:<shape number>"). One selected item is `sel`.
  const [picked, setPicked] = useState<string[]>([]);
  const sel: Sel = picked.length === 1 ? (picked[0]!.startsWith('s:') ? { t: 'section', id: picked[0]!.slice(2) } : { t: 'shape', i: Number(picked[0]!.slice(2)) }) : null;
  const setSel = (x: Sel) => setPicked(x ? [x.t === 'section' ? `s:${x.id}` : `h:${x.i}`] : []);
  // The turning point of the selected item: one of its corners or its middle. There is only ever one; a new selection starts at the middle.
  const [pivot, setPivot] = useState<DotKey>('c');
  // True while a turn dot is being dragged: the cursor stays a turning arrow for the whole drag.
  const [rotating, setRotating] = useState(false);
  useEffect(() => setPivot('c'), [picked.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  // A box being dragged over empty plan to select what it touches.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marq = useRef<{ x0: number; y0: number; x1: number; y1: number; add: boolean } | null>(null);
  const [brush, setBrush] = useState<Brush>('move');
  const [snap, setSnap] = useState(true);
  // A picture of the plan as it is now (without the grid, selection or turn dots), shown in a window.
  const [preview, setPreview] = useState<string | null>(null);
  function openPreview() {
    const live = svgRef.current;
    if (!live) return;
    const copy = live.cloneNode(true) as SVGSVGElement;
    copy.querySelectorAll('.le-outline, .le-rot, .le-pivot, .le-marquee, title').forEach((n) => n.remove());
    copy.querySelectorAll('rect[fill^="url("]').forEach((n) => n.remove());
    copy.removeAttribute('style');
    copy.removeAttribute('class');
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', String(layout.width));
    copy.setAttribute('height', String(layout.height));
    copy.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
    copy.insertAdjacentHTML('afterbegin', '<style>.le-facing{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}</style>');
    setPreview('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy)));
  }
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const past = useRef<VenueLayout[]>([]);
  const future = useRef<VenueLayout[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'section' | 'shape'; id: string; i: number; start: { x: number; y: number }; orig: { x: number; y: number }; moved: boolean; group?: Record<string, { x: number; y: number }>; rotate?: { ox: number; oy: number; startAngle: number; origRot: number; dot: DotKey; isPivot: boolean; o0: { x: number; y: number } } } | null>(null);
  const painting = useRef(false);
  // The hand tool: dragging the plan moves the view (it scrolls the canvas), it never moves or selects anything.
  const pan = useRef<{ x: number; y: number; left: number; top: number; ox: number; oy: number; sx: boolean; sy: boolean } | null>(null);
  // Where the Hand has moved the plan on an axis where it is smaller than the canvas (nothing to scroll there).
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);

  const shapes = layout.shapes ?? [];
  const counts = useMemo(() => seatCount(layout), [layout]);
  const issues = useMemo(() => layoutIssues(layout), [layout]);
  const selSection = sel?.t === 'section' ? layout.sections.find((s) => s.id === sel.id) ?? null : null;
  const selShape = sel?.t === 'shape' ? shapes[sel.i] ?? null : null;

  /** Edits the plan; a snapshot goes on the undo list first (unless one was just taken for a drag or a stroke). */
  function snapshot() {
    past.current.push(layout);
    if (past.current.length > HISTORY) past.current.shift();
    future.current = [];
  }
  function edit(next: VenueLayout, record = true) {
    if (record) snapshot();
    setLayout(next);
    setDirty(true);
    setJustSaved(false);
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(layout);
    setLayout(prev);
    setDirty(true);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(layout);
    setLayout(next);
    setDirty(true);
  }

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The canvas has a fixed size; the plan is fitted inside it (both ways), and again whenever the plan's size changes.
  useEffect(() => {
    fit();
    const again = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(again);
  }, [layout.width, layout.height]); // eslint-disable-line react-hooks/exhaustive-deps
  function fit() {
    const box = wrap.current;
    if (!box || box.clientWidth < 100 || box.clientHeight < 100) return;
    const byWidth = (box.clientWidth - 80) / layout.width;
    const byHeight = (box.clientHeight - 70) / layout.height;
    setZoom(Math.max(0.05, Math.min(1.5, byWidth, byHeight)));
    setOff({ x: 0, y: 0 });
  }

  const patchSection = (id: string, patch: Partial<LayoutSection>, record = true) =>
    edit({ ...layout, sections: layout.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, record);
  const patchShape = (i: number, patch: Partial<LayoutShape>) => edit({ ...layout, shapes: shapes.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  function addSection(kind: 'VIP' | 'STANDARD') {
    const params: SectionParams = { ...DEFAULT_PARAMS, rows: kind === 'VIP' ? 3 : 5, perRow: kind === 'VIP' ? 8 : 10 };
    const width = (params.perRow - 1) * params.gap;
    const height = (params.rows - 1) * params.rowGap;
    const same = layout.sections.filter((s) => s.kind === kind).length;
    const name = kind === 'VIP' ? `VIP ${String.fromCharCode(65 + (same % 26))}` : `Section ${same + 1}`;
    const section: LayoutSection = {
      id: newId(),
      name: uniqueName(name),
      kind,
      color: kind === 'VIP' ? COLORS[0]! : COLORS[2]!,
      x: Math.round((layout.width - width) / 2),
      y: Math.round((layout.height - height) / 2 + (layout.sections.length % 5) * 30),
      rotation: 0,
      rows: buildRows(params),
    };
    edit({ ...layout, sections: [...layout.sections, section] });
    setSel({ t: 'section', id: section.id });
  }
  function uniqueName(base: string): string {
    const taken = new Set(layout.sections.map((s) => s.name.trim().toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let n = 2;
    while (taken.has(`${base} ${n}`.toLowerCase())) n++;
    return `${base} ${n}`;
  }
  function addShape(type: LayoutShape['type']) {
    const base = type === 'LABEL' ? { type, text: 'Label', x: layout.width / 2 - 40, y: 60 } : type === 'STAGE' ? { type, text: 'STAGE', x: layout.width / 2 - 150, y: 20, width: 300, height: 50 } : { type, x: 40, y: layout.height / 2, width: 200, height: 10 };
    edit({ ...layout, shapes: [...shapes, { ...base, rotation: 0 }] });
    setSel({ t: 'shape', i: shapes.length });
  }
  /** The sections and shapes picked, with where they are. */
  function pickedItems() {
    const out: { key: string; x: number; y: number; bounds: Rect }[] = [];
    for (const k of picked) {
      if (k.startsWith('s:')) {
        const sec = layout.sections.find((s) => s.id === k.slice(2));
        if (sec) out.push({ key: k, x: sec.x, y: sec.y, bounds: sectionBounds(sec) });
      } else {
        const sh = shapes[Number(k.slice(2))];
        if (sh) out.push({ key: k, x: sh.x, y: sh.y, bounds: shapeBounds(sh) });
      }
    }
    return out;
  }
  /** Moves every picked item by (dx, dy) from the given starting positions (or from where they are now). */
  function moveBy(dx: number, dy: number, from?: Record<string, { x: number; y: number }>, record = true) {
    const at = (k: string, cur: { x: number; y: number }) => from?.[k] ?? cur;
    edit(
      {
        ...layout,
        sections: layout.sections.map((s) => (picked.includes(`s:${s.id}`) ? { ...s, x: Math.round(at(`s:${s.id}`, s).x + dx), y: Math.round(at(`s:${s.id}`, s).y + dy) } : s)),
        shapes: shapes.map((s, i) => (picked.includes(`h:${i}`) ? { ...s, x: Math.round(at(`h:${i}`, s).x + dx), y: Math.round(at(`h:${i}`, s).y + dy) } : s)),
      },
      record,
    );
  }
  function removeSelected() {
    const ids = new Set(picked.filter((k) => k.startsWith('s:')).map((k) => k.slice(2)));
    const nums = new Set(picked.filter((k) => k.startsWith('h:')).map((k) => Number(k.slice(2))));
    edit({ ...layout, sections: layout.sections.filter((s) => !ids.has(s.id)), shapes: shapes.filter((_, i) => !nums.has(i)) });
    setPicked([]);
  }
  /** Gives a copy the next free numbered name ("A" gives "A 2", then "A 3"). */
  function namer() {
    const taken = new Set(layout.sections.map((s) => s.name.trim().toLowerCase()));
    return (from: string) => {
      // "VIP" becomes "VIP 2", "VIP 2" becomes "VIP 3" (older "copy" words are dropped).
      const m = /^(.*?)(?:\s+copy)*(?:\s+(\d+))?$/i.exec(from.trim());
      const base = m?.[1] || from.trim();
      let n = Number(m?.[2] ?? 1) + 1;
      while (taken.has(`${base} ${n}`.toLowerCase())) n++;
      const name = `${base} ${n}`;
      taken.add(name.toLowerCase());
      return name;
    };
  }
  /** Copies everything picked `count` times in a row beside it (left, right, up or down), each `gap` away from the one before. */
  function copyBeside(dir: 'left' | 'right' | 'up' | 'down', count: number, gap: number) {
    const items = pickedItems();
    if (items.length === 0) return;
    const w = Math.max(...items.map((i) => i.bounds.x + i.bounds.w)) - Math.min(...items.map((i) => i.bounds.x));
    const h = Math.max(...items.map((i) => i.bounds.y + i.bounds.h)) - Math.min(...items.map((i) => i.bounds.y));
    const unique = namer();
    const sign = dir === 'left' || dir === 'up' ? -1 : 1;
    const horizontal = dir === 'left' || dir === 'right';
    const copies: LayoutSection[] = [];
    const shapeCopies: LayoutShape[] = [];
    for (let i = 1; i <= count; i++) {
      const d = Math.round(sign * i * ((horizontal ? w : h) + gap));
      const dx = horizontal ? d : 0;
      const dy = horizontal ? 0 : d;
      for (const k of picked) {
        if (k.startsWith('s:')) {
          const sec = layout.sections.find((x) => x.id === k.slice(2));
          if (sec) copies.push({ ...sec, id: newId(), name: unique(sec.name), x: sec.x + dx, y: sec.y + dy, rows: sec.rows.map((r) => ({ ...r, seats: r.seats.map((t) => ({ ...t })) })) });
        } else {
          const sh = shapes[Number(k.slice(2))];
          if (sh) shapeCopies.push({ ...sh, x: sh.x + dx, y: sh.y + dy });
        }
      }
    }
    edit({ ...layout, sections: [...layout.sections, ...copies], shapes: [...shapes, ...shapeCopies] });
    setPicked([...copies.map((c) => `s:${c.id}`), ...shapeCopies.map((_, i) => `h:${shapes.length + i}`)]);
  }
  function duplicateSelected() {
    const unique = namer();
    const copies: LayoutSection[] = [];
    const shapeCopies: LayoutShape[] = [];
    for (const k of picked) {
      if (k.startsWith('s:')) {
        const sec = layout.sections.find((s) => s.id === k.slice(2));
        if (sec) copies.push({ ...sec, id: newId(), name: unique(sec.name), x: sec.x + 40, y: sec.y + 40, rows: sec.rows.map((r) => ({ ...r, seats: r.seats.map((s) => ({ ...s })) })) });
      } else {
        const sh = shapes[Number(k.slice(2))];
        if (sh) shapeCopies.push({ ...sh, x: sh.x + 40, y: sh.y + 40 });
      }
    }
    if (copies.length + shapeCopies.length === 0) return;
    edit({ ...layout, sections: [...layout.sections, ...copies], shapes: [...shapes, ...shapeCopies] });
    setPicked([...copies.map((c) => `s:${c.id}`), ...shapeCopies.map((_, i) => `h:${shapes.length + i}`)]);
  }
  /** Lines the picked items up with each other along one edge or their middles. */
  function align(mode: 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter') {
    const items = pickedItems();
    if (items.length < 2) return;
    const minX = Math.min(...items.map((i) => i.bounds.x));
    const maxX = Math.max(...items.map((i) => i.bounds.x + i.bounds.w));
    const minY = Math.min(...items.map((i) => i.bounds.y));
    const maxY = Math.max(...items.map((i) => i.bounds.y + i.bounds.h));
    const shift = new Map<string, { dx: number; dy: number }>();
    for (const it of items) {
      const b = it.bounds;
      shift.set(it.key, {
        dx: mode === 'left' ? minX - b.x : mode === 'right' ? maxX - (b.x + b.w) : mode === 'hcenter' ? (minX + maxX) / 2 - (b.x + b.w / 2) : 0,
        dy: mode === 'top' ? minY - b.y : mode === 'bottom' ? maxY - (b.y + b.h) : mode === 'vcenter' ? (minY + maxY) / 2 - (b.y + b.h / 2) : 0,
      });
    }
    applyShift(shift);
  }
  function applyShift(shift: Map<string, { dx: number; dy: number }>) {
    edit({
      ...layout,
      sections: layout.sections.map((s) => {
        const d = shift.get(`s:${s.id}`);
        return d ? { ...s, x: Math.round(s.x + d.dx), y: Math.round(s.y + d.dy) } : s;
      }),
      shapes: shapes.map((s, i) => {
        const d = shift.get(`h:${i}`);
        return d ? { ...s, x: Math.round(s.x + d.dx), y: Math.round(s.y + d.dy) } : s;
      }),
    });
  }
  /**
   * Lines the picked items up one after another along an axis: across or down.
   * With a gap, each is that far from the one before; with no gap, the gaps are made equal between the first and the last.
   */
  function space(axis: 'x' | 'y', gap: number | null) {
    const items = pickedItems();
    if (items.length < 2) return;
    const u = axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    // Each item's middle, and how far it reaches along the axis (its own box, turned).
    const info = items.map((it) => {
      const sec = it.key.startsWith('s:') ? layout.sections.find((x) => x.id === it.key.slice(2)) : undefined;
      let c = { x: it.bounds.x + it.bounds.w / 2, y: it.bounds.y + it.bounds.h / 2 };
      let w = it.bounds.w;
      let h = it.bounds.h;
      let rot = 0;
      if (sec) {
        const box = sectionBox(sec);
        c = worldPoint(sec, box.x + box.w / 2, box.y + box.h / 2);
        w = box.w;
        h = box.h;
        rot = ((sec.rotation ?? 0) * Math.PI) / 180;
      }
      const d = rot;
      const ext = axis === 'x' ? Math.abs(w * Math.cos(d)) + Math.abs(h * Math.sin(d)) : Math.abs(w * Math.sin(d)) + Math.abs(h * Math.cos(d));
      // plo..phi: where it sits across the axis, to tell which row or column it belongs to.
      return { key: it.key, t: c.x * u.x + c.y * u.y, ext, plo: axis === 'x' ? it.bounds.y : it.bounds.x, phi: axis === 'x' ? it.bounds.y + it.bounds.h : it.bounds.x + it.bounds.w };
    });
    // A grid is spaced one row (or column) at a time; items that do not line up at all are spaced as one line.
    info.sort((p, q) => p.plo - q.plo);
    let lines: (typeof info)[] = [];
    for (const i of info) {
      const cur = lines[lines.length - 1];
      if (cur && i.plo < Math.max(...cur.map((c) => c.phi))) cur.push(i);
      else lines.push([i]);
    }
    if (lines.every((l) => l.length < 2)) lines = [info];
    const shift = new Map<string, { dx: number; dy: number }>();
    for (const line of lines) spaceLine(line);
    applyShift(shift);

    function spaceLine(info: typeof lines[number]) {
    if (info.length < 2 || (gap === null && info.length < 3)) return;
    info.sort((p, q) => p.t - q.t);
    const first = info[0]!;
    const last = info[info.length - 1]!;
    const start = first.t - first.ext / 2;
    const even = gap ?? (last.t + last.ext / 2 - start - info.reduce((n, i) => n + i.ext, 0)) / (info.length - 1);
    if (gap === null && even < 0) {
      // Too many (or too wide) to leave equal gaps: space their middles equally instead.
      const step = (last.t - first.t) / (info.length - 1);
      info.forEach((i, n) => {
        const d = first.t + n * step - i.t;
        shift.set(i.key, { dx: d * u.x, dy: d * u.y });
      });
    } else {
      let at = start;
      for (const i of info) {
        const d = at + i.ext / 2 - i.t;
        shift.set(i.key, { dx: d * u.x, dy: d * u.y });
        at += i.ext + even;
      }
    }
    }
  }
  /**
   * Bends the picked sections' rows round a point (the stage) opposite the given side, so the curve bulges towards that side, each section facing the point: the row nearest the stage
   * becomes the innermost arc and the other rows follow outside it, so the grid keeps its rows but fans out. `depth` is 1 to 50: how much
   * of a circle the innermost row sweeps (1 is hardly a curve, 25 a semicircle, 50 the whole circle); its length stays the same. Changing the depth
   * again (`fresh` false) bends from the flat positions it started from, as one undo step.
   */
  function circleSpread(side: 'left' | 'right' | 'top' | 'bottom', depth: number, gap: number, fresh: boolean) {
    let secs = picked.flatMap((k) => (k.startsWith('s:') ? layout.sections.filter((x) => x.id === k.slice(2)) : []));
    if (secs.length < 2) return;
    const last = circleLast.current;
    // Sections already curved by the last circle are bent again from their flat positions, whichever side is chosen.
    if (last && secs.every((x) => last.out.get(x.id) && last.out.get(x.id)!.x === x.x && last.out.get(x.id)!.y === x.y && last.out.get(x.id)!.rotation === x.rotation)) {
      secs = secs.map((x) => last.base.get(x.id) ?? x);
    } else fresh = true;
    const theta = { top: 180, right: 270, bottom: 0, left: 90 }[side];
    const th = (theta * Math.PI) / 180;
    const bs = secs.map((x) => sectionBounds(x));
    const gx = (Math.min(...bs.map((q) => q.x)) + Math.max(...bs.map((q) => q.x + q.w))) / 2;
    const gy = (Math.min(...bs.map((q) => q.y)) + Math.max(...bs.map((q) => q.y + q.h))) / 2;
    // Everything is worked out with the stage at the top, then turned back to the chosen side about the group's middle.
    const turnAbout = (x: number, y: number, a: number) => ({ x: gx + (x - gx) * Math.cos(a) - (y - gy) * Math.sin(a), y: gy + (x - gx) * Math.sin(a) + (y - gy) * Math.cos(a) });
    const items = secs.map((sec) => {
      const box = sectionBox(sec);
      const m = worldPoint(sec, box.x + box.w / 2, box.y + box.h / 2);
      return { sec, box, m: turnAbout(m.x, m.y, -th) };
    });
    items.sort((p, q) => p.m.y - q.m.y);
    const tol = Math.min(...items.map((i) => i.box.h)) / 2;
    const rows: (typeof items)[] = [];
    for (const it of items) {
      const cur = rows[rows.length - 1];
      if (cur && it.m.y - cur[cur.length - 1]!.m.y <= tol) cur.push(it);
      else rows.push([it]);
    }
    rows.forEach((r) => r.sort((p, q) => p.m.x - q.m.x));
    const length0 = rows[0]!.reduce((n, i) => n + i.box.w, 0) + (rows[0]!.length - (depth >= 50 ? 0 : 1)) * gap;
    const span = (Math.min(50, Math.max(1, depth)) / 50) * 2 * Math.PI;
    const radius = length0 / span;
    const full = depth >= 50;
    const rowY = rows.map((r) => r.reduce((n, i) => n + i.m.y, 0) / r.length);
    const r0 = radius;
    const cx = items.reduce((n, i) => n + i.m.x, 0) / items.length;
    const place = new Map<string, LayoutSection>();
    rows.forEach((row, k) => {
      const r = r0 + (rowY[k]! - rowY[0]!);
      row.forEach((it, n) => {
        const phi = row.length === 1 ? Math.PI / 2 : Math.PI / 2 + span / 2 - (full ? (span * n) / row.length : (span * n) / (row.length - 1));
        const w = turnAbout(cx + r * Math.cos(phi), rowY[0]! - r0 + r * Math.sin(phi), th);
        const rot = ((((((phi - Math.PI / 2) * 180) / Math.PI + theta) % 360) + 540) % 360) - 180;
        const ra = (rot * Math.PI) / 180;
        const lx = it.box.x + it.box.w / 2;
        const ly = it.box.y + it.box.h / 2;
        // The section turns about its own origin, so the origin goes where it puts its middle on the arc.
        place.set(it.sec.id, { ...it.sec, rotation: Math.round(rot * 100) / 100, x: Math.round(w.x - (lx * Math.cos(ra) - ly * Math.sin(ra))), y: Math.round(w.y - (lx * Math.sin(ra) + ly * Math.cos(ra))) });
      });
    });
    if (fresh) circleLast.current = { base: new Map(secs.map((x) => [x.id, x])), out: place, side, depth };
    else if (circleLast.current) circleLast.current = { ...circleLast.current, out: place, side, depth };
    edit({ ...layout, sections: layout.sections.map((x) => place.get(x.id) ?? x) }, fresh);
  }
  /** Puts the sections back as they were before the circle (as one undo step). */
  function straighten() {
    const last = circleLast.current;
    if (!last) return;
    circleLast.current = null;
    edit({ ...layout, sections: layout.sections.map((x) => last.base.get(x.id) ?? x) });
  }
  /** The sections as they were before the last circle (and as that circle left them), so its depth can be changed live. */
  const circleLast = useRef<{ base: Map<string, LayoutSection>; out: Map<string, LayoutSection>; side: 'left' | 'right' | 'top' | 'bottom'; depth: number } | null>(null);
  /** The circle on the current selection, if it is the sections the last circle was made on and they have not been moved since (so it can still be reshaped or straightened). */
  const circleNow = (() => {
    const last = circleLast.current;
    const secs = picked.flatMap((k) => (k.startsWith('s:') ? layout.sections.filter((x) => x.id === k.slice(2)) : []));
    if (!last || secs.length < 2 || secs.length !== last.base.size) return null;
    const same = secs.every((x) => {
      const o = last.out.get(x.id);
      return o && o.x === x.x && o.y === x.y && o.rotation === x.rotation;
    });
    return same ? { side: last.side, depth: last.depth } : null;
  })();
  /** The turn the picked items share ("30°"), or "mixed" when they differ. */
  const groupTurn = (() => {
    const r = picked.map((k) => (k.startsWith('s:') ? layout.sections.find((x) => x.id === k.slice(2))?.rotation : shapes[Number(k.slice(2))]?.rotation) ?? 0);
    return r.length > 0 && r.every((n) => n === r[0]) ? `${r[0]}°` : 'mixed';
  })();
  /** Turns everything picked by `deg` degrees (clockwise is positive) about the middle of the group, so they keep their places relative to each other. */
  function turnGroup(deg: number) {
    const items = pickedItems();
    if (items.length < 2 || !deg) return;
    const cx = (Math.min(...items.map((i) => i.bounds.x)) + Math.max(...items.map((i) => i.bounds.x + i.bounds.w))) / 2;
    const cy = (Math.min(...items.map((i) => i.bounds.y)) + Math.max(...items.map((i) => i.bounds.y + i.bounds.h))) / 2;
    const rad = (deg * Math.PI) / 180;
    const turn = <T extends { x: number; y: number; rotation?: number }>(it: T): T => {
      const ax = it.x - cx;
      const ay = it.y - cy;
      const rot = ((((it.rotation ?? 0) + deg) % 360) + 540) % 360 - 180;
      return { ...it, x: Math.round((cx + ax * Math.cos(rad) - ay * Math.sin(rad)) * 100) / 100, y: Math.round((cy + ax * Math.sin(rad) + ay * Math.cos(rad)) * 100) / 100, rotation: rot };
    };
    edit({
      ...layout,
      sections: layout.sections.map((x) => (picked.includes(`s:${x.id}`) ? turn(x) : x)),
      shapes: shapes.map((x, i) => (picked.includes(`h:${i}`) ? turn(x) : x)),
    });
  }
  function selectAll() {
    setPicked([...layout.sections.map((s) => `s:${s.id}`), ...shapes.map((_, i) => `h:${i}`)]);
  }
  function rebuild(section: LayoutSection, patch: Partial<SectionParams>) {
    const p = { ...paramsOf(section), ...patch };
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
    const params: SectionParams = { ...p, rows: clamp(p.rows, 1, 60), perRow: clamp(p.perRow, 1, 100), gap: clamp(p.gap, 14, 80), rowGap: clamp(p.rowGap, 14, 80), firstNumber: clamp(p.firstNumber, 0, 9999), firstLabel: p.firstLabel.slice(0, 3) || 'A' };
    patchSection(section.id, { rows: buildRows(params, section.rows) });
  }

  function paint(sectionId: string, label: string, number: string, type: SeatType) {
    setLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, rows: sec.rows.map((r) => (r.label !== label ? r : { ...r, seats: r.seats.map((s) => (s.number !== number ? s : { ...s, type: type === 'SEAT' ? undefined : type })) })) },
      ),
    }));
    setDirty(true);
    setJustSaved(false);
  }

  function toPlan(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  const step = (n: number) => (snap ? Math.round(n / 10) * 10 : Math.round(n));

  function startPan(e: ReactPointerEvent) {
    const box = wrap.current;
    if (!box) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop, ox: off.x, oy: off.y, sx: box.scrollWidth - Math.abs(off.x) > box.clientWidth + 1, sy: box.scrollHeight - Math.abs(off.y) > box.clientHeight + 1 };
    setPanning(true);
  }
  /** Pressing a section or shape. Shift or Ctrl adds it to the selection (or takes it off); pressing one of several selected items drags them all. */
  function startDrag(e: ReactPointerEvent, kind: 'section' | 'shape', id: string, i: number, orig: { x: number; y: number }) {
    e.stopPropagation();
    if (brush === 'hand') {
      startPan(e);
      return;
    }
    const key = kind === 'section' ? `s:${id}` : `h:${i}`;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
      return;
    }
    const inGroup = picked.length > 1 && picked.includes(key);
    if (!inGroup) setPicked([key]);
    if (!canEdit || brush !== 'move') return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const group = inGroup ? Object.fromEntries(pickedItems().map((it) => [it.key, { x: it.x, y: it.y }])) : undefined;
    drag.current = { kind, id, i, start: toPlan(e), orig, moved: false, group };
  }
  /** Pressing empty plan: drag to draw a selection box (Shift keeps what is already selected). A plain click clears the selection. */
  function startMarquee(e: ReactPointerEvent) {
    if (brush === 'hand') {
      startPan(e);
      return;
    }
    if (!canEdit || brush !== 'move') {
      setPicked([]);
      return;
    }
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toPlan(e);
    marq.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey || e.ctrlKey || e.metaKey };
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function finishMarquee() {
    const m = marq.current;
    marq.current = null;
    setMarquee(null);
    if (!m) return;
    const box: Rect = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
    if (box.w < 4 && box.h < 4) {
      if (!m.add) setPicked([]);
      return;
    }
    const hit = (b: Rect) => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
    const keys = [
      ...layout.sections.filter((s) => hit(sectionBounds(s))).map((s) => `s:${s.id}`),
      ...shapes.flatMap((s, i) => (hit(shapeBounds(s)) ? [`h:${i}`] : [])),
    ];
    setPicked(m.add ? [...new Set([...picked, ...keys])] : keys);
  }
  /** A dot was pressed. A click makes it the turning point; dragging a dot turns the item about the turning point (the turning point itself only takes clicks). */
  function startRotate(e: ReactPointerEvent, kind: 'section' | 'shape', id: string, i: number, origin: { x: number; y: number }, origRot: number, box: Rect, dot: DotKey) {
    e.stopPropagation();
    if (!canEdit) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toPlan(e);
    const pw = turned(origin, origRot, dotAt(box, pivot));
    drag.current = {
      kind,
      id,
      i,
      start: p,
      orig: origin,
      moved: false,
      rotate: { ox: pw.x, oy: pw.y, startAngle: (Math.atan2(p.y - pw.y, p.x - pw.x) * 180) / Math.PI, origRot, dot, isPivot: dot === pivot, o0: origin },
    };
  }

  function onMove(e: ReactPointerEvent) {
    if (pan.current && wrap.current) {
      const box = wrap.current;
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      const { sx, sy } = pan.current;
      if (sx) box.scrollLeft = pan.current.left - dx;
      if (sy) box.scrollTop = pan.current.top - dy;
      // Keeps the plan at least partly inside the canvas.
      const lim = (n: number, size: number, view: number) => Math.min(Math.max(n, 40 - size), view - 40);
      setOff({
        x: sx ? 0 : lim(pan.current.ox + dx, box.querySelector<HTMLElement>('.le-stage')?.offsetWidth ?? 0, box.clientWidth),
        y: sy ? 0 : lim(pan.current.oy + dy, box.querySelector<HTMLElement>('.le-stage')?.offsetHeight ?? 0, box.clientHeight),
      });
      return;
    }
    if (marq.current) {
      const q = toPlan(e);
      marq.current = { ...marq.current, x1: q.x, y1: q.y };
      setMarquee({ x0: marq.current.x0, y0: marq.current.y0, x1: q.x, y1: q.y });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = toPlan(e);
    if (d.group && !d.rotate) {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 3) return;
        snapshot();
        d.moved = true;
      }
      const g = d.group;
      setLayout((prev) => {
        // The group's box at its starting spot must stay inside the plan.
        const boxes = [
          ...prev.sections.filter((s) => g['s:' + s.id]).map((s) => ({ b: sectionBounds(s), o: g['s:' + s.id]!, c: s })),
          ...(prev.shapes ?? []).flatMap((s, k) => (g['h:' + k] ? [{ b: shapeBounds(s), o: g['h:' + k]!, c: s }] : [])),
        ].map(({ b, o, c }) => ({ x: b.x + o.x - c.x, y: b.y + o.y - c.y, w: b.w, h: b.h }));
        const x0 = Math.min(...boxes.map((b) => b.x));
        const y0 = Math.min(...boxes.map((b) => b.y));
        const x1 = Math.max(...boxes.map((b) => b.x + b.w));
        const y1 = Math.max(...boxes.map((b) => b.y + b.h));
        const mx = x1 - x0 > prev.width ? dx : Math.min(Math.max(dx, -x0), prev.width - x1);
        const my = y1 - y0 > prev.height ? dy : Math.min(Math.max(dy, -y0), prev.height - y1);
        return {
          ...prev,
          sections: prev.sections.map((s) => (g['s:' + s.id] ? { ...s, x: step(g['s:' + s.id]!.x + mx), y: step(g['s:' + s.id]!.y + my) } : s)),
          shapes: (prev.shapes ?? []).map((s, k) => (g['h:' + k] ? { ...s, x: step(g['h:' + k]!.x + mx), y: step(g['h:' + k]!.y + my) } : s)),
        };
      });
      setDirty(true);
      setJustSaved(false);
      return;
    }
    if (d.rotate) {
      const R = d.rotate;
      if (R.isPivot) return;
      const now = (Math.atan2(p.y - R.oy, p.x - R.ox) * 180) / Math.PI;
      const wanted = R.origRot + (now - R.startAngle);
      const delta = (e.shiftKey ? Math.round(wanted / 15) * 15 : Math.round(wanted)) - R.origRot;
      const rot = ((((R.origRot + delta) % 360) + 540) % 360) - 180; // kept between -180 and 180
      if (!d.moved) {
        if (Math.abs(delta) < 1) return;
        snapshot();
        d.moved = true;
        setRotating(true);
      }
      // Turning about the turning point moves the item's own origin round it as well.
      const rad = (delta * Math.PI) / 180;
      const ax = R.o0.x - R.ox;
      const ay = R.o0.y - R.oy;
      const nx = Math.round((R.ox + ax * Math.cos(rad) - ay * Math.sin(rad)) * 100) / 100;
      const ny = Math.round((R.oy + ax * Math.sin(rad) + ay * Math.cos(rad)) * 100) / 100;
      setLayout((prev) =>
        d.kind === 'section'
          ? { ...prev, sections: prev.sections.map((s) => (s.id === d.id ? { ...s, x: nx, y: ny, rotation: rot } : s)) }
          : { ...prev, shapes: (prev.shapes ?? []).map((s, k) => (k === d.i ? { ...s, x: nx, y: ny, rotation: rot } : s)) },
      );
      setDirty(true);
      setJustSaved(false);
      return;
    }
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 3) return;
      snapshot();
      d.moved = true;
    }
    const x = step(d.orig.x + dx);
    const y = step(d.orig.y + dy);
    // Keeps the item inside the plan, so it never slides out of sight where it cannot be grabbed (and the API rejects seats outside).
    const keep = (it: { x: number; y: number }, b: Rect, W: number, H: number) => {
      const cx = b.w > W ? 0 : Math.min(Math.max(x - it.x, -b.x), W - b.x - b.w);
      const cy = b.h > H ? 0 : Math.min(Math.max(y - it.y, -b.y), H - b.y - b.h);
      return { x: it.x + cx, y: it.y + cy };
    };
    setLayout((prev) =>
      d.kind === 'section'
        ? { ...prev, sections: prev.sections.map((s) => (s.id === d.id ? { ...s, ...keep(s, sectionBounds(s), prev.width, prev.height) } : s)) }
        : { ...prev, shapes: (prev.shapes ?? []).map((s, k) => (k === d.i ? { ...s, ...keep(s, shapeBounds(s), prev.width, prev.height) } : s)) },
    );
    setDirty(true);
    setJustSaved(false);
  }
  function endStroke() {
    if (pan.current) {
      pan.current = null;
      setPanning(false);
    }
    // A dot clicked and let go (not dragged) becomes the turning point.
    const d = drag.current;
    if (d?.rotate && !d.moved) setPivot(d.rotate.dot);
    setRotating(false);
    finishMarquee();
    drag.current = null;
    painting.current = false;
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      zoomStep(1.1);
    } else if (mod && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      zoomStep(1 / 1.1);
    } else if (mod && e.key === '0') {
      e.preventDefault();
      fit();
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll();
    } else if (!mod && e.key.toLowerCase() === 'h' && !(e.target as HTMLElement).closest('button:not(.le-rail button)')) {
      (e.target as HTMLElement).closest<HTMLElement>('.le-rail button')?.blur();
      setBrush('hand');
    } else if (canEdit && e.key === ' ' && !(e.target as HTMLElement).closest('button:not(.le-rail button)')) {
      // Space switches to the Move tool (and does not scroll the page or press the focused tool button).
      e.preventDefault();
      (e.target as HTMLElement).closest<HTMLElement>('.le-rail button')?.blur();
      setBrush('move');
    } else if (e.key === 'Escape') {
      setPicked([]);
    } else if (canEdit && (e.key === 'Delete' || e.key === 'Backspace') && picked.length > 0) {
      e.preventDefault();
      removeSelected();
    } else if (canEdit && e.key.startsWith('Arrow') && picked.length > 0) {
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1;
      moveBy(e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0);
    }
  }

  // Over the canvas: Ctrl + scroll zooms (round the pointer); Alt + scroll moves the view up and down (Alt + Shift: sideways). A plain scroll does nothing, so the canvas stays put.
  const zoomAnchor = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  useEffect(() => {
    const box = wrap.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const at = toPlan(e);
        zoomAnchor.current = { px: at.x, py: at.y, cx: e.clientX, cy: e.clientY };
        setZoom((z) => Math.max(0.05, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
      } else if (e.altKey) {
        e.preventDefault();
        if (e.shiftKey || (!e.deltaY && e.deltaX)) box.scrollLeft += e.deltaY || e.deltaX;
        else box.scrollTop += e.deltaY;
      } else {
        e.preventDefault(); // a plain scroll never moves or resizes the canvas
      }
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** One step in or out, round the middle of the canvas. */
  function zoomStep(factor: number) {
    const box = wrap.current;
    if (box) {
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const at = toPlan({ clientX: cx, clientY: cy });
      zoomAnchor.current = { px: at.x, py: at.y, cx, cy };
    }
    setZoom((z) => Math.max(0.05, Math.min(3, z * factor)));
  }
  // After a zoom, scroll so the point that was under the pointer is still under it.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const box = wrap.current;
    const svg = svgRef.current;
    if (!a || !box || !svg) return;
    zoomAnchor.current = null;
    const rect = svg.getBoundingClientRect();
    box.scrollLeft += rect.left + a.px * zoom - a.cx;
    box.scrollTop += rect.top + a.py * zoom - a.cy;
  }, [zoom]);

  // The page does not scroll here. If something scrolls it anyway (focus moving to an off-screen control, a stray key), it snaps back.
  useEffect(() => {
    const back = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      document.querySelectorAll<HTMLElement>('main.main, .app, .app-body, .app-content').forEach((el) => {
        if (el.scrollTop || el.scrollLeft) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      });
    };
    window.addEventListener('scroll', back, true);
    return () => window.removeEventListener('scroll', back, true);
  }, []);

  // The shortcuts listen on the whole window, so they work wherever you last clicked on this page (not only inside the editor).
  const keys = useRef(onKey);
  keys.current = onKey;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  async function save() {
    setError(null);
    if (issues.length) {
      setError(`Fix this first: ${issues[0]}`);
      return;
    }
    if (!name.trim()) {
      setError('Give the layout a name first.');
      return;
    }
    setSaving(true);
    try {
      const saved = await send({
        name: name.trim(),
        width: layout.width,
        height: layout.height,
        sections: layout.sections,
        shapes,
        ...(preset && { description: description.trim() || null, active }),
      });
      setLayout(saved);
      setVersion(saved.version ?? version + 1);
      past.current = [];
      future.current = [];
      setDirty(false);
      setJustSaved(true);
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // "Copy layout from": another layout of the same organization. The plan is replaced as an unsaved change (undo brings it back).
  const [copyFrom, setCopyFrom] = useState<SeatLayoutSummary | null>(null);
  const [copying, setCopying] = useState(false);
  function chooseCopy(v: SeatLayoutSummary) {
    if (layout.sections.length + shapes.length === 0) void copyLayout(v);
    else setCopyFrom(v);
  }
  async function copyLayout(v: SeatLayoutSummary) {
    setCopyFrom(null);
    setCopying(true);
    setError(null);
    try {
      const other = await layoutApi.get(v.id);
      if (other.sections.length + (other.shapes ?? []).length === 0) {
        setError(`${v.name} has nothing on its plan to copy.`);
        return;
      }
      edit({ ...layout, width: other.width, height: other.height, sections: other.sections, shapes: other.shapes ?? [] });
      setPicked([]);
      circleLast.current = null;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCopying(false);
    }
  }

  const seatFill = (sec: LayoutSection) => sec.color;
  const brushHint = brush === 'move' ? 'Click a section to select it; drag to move it.' : brush === 'hand' ? 'Drag the plan to move the view. Zoom in first with Ctrl + scroll, or the + button.' : `Click or drag over seats to make them ${brush === 'SEAT' ? 'normal seats' : brush === 'WHEELCHAIR' ? 'wheelchair spaces' : 'blocked (not for sale)'}.`;

  return (
    <div className="designer-page layout-editor">
      <ErrorBox message={error} />
      {!canEdit && <p className="alert alert-warning">You can look at this layout, but only {preset ? 'an admin' : "the organization's owner or an organizer with Events access"} can change it.</p>}
      <div className="le-meta">
        <TextField
          label={preset ? 'Preset name' : 'Layout name'}
          required
          maxLength={100}
          disabled={!canEdit}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
            setJustSaved(false);
          }}
        />
        {preset && (
          <>
            <TextField
              label="Description"
              maxLength={500}
              disabled={!canEdit}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
                setJustSaved(false);
              }}
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={active}
                disabled={!canEdit}
                onChange={(e) => {
                  setActive(e.target.checked);
                  setDirty(true);
                  setJustSaved(false);
                }}
              />
              Active (organizers can copy it)
            </label>
          </>
        )}
      </div>

      <div className="designer-toolbar">
        {/* One row: the seat brush, undo and redo, then plan size, snap, zoom and save. */}
        <div className="designer-bar">
          {canEdit && (
            <>
              <button type="button" className="icon-button has-text" disabled={past.current.length === 0} onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo">
                <UndoIcon />
                <span>Undo</span>
              </button>
              <button type="button" className="icon-button has-text" disabled={future.current.length === 0} onClick={redo} title="Redo (Ctrl+Y)" aria-label="Redo">
                <RedoIcon />
                <span>Redo</span>
              </button>
            </>
          )}
          <span className="bar-spacer" />
          {canEdit && issues.length > 0 && (
            <Popover
              text={issues.length > 1 ? 'Warnings' : 'Warning'}
              label={`${issues.length} thing${issues.length > 1 ? 's' : ''} to fix before saving`}
              icon={
                <span className="warn-icon">
                  <WarningIcon />
                  <span className="warn-count">{issues.length}</span>
                </span>
              }
            >
              {() => (
                <div className="bg-menu warn-menu" role="menu" aria-label="Things to fix">
                  <p className="menu-heading">
                    {issues.length} {issues.length > 1 ? 'things' : 'thing'} to fix before saving
                  </p>
                  {issues.map((m) => (
                    <p key={m} className="le-issue">
                      {m}
                    </p>
                  ))}
                </div>
              )}
            </Popover>
          )}
          {canEdit && (
            <Popover text="Plan size" label={`Plan size: ${layout.width} x ${layout.height}`} icon={<GridLinesIcon />}>
              {() => <PlanSizeMenu width={layout.width} height={layout.height} onCommit={(width, height) => edit({ ...layout, width, height })} />}
            </Popover>
          )}
          {canEdit && orgId && (
            <Popover text={copying ? 'Copying…' : 'Layout'} label="Copy another layout of the organization" icon={<CopyLayoutIcon />} disabled={copying}>
              {(close) => <CopyLayoutMenu orgId={orgId} selfId={layoutId} onPick={(v) => { close(); chooseCopy(v); }} />}
            </Popover>
          )}
          <button type="button" className="icon-button has-text" title="Open a picture of the plan" onClick={openPreview}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>View</span>
          </button>
          {canEdit && (
            <button type="button" className="icon-button toggle-button has-text" aria-pressed={snap} title={snap ? 'Snapping: on (moves jump to a grid)' : 'Snapping: off'} onClick={() => setSnap(!snap)}>
              <MagnetIcon />
              <span>Snap</span>
            </button>
          )}
          <span className="nav-divider" aria-hidden="true" />
          <button type="button" className="icon-button" onClick={() => zoomStep(1 / 1.15)} aria-label="Zoom out" title="Zoom out (Ctrl + scroll down, or Ctrl + minus)">
            −
          </button>
          <span className="bar-label le-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-button" onClick={() => zoomStep(1.15)} aria-label="Zoom in" title="Zoom in (Ctrl + scroll up, or Ctrl + plus)">
            +
          </button>
          <button type="button" className="icon-button has-text" onClick={fit} title="Fit the plan to the screen (Ctrl + 0). Alt + scroll moves the view up and down; Alt + Shift + scroll, sideways.">
            <span>Fit</span>
          </button>
          {canEdit && (
            <>
              {dirty && <span className="unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes" role="status" />}
              <button
                type="button"
                className={`btn btn-cta btn-sm${justSaved ? ' is-saved' : ''}`}
                disabled={!dirty && !saving}
                aria-busy={saving}
                title={version === 0 ? 'Save this layout' : 'Save: replaces the saved layout'}
                onClick={() => void save()}
              >
                {saving ? <SpinnerIcon /> : justSaved ? <CheckIcon /> : <SaveIcon />}
                {saving ? 'Saving' : justSaved ? 'Saved!' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={copyFrom !== null}
        title="Replace this plan?"
        confirmLabel="Replace with a copy"
        cancelLabel="Keep this plan"
        onCancel={() => setCopyFrom(null)}
        onConfirm={() => copyFrom && void copyLayout(copyFrom)}
      >
        The plan on screen is replaced with a copy of the plan of {copyFrom?.name}. Nothing is saved until you press Save, and Undo brings the current plan back.
      </ConfirmDialog>
      <FormDialog open={preview !== null} title="Plan preview" size="large" onClose={() => setPreview(null)}>
        {preview && <PlanPreview src={preview} width={layout.width} height={layout.height} />}
      </FormDialog>
      <div className="le-main">
        <div className="le-left">
        {/* Row 3: what to put on the plan - add only what the venue needs. */}
        {canEdit && (
          <div className="placeholder-box" role="group" aria-label="Add to plan">
            <span className="placeholder-total" title="Sections and shapes on the plan">
              {layout.sections.length + shapes.length} on plan
            </span>
            <div className="placeholder-group" role="group" aria-label="Seating">
              <span className="placeholder-box-label">
                Seating
                <span className="count-badge" aria-label={`${layout.sections.length} sections`}>
                  {layout.sections.length}
                </span>
              </span>
              <button type="button" className="placeholder-chip" onClick={() => addSection('VIP')} title="Add a VIP section of seats">
                <PlusIcon />
                VIP section
              </button>
              <button type="button" className="placeholder-chip" onClick={() => addSection('STANDARD')} title="Add a standard section of seats">
                <PlusIcon />
                Standard section
              </button>
            </div>
            <div className="placeholder-group" role="group" aria-label="Shapes">
              <span className="placeholder-box-label">
                Shapes
                <span className="count-badge" aria-label={`${shapes.length} shapes`}>
                  {shapes.length}
                </span>
              </span>
              <button type="button" className="placeholder-chip" onClick={() => addShape('STAGE')}>
                <PlusIcon />
                Stage
              </button>
              <button type="button" className="placeholder-chip" onClick={() => addShape('LABEL')}>
                <PlusIcon />
                Label
              </button>
              <button type="button" className="placeholder-chip" onClick={() => addShape('WALL')}>
                <PlusIcon />
                Wall
              </button>
            </div>
          </div>
        )}


          <div className="le-canvas-wrap">
                  <div className="le-rail" role="radiogroup" aria-label="Tools">
                    {(
                      [
                        ['hand', 'Hand: drag the plan to move the view (H)'],
                        ['move', 'Move: select and drag sections (Space)'],
                        ['SEAT', 'Seat: make seats normal'],
                        ['WHEELCHAIR', 'Wheelchair: mark wheelchair spaces'],
                        ['BLOCKED', 'Blocked: seats that are not for sale'],
                      ] as [Brush, string][]
                    ).map(([v, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={brush === v} aria-label={label} title={label} className={brush === v ? 'is-on' : ''} onClick={() => setBrush(v)}>
                        <BrushIcon kind={v} />
                      </button>
                    ))}
                  </div>
            <div className="le-canvas ticket-canvas-frame" ref={wrap} tabIndex={0} aria-label="Venue plan">
              <div className="le-stage" style={{ width: layout.width * zoom, height: layout.height * zoom, transform: `translate(${off.x}px, ${off.y}px)` }}>
                {/* The size of the plan, like the ticket's: width along the top, height down the left. */}
                <div className="ticket-dim ticket-dim-w" aria-label={`Plan width ${layout.width}`}>
                  <span>{layout.width} px</span>
                </div>
                <div className="ticket-dim ticket-dim-h" aria-label={`Plan height ${layout.height}`}>
                  <span>{layout.height} px</span>
                </div>
                <svg
                  ref={svgRef}
                  className={`le-svg${brush !== 'move' && brush !== 'hand' && canEdit ? ' is-painting' : ''}${brush === 'hand' ? ' is-hand' : ''}${panning ? ' is-panning' : ''}${rotating ? ' is-rotating' : ''}`}
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  style={{ width: layout.width * zoom, height: layout.height * zoom }}
                  onPointerMove={onMove}
                  onPointerUp={endStroke}
                  onPointerLeave={() => (painting.current = false)}
                >
                  <defs>
                    <pattern id="le-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect x={0} y={0} width={layout.width} height={layout.height} fill="#ffffff" onPointerDown={startMarquee} />
                  {snap && <rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#le-grid)" pointerEvents="none" />}
                  {marquee && <rect className="le-marquee" x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} pointerEvents="none" />}

                  {shapes.map((sh, i) => (
                    <g
                      key={i}
                      transform={`translate(${sh.x} ${sh.y}) rotate(${sh.rotation ?? 0})`}
                      className={`le-shape${picked.includes(`h:${i}`) ? ' is-selected' : ''}`}
                      onPointerDown={(e) => startDrag(e, 'shape', '', i, { x: sh.x, y: sh.y })}
                    >
                      {sh.type === 'LABEL' ? (
                        <text y={0} fontSize={20} fontWeight={600} fill="#111827">
                          {sh.text}
                        </text>
                      ) : (
                        <>
                          <rect width={sh.width ?? 0} height={sh.height ?? 0} rx={6} fill={sh.type === 'STAGE' ? '#1f2937' : '#94a3b8'} />
                          {sh.type === 'STAGE' && (
                            <text x={(sh.width ?? 0) / 2} y={(sh.height ?? 0) / 2} textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight={700} fill="#ffffff" pointerEvents="none">
                              {sh.text || 'STAGE'}
                            </text>
                          )}
                        </>
                      )}
                      {picked.includes(`h:${i}`) &&
                    (() => {
                      const bx = -4;
                      const by = sh.type === 'LABEL' ? -22 : -4;
                      const bw = (sh.type === 'LABEL' ? Math.max(40, (sh.text?.length ?? 4) * 11) : sh.width ?? 0) + 8;
                      const bh = (sh.type === 'LABEL' ? 30 : sh.height ?? 0) + 8;
                      return (
                        <>
                          <rect className="le-outline" x={bx} y={by} width={bw} height={bh} fill="none" />
                          {canEdit && sel && <TurnDots box={{ x: bx, y: by, w: bw, h: bh }} zoom={zoom} pivot={pivot} onDown={(e, k) => startRotate(e, 'shape', '', i, { x: sh.x, y: sh.y }, sh.rotation ?? 0, { x: bx, y: by, w: bw, h: bh }, k)} />}
                        </>
                      );
                    })()}
                    </g>
                  ))}

                  {layout.sections.map((sec) => {
                    const box = sectionBox(sec);
                    const selected = picked.includes(`s:${sec.id}`);
                    return (
                      <g key={sec.id} transform={`translate(${sec.x} ${sec.y}) rotate(${sec.rotation ?? 0})`} className={`le-section${selected ? ' is-selected' : ''}`}>
                        <rect
                          x={box.x}
                          y={box.y}
                          width={box.w}
                          height={box.h}
                          rx={10}
                          className="le-section-box"
                          fill={sec.color}
                          fillOpacity={0.08}
                          onPointerDown={(e) => startDrag(e, 'section', sec.id, 0, { x: sec.x, y: sec.y })}
                        />
                        {selected && <rect className="le-outline" x={box.x} y={box.y} width={box.w} height={box.h} rx={10} fill="none" pointerEvents="none" />}
                    {selected && canEdit && sel && <TurnDots box={{ x: box.x, y: box.y, w: box.w, h: box.h }} zoom={zoom} pivot={pivot} onDown={(e, k) => startRotate(e, 'section', sec.id, 0, { x: sec.x, y: sec.y }, sec.rotation ?? 0, { x: box.x, y: box.y, w: box.w, h: box.h }, k)} />}
                        {/* Which way the section faces: the arrow points to its front, row A, and turns with the section. */}
                        {(() => {
                          const ax = Math.max(box.x + 14, box.x + box.w - 36);
                          const top = box.y - 24;
                          return (
                            <path
                              className="le-facing"
                              d={'M ' + ax + ' ' + (box.y + 2) + ' V ' + top + ' M ' + (ax - 6) + ' ' + (top + 8) + ' L ' + ax + ' ' + top + ' L ' + (ax + 6) + ' ' + (top + 8)}
                              stroke={sec.color}
                              pointerEvents="none"
                            />
                          );
                        })()}
                        <text x={box.x} y={box.y - 6} fontSize={14} fontWeight={700} fill={sec.color} pointerEvents="none">
                          {sec.name}
                          {sec.kind === 'VIP' ? ' · VIP' : ''}
                        </text>
                        {sec.rows.map((r) => (
                          <g key={r.label}>
                            {r.seats[0] && (
                              <text x={r.seats[0].x + (r.offset ?? 0) - SEAT_R - 8} y={r.seats[0].y} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b7280" pointerEvents="none">
                                {r.label}
                              </text>
                            )}
                            {r.seats.map((s) => {
                              const type = s.type ?? 'SEAT';
                              const cx = s.x + (r.offset ?? 0);
                              return (
                                <g
                                  key={s.number}
                                  className="le-seat"
                                  onPointerDown={(e) => {
                                    if (canEdit && brush !== 'move' && brush !== 'hand') {
                                      e.stopPropagation();
                                      snapshot();
                                      painting.current = true;
                                      paint(sec.id, r.label, s.number, brush);
                                    } else startDrag(e, 'section', sec.id, 0, { x: sec.x, y: sec.y });
                                  }}
                                  onPointerEnter={() => painting.current && brush !== 'move' && brush !== 'hand' && paint(sec.id, r.label, s.number, brush)}
                                >
                                  <title>{`${sec.name} · Row ${r.label} · Seat ${s.number}${type === 'SEAT' ? '' : ` · ${type === 'WHEELCHAIR' ? 'wheelchair' : 'blocked'}`}`}</title>
                                  {type === 'BLOCKED' ? (
                                    <>
                                      <circle cx={cx} cy={s.y} r={SEAT_R} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 2" />
                                      <path d={`M ${cx - 4} ${s.y - 4} L ${cx + 4} ${s.y + 4} M ${cx + 4} ${s.y - 4} L ${cx - 4} ${s.y + 4}`} stroke="#94a3b8" strokeWidth={1.5} />
                                    </>
                                  ) : (
                                    <>
                                      <circle cx={cx} cy={s.y} r={SEAT_R} fill={seatFill(sec)} />
                                      {type === 'WHEELCHAIR' && <circle cx={cx} cy={s.y} r={4} fill="#ffffff" />}
                                    </>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
            <p className="le-summary-line" aria-label="Summary of the plan">
              {layout.sections.length} {layout.sections.length === 1 ? 'section' : 'sections'} · {counts.total} seats · {counts.sellable} for sale · {counts.wheelchair} wheelchair · {counts.blocked} blocked
            </p>
          </div>
        </div>
        {canEdit && (
          <aside className="le-side" aria-label="Selected item">
            {brush !== 'move' && <p className="muted small le-brush-hint">{brushHint}</p>}
            <h2>{picked.length > 1 ? `${picked.length} items selected` : selSection ? 'Section' : selShape ? 'Shape' : 'Selected item'}</h2>
        <div className="le-panel" aria-live="polite">
                  {picked.length > 1 ? (
                    <MultiBar count={picked.length} circleNow={circleNow} onAlign={align} onSpace={space} onTurn={turnGroup} onCircle={circleSpread} onStraight={straighten} turnNow={groupTurn} onCopyBeside={copyBeside} onDuplicate={duplicateSelected} onDelete={removeSelected} />
                  ) : selSection ? (
                    <SectionBar section={selSection} onPatch={(p) => patchSection(selSection.id, p)} onRebuild={(p) => rebuild(selSection, p)} onCopyBeside={copyBeside} onDuplicate={duplicateSelected} onDelete={removeSelected} />
                  ) : selShape && sel?.t === 'shape' ? (
                    <ShapeBar shape={selShape} onPatch={(p) => patchShape(sel.i, p)} onDelete={removeSelected} />
                  ) : (
                    <span className="muted small">
                      {brush === 'move'
                        ? 'Click a section or a shape on the plan to change it. Shift-click, or drag a box over empty plan, to select several. Drag to move; arrow keys nudge; Delete removes. Ctrl + scroll zooms; Alt + scroll moves the view.'
                        : 'Pick Move to select and change a section or a shape.'}
                    </span>
                  )}
                </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** A brush as an icon, drawn the way its seats look on the plan. */
function BrushIcon({ kind }: { kind: Brush }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'move' && <path d="M5 3l14 8-6 2-2 6z" fill="currentColor" stroke="currentColor" />}
      {kind === 'hand' && (
        <>
          <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5" />
          <path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14" />
          <path d="M17 8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.5 14.5a1.6 1.6 0 0 1 2.6-1.8L8 14" />
        </>
      )}
      {kind === 'SEAT' && <circle cx="12" cy="12" r="7" fill="currentColor" />}
      {kind === 'WHEELCHAIR' && (
        <>
          {/* The access symbol: a head, a body on a chair, a leg, and a wheel. */}
          <circle cx="11" cy="4.6" r="1.8" fill="currentColor" stroke="none" />
          <path d="M11 8.2v6h5.4l2.4 5" />
          <path d="M11 11.4h5" />
          <path d="M8.2 12.6a5.4 5.4 0 1 0 7.8 6.4" />
        </>
      )}
      {kind === 'BLOCKED' && (
        <>
          <circle cx="12" cy="12" r="8" strokeDasharray="3 2.2" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
        </>
      )}
    </svg>
  );
}

/** Where a dot sits inside the item's outline (x and y are local to the item). */
function dotAt(box: Rect, key: DotKey): { x: number; y: number } {
  const x = key === 'tl' || key === 'bl' ? box.x : key === 'tr' || key === 'br' ? box.x + box.w : box.x + box.w / 2;
  const y = key === 'tl' || key === 'tr' ? box.y : key === 'bl' || key === 'br' ? box.y + box.h : box.y + box.h / 2;
  return { x, y };
}
/** A point local to an item, as a point on the plan: turned by the item's rotation, then moved to its origin. */
function turned(origin: { x: number; y: number }, rotation: number, p: { x: number; y: number }): { x: number; y: number } {
  const a = (rotation * Math.PI) / 180;
  return { x: origin.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: origin.y + p.x * Math.sin(a) + p.y * Math.cos(a) };
}

/** The four corners and the middle of the selected item. The highlighted one is the turning point (only one at a time). */
function TurnDots({ box, zoom, pivot, onDown }: { box: Rect; zoom: number; pivot: DotKey; onDown: (e: ReactPointerEvent, key: DotKey) => void }) {
  const keys: DotKey[] = ['tl', 'tr', 'bl', 'br', 'c'];
  const r = Math.max(6, 9 / zoom);
  return (
    <>
      {keys.map((k) => {
        const { x, y } = dotAt(box, k);
        return k === pivot ? (
          <g key={k} className="le-pivot" onPointerDown={(e) => onDown(e, k)}>
            <circle cx={x} cy={y} r={r * 1.35} />
            <path d={'M ' + (x - r * 0.8) + ' ' + y + ' H ' + (x + r * 0.8) + ' M ' + x + ' ' + (y - r * 0.8) + ' V ' + (y + r * 0.8)} />
            <title>Turning point. Click another dot to move it here; drag any other dot to turn about this one.</title>
          </g>
        ) : (
          <circle key={k} className="le-rot" cx={x} cy={y} r={r} onPointerDown={(e) => onDown(e, k)}>
            <title>Drag to turn about the highlighted point (Shift snaps to 15°). Click to make this the turning point.</title>
          </circle>
        );
      })}
    </>
  );
}

/** The other layouts of the organization, to copy a plan from. */
function CopyLayoutMenu({ orgId, selfId, onPick }: { orgId: UUID; selfId?: UUID; onPick: (v: SeatLayoutSummary) => void }) {
  const { data, error, loading } = useAsync(() => layoutApi.listForOrg(orgId), [orgId]);
  const others = (data ?? []).filter((v) => v.id !== selfId);
  return (
    <div className="margin-menu">
      <p className="menu-heading">Copy the plan of</p>
      {loading && <p className="muted small">Loading layouts…</p>}
      {error && <p className="muted small">{error}</p>}
      {!loading && !error && others.length === 0 && <p className="muted small">This organization has no other layout.</p>}
      <ul className="le-copy-list">
        {others.map((v) => (
          <li key={v.id}>
            <button type="button" onClick={() => onPick(v)}>
              {v.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyLayoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** The plan picture with − / + / Fit buttons. Ctrl + scroll (or Ctrl + plus, minus, 0) zooms; Alt + scroll moves the view (with Shift, sideways). */
function PlanPreview({ src, width, height }: { src: string; width: number; height: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const keep = useRef<{ fx: number; fy: number } | null>(null);
  const touched = useRef(false);
  // Drag the picture like the Hand tool: it scrolls where it is bigger than the window and slides where it fits.
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number; ox: number; oy: number; sx: boolean; sy: boolean } | null>(null);
  const fitZoom = () => {
    const b = box.current;
    return b && b.clientWidth > 50 ? Math.min(4, Math.max(0.02, Math.min((b.clientWidth - 8) / width, (b.clientHeight - 8) / height))) : 0.5;
  };
  const zoomTo = (z: number) => {
    const b = box.current;
    touched.current = true;
    if (b) keep.current = { fx: (b.scrollLeft + b.clientWidth / 2) / b.scrollWidth, fy: (b.scrollTop + b.clientHeight / 2) / b.scrollHeight };
    setZoom(Math.min(4, Math.max(0.02, z)));
  };
  // After a zoom, the middle of the view stays the middle.
  useLayoutEffect(() => {
    const b = box.current;
    const k = keep.current;
    if (!b || !k) return;
    b.scrollLeft = k.fx * b.scrollWidth - b.clientWidth / 2;
    b.scrollTop = k.fy * b.scrollHeight - b.clientHeight / 2;
    keep.current = null;
  }, [zoom]);
  // Starts fitted: the window is still opening, so fit once it has a size.
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    // Again when the opening animation is done, unless it was zoomed meanwhile.
    const later = window.setTimeout(() => {
      if (!touched.current) setZoom(fitZoom());
    }, 400);
    const watch = new ResizeObserver(() => {
      if (b.clientWidth > 50 && !touched.current) setZoom(fitZoom());
    });
    watch.observe(b);
    return () => {
      watch.disconnect();
      window.clearTimeout(later);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function down(e: React.PointerEvent<HTMLDivElement>) {
    const b = box.current;
    if (!b || e.button !== 0) return;
    b.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, left: b.scrollLeft, top: b.scrollTop, ox: off.x, oy: off.y, sx: b.scrollWidth > b.clientWidth + 1, sy: b.scrollHeight > b.clientHeight + 1 };
    setGrabbing(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const b = box.current;
    const d = drag.current;
    if (!b || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.sx) b.scrollLeft = d.left - dx;
    if (d.sy) b.scrollTop = d.top - dy;
    const lim = (n: number, size: number, view: number) => Math.min(Math.max(n, 40 - size), view - 40);
    setOff({ x: d.sx ? 0 : lim(d.ox + dx, width * zoom, b.clientWidth), y: d.sy ? 0 : lim(d.oy + dy, height * zoom, b.clientHeight) });
  }
  function up() {
    drag.current = null;
    setGrabbing(false);
  }
  const latest = useRef({ zoom, zoomTo, fitZoom });
  latest.current = { zoom, zoomTo, fitZoom };
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        latest.current.zoomTo(latest.current.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
      } else if (e.altKey) {
        e.preventDefault();
        if (e.shiftKey) b.scrollLeft += e.deltaY || e.deltaX;
        else b.scrollTop += e.deltaY;
      }
    };
    // Heard before the editor behind the window, so its own zoom keys stay quiet.
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const l = latest.current;
      if (e.key === '+' || e.key === '=') l.zoomTo(l.zoom * 1.15);
      else if (e.key === '-') l.zoomTo(l.zoom / 1.15);
      else if (e.key === '0') l.zoomTo(l.fitZoom());
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    b.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('keydown', key, true);
    return () => {
      b.removeEventListener('wheel', wheel);
      document.removeEventListener('keydown', key, true);
    };
  }, []);
  return (
    <>
      <div className="le-preview-bar">
        <button type="button" className="icon-button" onClick={() => zoomTo(zoom / 1.15)} aria-label="Zoom the picture out" title="Zoom out (Ctrl + scroll down, or Ctrl + minus)">
          −
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-button" onClick={() => zoomTo(zoom * 1.15)} aria-label="Zoom the picture in" title="Zoom in (Ctrl + scroll up, or Ctrl + plus)">
          +
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { setOff({ x: 0, y: 0 }); zoomTo(fitZoom()); }} title="Fit the plan to the window (Ctrl + 0)">
          Fit
        </button>
      </div>
      <div className={`le-preview-box${grabbing ? ' is-grabbing' : ''}`} ref={box} tabIndex={0} aria-label="Plan picture" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img className="le-preview" src={src} alt={`Seat plan, ${width} by ${height}`} draggable={false} style={{ width: width * zoom, height: height * zoom, transform: `translate(${off.x}px, ${off.y}px)` }} />
      </div>
    </>
  );
}

/** Boxes back in a straight row. */
function StraightIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="9" width="5" height="6" rx="1" />
      <rect x="9.5" y="9" width="5" height="6" rx="1" />
      <rect x="17" y="9" width="5" height="6" rx="1" />
      <path d="M3 19H21" strokeDasharray="2 2.4" />
    </svg>
  );
}

/** Boxes set round an arc. */
function CircleIcon({ side }: { side: 'left' | 'right' | 'top' | 'bottom' }) {
  const turn = { top: 0, right: 90, bottom: 180, left: 270 }[side];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={`rotate(${turn} 12 12)`}>
      <path d="M3 16A9 9 0 0 1 21 16" strokeDasharray="2 2.4" />
      <rect x="1.5" y="14" width="4" height="6" rx="1" transform="rotate(-70 3.5 17)" />
      <rect x="10" y="3" width="4" height="6" rx="1" />
      <rect x="18.5" y="14" width="4" height="6" rx="1" transform="rotate(70 20.5 17)" />
      </g>
    </svg>
  );
}

/** A circular arrow, clockwise (or anticlockwise with `back`). */
function TurnIcon({ back = false }: { back?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={back ? 'matrix(-1 0 0 1 24 0)' : undefined}>
        <path d="M20 12a8 8 0 1 1-2.6-5.9" />
        <path d="M20 3.5V8.5H15" />
      </g>
    </svg>
  );
}

/** An align button: a guide line and two boxes lined up against it. */
function AlignIcon({ mode }: { mode: 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter' }) {
  const d = {
    left: ['M3 3V21', [4, 6, 14, 5], [4, 13, 8, 5]],
    right: ['M21 3V21', [6, 6, 14, 5], [12, 13, 8, 5]],
    hcenter: ['M12 3V21', [5, 6, 14, 5], [8, 13, 8, 5]],
    top: ['M3 3H21', [6, 4, 5, 14], [13, 4, 5, 8]],
    bottom: ['M3 21H21', [6, 6, 5, 14], [13, 12, 5, 8]],
    vcenter: ['M3 12H21', [6, 5, 5, 14], [13, 8, 5, 8]],
  }[mode] as [string, number[], number[]];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d[0]} />
      {[d[1], d[2]].map((r) => (
        <rect key={r.join()} x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx="1" />
      ))}
    </svg>
  );
}

/** A spacing button: boxes with an arrow between two of them (set a gap) or three boxes between two guide lines (spread evenly). */
function SpaceIcon({ axis, even }: { axis: 'x' | 'y'; even: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={axis === 'y' ? 'matrix(0 1 1 0 0 0)' : undefined}>
        {even ? (
          <>
            <path d="M3 4V20M21 4V20" />
            <rect x="5" y="8" width="3" height="8" rx="1" />
            <rect x="10.5" y="8" width="3" height="8" rx="1" />
            <rect x="16" y="8" width="3" height="8" rx="1" />
          </>
        ) : (
          <>
            <rect x="2" y="7" width="5" height="10" rx="1" />
            <rect x="17" y="7" width="5" height="10" rx="1" />
            <path d="M9 12H15M11 10L9 12L11 14M13 10L15 12L13 14" />
          </>
        )}
      </g>
    </svg>
  );
}

/** What can be done with several selected items at once. */
function MultiBar({ count, circleNow, onStraight, onAlign, onSpace, onTurn, onCircle, turnNow, onCopyBeside, onDuplicate, onDelete }: { count: number; circleNow: { side: 'left' | 'right' | 'top' | 'bottom'; depth: number } | null; onStraight: () => void; onCircle: (side: 'left' | 'right' | 'top' | 'bottom', depth: number, gap: number, fresh: boolean) => void; turnNow: string; onTurn: (deg: number) => void; onCopyBeside: (dir: Dir, count: number, gap: number) => void; onAlign: (mode: 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter') => void; onSpace: (axis: 'x' | 'y', gap: number | null) => void; onDuplicate: () => void; onDelete: () => void }) {
  const modes: ['left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter', string][] = [
    ['left', 'Align left edges'],
    ['hcenter', 'Centre across'],
    ['right', 'Align right edges'],
    ['top', 'Align top edges'],
    ['vcenter', 'Centre down'],
    ['bottom', 'Align bottom edges'],
  ];
  const [gap, setGap] = useState('20');
  const g = Math.max(0, Number(gap) || 0);
  const [depth, setDepth] = useState('5');
  // A circle already set on these sections keeps its side and depth, also after the selection was left and made again.
  const circleSide = circleNow?.side ?? null;
  const dep = circleNow?.depth ?? Math.min(50, Math.max(1, Number(depth) || 5));
  const [angle, setAngle] = useState('15');
  const deg = Math.min(360, Math.max(0, Number(angle) || 0));
  return (
    <>
      <div className="le-copyrow" role="group" aria-label="Align">
        <span>Align</span>
        {modes.map(([mode, label]) => (
          <button key={mode} type="button" className="icon-button" title={label} aria-label={label} onClick={() => onAlign(mode)}>
            <AlignIcon mode={mode} />
          </button>
        ))}
      </div>
      <div className="le-copyrow" role="group" aria-label="Gap between">
        <span>Gap between (px)</span>
        <QuantityField
          value={g}
          min={0}
          max={2000}
          label="Gap between sections"
          lessLabel="Smaller gap"
          moreLabel="Bigger gap"
          onCommit={(n) => {
            setGap(String(n));
            // The gap also sets how far apart a circle's sections sit.
            if (circleSide) onCircle(circleSide, dep, n, false);
          }}
        />
      </div>
      <div className="le-copyrow" role="group" aria-label="Set gap">
        <span>Set gap</span>
        <button type="button" className="icon-button" title="Set the gap across" aria-label="Set gap across" onClick={() => onSpace('x', g)}>
          <SpaceIcon axis="x" even={false} />
        </button>
        <button type="button" className="icon-button" title="Set the gap down" aria-label="Set gap down" onClick={() => onSpace('y', g)}>
          <SpaceIcon axis="y" even={false} />
        </button>
      </div>
      <div className="le-copyrow" role="group" aria-label="Spread evenly">
        <span>Spread evenly</span>
        <button type="button" className="icon-button" title="Spread evenly across (3 or more)" aria-label="Spread evenly across" disabled={count < 3} onClick={() => onSpace('x', null)}>
          <SpaceIcon axis="x" even />
        </button>
        <button type="button" className="icon-button" title="Spread evenly down (3 or more)" aria-label="Spread evenly down" disabled={count < 3} onClick={() => onSpace('y', null)}>
          <SpaceIcon axis="y" even />
        </button>
      </div>
      <div className="le-copyrow" role="group" aria-label="Depth of the circle">
        <span>Depth of the circle (1 to 50)</span>
        <QuantityField
          value={dep}
          min={1}
          max={50}
          label="Depth of the circle"
          lessLabel="Less deep"
          moreLabel="Deeper"
          onCommit={(n) => {
            setDepth(String(n));
            // Once a circle is set, the depth reshapes it.
            if (circleSide) onCircle(circleSide, n, g, false);
          }}
        />
      </div>
      <div className="le-copyrow" role="group" aria-label="Spread in a circle">
        <span>Spread in a circle</span>
        {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
          <button key={side} type="button" className={`icon-button${circleSide === side ? ' is-on' : ''}`} aria-pressed={circleSide === side} title={`Curve the rows so the middle bulges to the ${side}, fronts facing inward`} aria-label={`Spread in a circle, bulging to the ${side}`} disabled={count < 2} onClick={() => {
              onCircle(side, dep, g, true);
            }}>
            <CircleIcon side={side} />
          </button>
        ))}
        <button
          type="button"
          className="icon-button"
          title="Make them straight again, as before the circle"
          aria-label="Straighten, undo the circle"
          disabled={!circleSide}
          onClick={onStraight}
        >
          <StraightIcon />
        </button>
      </div>
      <label className="le-num">
        <span>Turn group by (°)</span>
        <input type="number" min={0} max={360} value={angle} onChange={(e) => setAngle(e.target.value)} />
      </label>
      <div className="le-copyrow" role="group" aria-label="Turn group">
        <span>Turn group ({turnNow})</span>
        <button type="button" className="icon-button" title={`Turn ${deg}° anticlockwise about the middle of the group`} aria-label="Turn group anticlockwise" onClick={() => onTurn(-deg)}>
          <TurnIcon back />
        </button>
        <button type="button" className="icon-button" title={`Turn ${deg}° clockwise about the middle of the group`} aria-label="Turn group clockwise" onClick={() => onTurn(deg)}>
          <TurnIcon />
        </button>
      </div>
      <CopyRows gap={g} onCopyBeside={onCopyBeside} />
      <button type="button" className="btn btn-sm" onClick={onDuplicate}>
        Duplicate all
      </button>
      <button type="button" className="btn btn-sm danger" onClick={onDelete}>
        Delete all
      </button>
    </>
  );
}

/** How many copies the Rows and columns buttons make. */
const ROW_COPIES = 3;
const MIN_PLAN = 100;
const MAX_PLAN = 100000;

/** Width and height of the plan. The boxes are text while you type (so you can clear them); the size is applied when you leave the box, press Enter or close the menu. */
function PlanSizeMenu({ width, height, onCommit }: { width: number; height: number; onCommit: (w: number, h: number) => void }) {
  const [w, setW] = useState(String(width));
  const [h, setH] = useState(String(height));
  const valid = (text: string, fallback: number) => {
    const n = Math.round(Number(text));
    return text.trim() !== '' && Number.isFinite(n) ? Math.min(MAX_PLAN, Math.max(MIN_PLAN, n)) : fallback;
  };
  const latest = useRef({ w, h, width, height, onCommit });
  latest.current = { w, h, width, height, onCommit };
  function commit() {
    const c = latest.current;
    const nw = valid(c.w, c.width);
    const nh = valid(c.h, c.height);
    setW(String(nw));
    setH(String(nh));
    if (nw !== c.width || nh !== c.height) c.onCommit(nw, nh);
  }
  // Closing the menu with a box still being typed in applies what is there.
  useEffect(() => () => commit(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const key = (e: React.KeyboardEvent) => e.key === 'Enter' && commit();
  return (
    <div className="margin-menu">
      <p className="menu-heading">Plan size</p>
      <div className="le-size">
        <label>
          Width
          <input type="number" inputMode="numeric" min={MIN_PLAN} max={MAX_PLAN} value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} onKeyDown={key} />
        </label>
        <label>
          Height
          <input type="number" inputMode="numeric" min={MIN_PLAN} max={MAX_PLAN} value={h} onChange={(e) => setH(e.target.value)} onBlur={commit} onKeyDown={key} />
        </label>
      </div>
      <p className="muted small">Between {MIN_PLAN} and {MAX_PLAN.toLocaleString()}. The plan is drawn on this much space; every seat and shape has to stay inside it.</p>
    </div>
  );
}

/** A whole number set with − and + or typed (applied on Enter or leaving the box). */
function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div className="le-copyrow" role="group" aria-label={label}>
      <span>{label}</span>
      <QuantityField value={value} min={min} max={max} label={label} lessLabel={`Lower ${label.toLowerCase()}`} moreLabel={`Raise ${label.toLowerCase()}`} onCommit={onChange} />
    </div>
  );
}

/** A box with its copy (or copies) beside it and an arrow for the way they go. */
function CopyIcon({ dir, many }: { dir: 'left' | 'right' | 'up' | 'down'; many: boolean }) {
  const turn = { right: undefined, left: 'matrix(-1 0 0 1 24 0)', down: 'matrix(0 1 1 0 0 0)', up: 'matrix(0 -1 1 0 0 24)' }[dir];
  const boxes = many ? [1, 9, 17] : [3, 13];
  const w = many ? 5 : 8;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={turn}>
        {boxes.map((x) => (
          <rect key={x} x={x} y={11} width={w} height={8} rx="1" />
        ))}
        <path d="M4 5.5H20M17 2.5L20 5.5L17 8.5" />
      </g>
    </svg>
  );
}

type Dir = 'left' | 'right' | 'up' | 'down';

/** Icon buttons that copy what is selected beside itself: once, or ${ROW_COPIES} times in a row or column. */
function CopyRows({ gap, onCopyBeside }: { gap: number; onCopyBeside: (dir: Dir, count: number, gap: number) => void }) {
  const dirs: Dir[] = ['left', 'right', 'down', 'up'];
  return (
    <>
      <div className="le-copyrow" role="group" aria-label="Duplicate beside">
        <span>Duplicate</span>
        {dirs.map((d) => (
          <button key={d} type="button" className="icon-button" title={`Duplicate to the ${d}`} aria-label={`Duplicate to the ${d}`} onClick={() => onCopyBeside(d, 1, gap)}>
            <CopyIcon dir={d} many={false} />
          </button>
        ))}
      </div>
      <div className="le-copyrow" role="group" aria-label="Rows and columns">
        <span>Rows and columns</span>
        {dirs.map((d) => (
          <button key={d} type="button" className="icon-button" title={`${ROW_COPIES} copies, one after another to the ${d}`} aria-label={`${ROW_COPIES} copies to the ${d}`} onClick={() => onCopyBeside(d, ROW_COPIES, gap)}>
            <CopyIcon dir={d} many />
          </button>
        ))}
      </div>
    </>
  );
}

/** The selected section's controls, on one wrapping bar like the ticket designer's selection bar. */
function SectionBar({ section, onPatch, onRebuild, onCopyBeside, onDuplicate, onDelete }: { section: LayoutSection; onPatch: (p: Partial<LayoutSection>) => void; onRebuild: (p: Partial<SectionParams>) => void; onCopyBeside: (dir: Dir, count: number, gap: number) => void; onDuplicate: () => void; onDelete: () => void }) {
  const p = paramsOf(section);
  const [gap, setGap] = useState('20');
  const g = Math.max(0, Number(gap) || 0);
  return (
    <>
      <span className="field-chip">Section</span>
      <label className="le-num le-name">
        <span>Name</span>
        <input type="text" maxLength={100} value={section.name} onChange={(e) => onPatch({ name: e.target.value })} />
      </label>
      <div className="segmented segmented-text" role="radiogroup" aria-label="Kind">
        {(['STANDARD', 'VIP'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={section.kind === k} onClick={() => onPatch({ kind: k })}>
            {k === 'VIP' ? 'VIP' : 'Standard'}
          </button>
        ))}
      </div>
      <div className="le-swatches" role="group" aria-label="Colour">
        {COLORS.map((c) => (
          <button key={c} type="button" className={`le-swatch${section.color.toUpperCase() === c ? ' is-on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={section.color.toUpperCase() === c} onClick={() => onPatch({ color: c })} />
        ))}
        <input type="color" value={section.color} onChange={(e) => onPatch({ color: e.target.value.toUpperCase() })} aria-label="Pick another colour" />
      </div>
      <Num label="Rows" value={p.rows} min={1} max={60} onChange={(n) => onRebuild({ rows: n })} />
      <Num label="Seats per row" value={p.perRow} min={1} max={100} onChange={(n) => onRebuild({ perRow: n })} />
      <Num label="Seat gap" value={p.gap} min={14} max={80} onChange={(n) => onRebuild({ gap: n })} />
      <Num label="Row gap" value={p.rowGap} min={14} max={80} onChange={(n) => onRebuild({ rowGap: n })} />
      <label className="le-num">
        <span>First row</span>
        <input type="text" maxLength={3} value={p.firstLabel} onChange={(e) => onRebuild({ firstLabel: e.target.value })} />
      </label>
      <Num label="First seat no." value={p.firstNumber} min={0} max={9999} onChange={(n) => onRebuild({ firstNumber: n })} />
      <label className="le-num">
        <span>Turn ({section.rotation ?? 0}°)</span>
        <input type="range" min={-180} max={180} step={5} value={section.rotation ?? 0} onChange={(e) => onPatch({ rotation: Number(e.target.value) })} />
      </label>
      <p className="muted small">The arrow above the section points to its front, row {p.firstLabel}. Turn the section so it faces the stage.</p>
      <div className="le-copyrow" role="group" aria-label="Gap between copies">
        <span>Gap between copies (px)</span>
        <QuantityField value={g} min={0} max={2000} label="Gap between copies" lessLabel="Smaller gap" moreLabel="Bigger gap" onCommit={(n) => setGap(String(n))} />
      </div>
      <CopyRows gap={g} onCopyBeside={onCopyBeside} />
      <button type="button" className="btn btn-sm" onClick={onDuplicate}>
        Duplicate
      </button>
      <button type="button" className="btn btn-sm danger" onClick={onDelete}>
        Delete
      </button>
    </>
  );
}

/** The selected stage, label or wall. */
function ShapeBar({ shape, onPatch, onDelete }: { shape: LayoutShape; onPatch: (p: Partial<LayoutShape>) => void; onDelete: () => void }) {
  const title = shape.type === 'STAGE' ? 'Stage' : shape.type === 'WALL' ? 'Wall' : 'Label';
  return (
    <>
      <span className="field-chip">{title}</span>
      {shape.type !== 'WALL' && (
        <label className="le-num le-name">
          <span>Text</span>
          <input type="text" maxLength={200} value={shape.text ?? ''} onChange={(e) => onPatch({ text: e.target.value })} />
        </label>
      )}
      {shape.type !== 'LABEL' && (
        <>
          <Num label="Width" value={shape.width ?? 0} min={1} max={100000} onChange={(n) => onPatch({ width: n })} />
          <Num label="Height" value={shape.height ?? 0} min={1} max={100000} onChange={(n) => onPatch({ height: n })} />
        </>
      )}
      <label className="le-num">
        <span>Turn ({shape.rotation ?? 0}°)</span>
        <input type="range" min={-180} max={180} step={5} value={shape.rotation ?? 0} onChange={(e) => onPatch({ rotation: Number(e.target.value) })} />
      </label>
      <button type="button" className="btn btn-sm danger" onClick={onDelete}>
        Delete
      </button>
    </>
  );
}
