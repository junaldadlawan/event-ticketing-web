import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { eventApi, ticketTemplateApi, ticketTypeApi, uploadApi } from '../../api/endpoints';
import { BACKGROUND_FITS } from '../../api/types';
import type {
  BackgroundFit,
  CodePlacement,
  CodeType,
  TextField,
  DynamicTextFieldKey,
  TextFieldAlign,
  TicketTemplate,
  TicketTemplateFormat,
} from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  AlignCenterIcon,
  AutoFitIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BarcodeIcon,
  BoldIcon,
  GridLinesIcon,
  HeightIcon,
  CheckIcon,
  ChevronDownIcon,
  DuplicateIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  ImageIcon,
  LockIcon,
  InfoIcon,
  LinkIcon,
  MagnetIcon,
  MinusIcon,
  PhoneIcon,
  PlusIcon,
  PrinterIcon,
  QrIcon,
  ResetIcon,
  RotateLeftIcon,
  RedoIcon,
  RulerIcon,
  RotateRightIcon,
  SaveIcon,
  SpinnerIcon,
  TicketSizeIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
  WarningIcon,
  WidthIcon,
} from '../../components/DesignerIcons';
import {
  DEFAULT_TICKET_SIZE,
  GRID_PX,
  TicketCanvas,
  autoGridPx,
  clampBackground,
  codeShape,
  fitBackground,
  changeCodeType,
  clampPlacement,
  codeLabel,
  defaultPlacement,
  isRotatable,
  normalizeRotation,
  resizePlacement,
  rotatePlacement,
} from '../../components/TicketCanvas';
import type { BackgroundRect, CanvasSelection, LayoutWarning, TicketSize } from '../../components/TicketCanvas';
import {
  CUSTOM_TEXT_MAX,
  SAMPLE_TEXT_MAX,
  exampleSampleText,
  MAX_CUSTOM_LABELS,
  PLACEHOLDERS,
  STATIC_PLACEHOLDERS,
  cleanCustomText,
  clampField,
  fieldsForSave,
  fieldsFromTemplate,
  newField,
  placeholderLabel,
  fieldDisplayText,
  fieldId,
  isDynamicKey,
  printedLines,
} from '../../components/ticketTextFields';
import type { PlaceholderKey } from '../../components/ticketTextFields';
import { findBlankArea } from '../../components/autoFitCode';
import { downloadBlob, exportTicketPng } from '../../components/exportTicketPng';
import { RealSizePreview } from '../../components/RealSizePreview';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
import { ErrorBox, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALL_TYPES = ''; // "applies to every ticket type" (ticketTypeId null)

/** The whole editable design, as undo / redo store it. */
interface DesignSnapshot {
  background: string | null;
  urlInput: string;
  bgColor: string | null;
  bgFit: BackgroundFit;
  bgRect: BackgroundRect | null;
  ticketSize: TicketSize;
  followImage: boolean;
  placement: CodePlacement;
  showCode: boolean;
  textFields: TextField[];
}
const HISTORY_LIMIT = 100;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The placeholder box, in two rows: per-ticket values first, then fixed event details and own labels. */
const PLACEHOLDER_GROUPS = [
  { label: 'Dynamic', hint: 'Changes per ticket: each ticket prints its own value', items: PLACEHOLDERS, custom: false },
  { label: 'Static', hint: 'The same on every ticket of this event', items: STATIC_PLACEHOLDERS, custom: true },
];

const CODE_TYPES: { value: CodeType; icon: ReactNode }[] = [
  { value: 'QR', icon: <QrIcon /> },
  { value: 'BARCODE', icon: <BarcodeIcon /> },
];

/** fill = the same button for a dynamic field: where its value starts inside the X box. */
const ALIGNMENTS: { value: TextFieldAlign; label: string; fill: string; icon: ReactNode }[] = [
  { value: 'LEFT', label: 'Align left', fill: 'Start at the left, fill to the right', icon: <AlignLeftIcon /> },
  { value: 'CENTER', label: 'Align centre', fill: 'Start in the middle, fill both ways', icon: <AlignCenterIcon /> },
  { value: 'RIGHT', label: 'Align right', fill: 'Start at the right, fill to the left', icon: <AlignRightIcon /> },
];

const FORMATS: { value: TicketTemplateFormat; label: string; short: string; icon: ReactNode }[] = [
  { value: 'DIGITAL', label: 'Digital ticket (PNG)', short: 'Digital', icon: <PhoneIcon /> },
  { value: 'PHYSICAL', label: 'Print ticket (PDF)', short: 'Print', icon: <PrinterIcon /> },
];

/** The saved ticket size, or the default when the template has none (or the API doesn't store it yet). */
function sizeOf(t: TicketTemplate | undefined): TicketSize {
  return t?.ticketWidth && t.ticketHeight ? { width: t.ticketWidth, height: t.ticketHeight } : DEFAULT_TICKET_SIZE;
}

/** The template's saved placement as stored (not fitted to any ticket yet), if it has one. */
/** The template's code type as a placeable type (NONE / missing -> QR, used if the code is added back). */
function codeTypeOf(t: TicketTemplate | undefined): CodeType {
  return t?.codeType === 'BARCODE' ? 'BARCODE' : 'QR';
}

function savedPlacement(t: TicketTemplate | undefined): CodePlacement | null {
  if (t && t.codeType !== 'NONE' && t.codeX != null && t.codeY != null && t.codeWidth != null) {
    return {
      codeType: codeTypeOf(t),
      codeX: t.codeX,
      codeY: t.codeY,
      codeWidth: t.codeWidth,
      codeRotation: t.codeRotation ?? 0,
    };
  }
  return null;
}

/**
 * A saved template as an editor design (or the blank starting design). Tickets
 * open at their saved size, or Standard; the image never resizes them itself.
 */
/** Moves up to this many ticket pixels count as a small nudge; more than that is a big move. */
const SMALL_MOVE_PX = 12;

/**
 * How big the unsaved change is, comparing what is on screen with the saved design (null = nothing saved yet).
 * Major: a new layout, a background added / removed / swapped, an item or the QR / barcode added or removed,
 * the ticket size changed, or something moved a long way. Minor: small nudges and style changes.
 */
function describeChange(base: DesignSnapshot | null, now: DesignSnapshot): { severity: 'major' | 'minor' | 'none'; note: string } {
  // Nothing saved yet: an empty layout is not "unsaved work"; one with content is a new layout.
  if (!base) {
    const empty = now.textFields.length === 0 && !now.showCode && !now.background && !now.bgColor;
    return empty ? { severity: 'none', note: 'empty, nothing to save' } : { severity: 'major', note: 'new layout' };
  }
  const major = (note: string) => ({ severity: 'major' as const, note });
  if ((base.background ?? '') !== (now.background ?? '')) {
    return major(!base.background ? 'background added' : !now.background ? 'background removed' : 'background changed');
  }
  if (base.showCode !== now.showCode) return major(now.showCode ? 'QR / barcode added' : 'QR / barcode removed');
  if (base.ticketSize.width !== now.ticketSize.width || base.ticketSize.height !== now.ticketSize.height) return major('ticket size changed');

  const before = new Map(base.textFields.map((f) => [fieldId(f), f]));
  const after = new Map(now.textFields.map((f) => [fieldId(f), f]));
  const added = [...after.keys()].filter((id) => !before.has(id)).length;
  const removed = [...before.keys()].filter((id) => !after.has(id)).length;
  if (added) return major(added === 1 ? '1 item added' : added + ' items added');
  if (removed) return major(removed === 1 ? '1 item removed' : removed + ' items removed');

  const { width, height } = now.ticketSize;
  let changed = false;
  for (const [id, a] of before) {
    const b = after.get(id)!;
    const dist = Math.hypot(((b.x - a.x) / 100) * width, ((b.y - a.y) / 100) * height);
    if (dist > SMALL_MOVE_PX) return major('an item moved a long way');
    if (dist > 0 || JSON.stringify({ ...a, x: 0, y: 0 }) !== JSON.stringify({ ...b, x: 0, y: 0 })) changed = true;
  }
  if (now.showCode) {
    const a = base.placement;
    const b = now.placement;
    const move = Math.hypot(((b.codeX - a.codeX) / 100) * width, ((b.codeY - a.codeY) / 100) * height);
    const grow = (Math.abs(b.codeWidth - a.codeWidth) / 100) * width;
    if (move > SMALL_MOVE_PX || grow > SMALL_MOVE_PX) return major('QR / barcode moved or resized a lot');
    if (a.codeType !== b.codeType) return major('QR / barcode type changed');
    if (JSON.stringify(a) !== JSON.stringify(b)) changed = true;
  }
  if (base.bgColor !== now.bgColor || base.bgFit !== now.bgFit || JSON.stringify(base.bgRect) !== JSON.stringify(now.bgRect)) changed = true;
  return changed ? { severity: 'minor', note: 'small position or style changes' } : { severity: 'none', note: 'same as the saved design' };
}

function designFromTemplate(t: TicketTemplate | undefined): DesignSnapshot {
  const size = sizeOf(t);
  return {
    background: t?.backgroundImageUrl || null,
    urlInput: t?.backgroundImageUrl || '',
    bgColor: t?.backgroundColor && HEX_COLOR.test(t.backgroundColor) ? t.backgroundColor.toLowerCase() : null,
    bgFit: BACKGROUND_FITS.includes(t?.backgroundFit as BackgroundFit) ? (t!.backgroundFit as BackgroundFit) : 'COVER',
    bgRect: savedBackgroundRect(t),
    ticketSize: size,
    followImage: false,
    placement: placementOf(t, size),
    // Saved design: code unless removed (NONE). No design yet: blank ticket.
    showCode: t ? t.codeType !== 'NONE' : false,
    textFields: fieldsFromTemplate(t?.textFields),
  };
}

/** A template's moved/resized background placement, if it has one. */
function savedBackgroundRect(t: TicketTemplate | undefined): BackgroundRect | null {
  if (
    t?.backgroundFit === 'CUSTOM' &&
    t.backgroundX != null &&
    t.backgroundY != null &&
    t.backgroundWidth != null &&
    t.backgroundHeight != null
  ) {
    return { x: t.backgroundX, y: t.backgroundY, width: t.backgroundWidth, height: t.backgroundHeight };
  }
  return null;
}

function placementOf(t: TicketTemplate | undefined, size: TicketSize): CodePlacement {
  const saved = savedPlacement(t);
  return saved ? clampPlacement(saved, size) : defaultPlacement(codeTypeOf(t), size);
}

export function TicketDesignerPage() {
  const { eventId = '' } = useParams();
  const { data, error, loading, setData } = useAsync(
    () => Promise.all([eventApi.get(eventId), ticketTypeApi.list(eventId), ticketTemplateApi.list(eventId)]),
    [eventId],
  );

  const [scope, setScope] = useState<string>(ALL_TYPES);
  // One layout covers every ticket type by default. Layouts added for a type that has no saved design yet:
  const [addedScopes, setAddedScopes] = useState<string[]>([]);
  // Designs waiting for their layout to be opened (a layout added with "+" starts as a blank or a copy).
  const pendingDesigns = useRef<Record<string, DesignSnapshot>>({});
  // Two layouts per ticket type: digital (PNG) and print (PDF). One is edited at a time
  // (always exactly one entry); edits to the other layout wait in `drafts` until you switch back.
  const [formats, setFormats] = useState<TicketTemplateFormat[]>(['DIGITAL']);
  // Unsaved edits of layouts you are not looking at right now, keyed "<ticket type id>|<format>".
  const drafts = useRef<Record<string, DesignSnapshot>>({});
  const shownKey = useRef('|DIGITAL'); // which layout is on screen
  const [background, setBackground] = useState<string | null>(null);
  // The ticket's fill color under the image; null = white.
  const [bgColor, setBgColor] = useState<string | null>(null);
  // How the background image fills a ticket of another shape.
  const [bgFit, setBgFit] = useState<BackgroundFit>('COVER');
  // The image's own pixel size (once loaded), and whether the ticket follows it.
  const [imageSize, setImageSize] = useState<TicketSize | null>(null);
  // Where the organizer moved/resized the image (used when the fit is CUSTOM).
  const [bgRect, setBgRect] = useState<BackgroundRect | null>(null);
  const [followImage, setFollowImage] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  // Standard size (900x380) by default; "Match image" makes it follow the background image.
  const [ticketSize, setTicketSize] = useState<TicketSize>(DEFAULT_TICKET_SIZE);
  const [placement, setPlacement] = useState<CodePlacement>(() => defaultPlacement('QR', DEFAULT_TICKET_SIZE));
  // Everything on the ticket is optional, picked from the placeholder box - a
  // new design starts blank, even the QR / barcode.
  const [showCode, setShowCode] = useState(false);
  const [textFields, setTextFields] = useState<TextField[]>([]);
  // Selection: one item (`selected`), plus any added with Shift-click (`multi`)
  // - two or more form a group that drags and deletes together.
  const [selected, setPrimary] = useState<CanvasSelection>(null);
  const [multi, setMulti] = useState<string[]>([]);
  // Everything on the layout that may print badly, measured by the canvas.
  const [layoutWarnings, setLayoutWarnings] = useState<LayoutWarning[]>([]);
  /** Select one item (or nothing); clears a multi-selection. */
  function setSelected(s: CanvasSelection) {
    setPrimary(s);
    setMulti([]);
  }
  // A click outside the ticket deselects - except on the editor's own controls
  // (bars, the add-on box, menus, dialogs), which work on the selection.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = e.target as Element | null;
      if (!el?.closest) return;
      if (el.closest('.ticket-canvas, .designer-bar, .placeholder-box, .popover-panel, dialog, .code-warning-panel')) return;
      setPrimary(null);
      setMulti([]);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
  /** Shift-click: add the item to the selection, or take it out. The background never joins a group. */
  function toggleInSelection(id: string) {
    if (id === 'background' || selected === 'background') return setSelected(id);
    const all = [selected, ...multi].filter((x): x is string => Boolean(x));
    const next = all.includes(id) ? all.filter((x) => x !== id) : [...all, id];
    setPrimary(next[0] ?? null);
    setMulti(next.slice(1));
  }
  const [labelInput, setLabelInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [fitting, setFitting] = useState(false);
  // Auto-centre: the code was fitted into a blank box and every resize now keeps it centred there.
  const [autoCentre, setAutoCentre] = useState(false);
  // Why auto-centre isn't possible right now (no box on the background, box too small): shown as a "!" on the button.
  const [fitIssue, setFitIssue] = useState<string | null>(null);
  // A different background is a new chance.
  useEffect(() => setFitIssue(null), [background]);
  const resizeAnchor = autoCentre ? 'centre' : undefined;
  const [realSizeOpen, setRealSizeOpen] = useState(false);
  // Preview with sample data (null = editing).
  const [preview, setPreview] = useState<PreviewSample | null>(null);
  const [confirmRemoveCode, setConfirmRemoveCode] = useState(false);
  const [confirmRemoveLayout, setConfirmRemoveLayout] = useState(false);
  // "Save all ..." waiting for a yes: which layouts it would save.
  const [confirmBatch, setConfirmBatch] = useState<{ keys: string[]; title: string } | null>(null);
  // A copy that would overwrite a layout that already has something in it waits here for a yes.
  const [confirmCopy, setConfirmCopy] = useState<{ scope: string; format: TicketTemplateFormat; label: string } | null>(null);
  // Items on their way out: they fade for a moment before they are really removed.
  const [leaving, setLeaving] = useState<string[]>([]);
  const FADE_MS = 180;
  function fadeOut(ids: string[], then: () => void) {
    setLeaving((l) => [...l, ...ids]);
    setTimeout(() => {
      then();
      setLeaving((l) => l.filter((x) => !ids.includes(x)));
    }, FADE_MS);
  }
  const [confirmSaveAll, setConfirmSaveAll] = useState(false);
  // Saving with layout warnings asks first: which save is waiting for the answer.
  const [confirmWarnings, setConfirmWarnings] = useState<'save' | 'all' | null>(null);
  // Layout aids, remembered per browser.
  const [showGrid, setShowGrid] = useStoredFlag('et.designer.grid', false);
  const [snap, setSnap] = useStoredFlag('et.designer.snap', false);
  // Locked background: can't be selected or moved (an editing aid, not saved with the design).
  const [bgLocked, setBgLocked] = useStoredFlag('et.designer.bgLock', false);
  // "small" | "medium" | "large" | a custom px number.
  const [gridChoice, setGridChoice] = useStoredString('et.designer.gridSize', 'medium');
  // Unit for the ticket size (display only; sizes are saved in px).
  const [unitChoice, setUnitChoice] = useStoredString('et.designer.sizeUnit', 'px');
  const sizeUnit: SizeUnit = isSizeUnit(unitChoice) ? unitChoice : 'px';
  // Unit for item sizes in the selection bar (code width, text size); saved values stay in %.
  const [itemUnitChoice, setItemUnit] = useStoredString('et.designer.itemUnit', '%');
  const itemUnit: ItemUnit = isItemUnit(itemUnitChoice) ? itemUnitChoice : '%';
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'save' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Bumped on every edit/load. Controls stay usable during a save (no
  // disabling = no flicker), so a save only clears "unsaved" if nothing
  // changed while it was in flight.
  const changeCount = useRef(0);
  // Undo / redo: a design snapshot before each action. One step per action,
  // however fast: a whole drag (pointer down to up), one click or key press,
  // or typing in one box until it loses focus. `step` is the action the last
  // snapshot belongs to; edits within the same action add nothing more.
  const history = useRef<{ past: DesignSnapshot[]; future: DesignSnapshot[]; step: object | null }>({
    past: [],
    future: [],
    step: null,
  });
  const [, setHistoryTick] = useState(0);
  // The action in progress: a pointer gesture, or focus in a text / number /
  // color box. Null = each edit is its own action.
  const gesture = useRef<object | null>(null);
  const inputSession = useRef<object | null>(null);
  const tickStep = useRef<object | null>(null);
  useEffect(() => {
    const isEntry = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    const down = () => {
      gesture.current = {};
    };
    const up = () => {
      gesture.current = null;
    };
    const focusIn = (e: FocusEvent) => {
      if (isEntry(e.target)) inputSession.current = {};
    };
    const focusOut = (e: FocusEvent) => {
      if (isEntry(e.target)) inputSession.current = null;
    };
    // Capture phase, so a gesture is known before any handler edits the design.
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('focusin', focusIn, true);
    window.addEventListener('focusout', focusOut, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('focusin', focusIn, true);
      window.removeEventListener('focusout', focusOut, true);
    };
  }, []);
  // Latest undo/redo for the keyboard listener (set each render below).
  const historyActions = useRef<{ undo: () => void; redo: () => void } | null>(null);
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      // Typing in a box: leave Ctrl+Z to the box itself.
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'color'))) {
        return;
      }
      e.preventDefault();
      if (isUndo) historyActions.current?.undo();
      else historyActions.current?.redo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const templates = data?.[2];
  /** The saved template for each format, for the chosen ticket type. */
  const savedFor = useMemo(() => {
    const byFormat: Partial<Record<TicketTemplateFormat, TicketTemplate>> = {};
    for (const t of templates ?? []) {
      if ((t.ticketTypeId ?? ALL_TYPES) === scope) byFormat[t.format] = t;
    }
    return byFormat;
  }, [templates, scope]);

  /** Design to show for a selection: the first selected format that has one (digital first). */
  function sourceFor(selection: TicketTemplateFormat[]) {
    return FORMATS.filter((f) => selection.includes(f.value))
      .map((f) => savedFor[f.value])
      .find((t): t is TicketTemplate => Boolean(t));
  }

  function loadDesign(t: TicketTemplate | undefined) {
    // A freshly loaded design starts a new undo history.
    history.current = { past: [], future: [], step: null };
    setHistoryTick((n) => n + 1);
    applyDesign(designFromTemplate(t));
    setSelected(null);
    setDirty(false);
    setErr(null);
  }

  /** Show a design in the editor (all of it), without marking it as an edit. */
  function applyDesign(s: DesignSnapshot) {
    changeCount.current++;
    // Same image as now (e.g. switching ticket type): its size is still known and it won't reload.
    setImageSize((prev) => (s.background === background ? prev : null));
    setBackground(s.background);
    setUrlInput(s.urlInput);
    setBgColor(s.bgColor);
    setBgFit(s.bgFit);
    setBgRect(s.bgRect);
    setTicketSize(s.ticketSize);
    setFollowImage(s.followImage);
    setPlacement(s.placement);
    setShowCode(s.showCode);
    setTextFields(s.textFields);
  }

  /**
   * Change the ticket's size, keeping the code where it was in % and nudging
   * it back inside if the new shape needs it. Not marked as an edit: the size
   * follows the image, and it's sent along with the next save.
   */
  function applyTicketSize(size: TicketSize) {
    // Always fit once the real size arrives (even if it equals the stand-in),
    // since a just-loaded placement may not have been fitted yet.
    setTicketSize(size);
    setPlacement((p) => clampPlacement(p, size));
    // A moved/resized image keeps its own shape on a ticket of another shape.
    setBgRect((r) => (r && imageSize ? clampBackground(r, size, imageSize) : r));
  }

  /**
   * The background image has loaded. The ticket keeps its size (Standard by
   * default) and the image is fitted into it; only after "Match image" does
   * the ticket take the image's size (also for an image swapped in later).
   */
  function onImageSize(size: TicketSize) {
    setImageSize(size);
    if (followImage) applyTicketSize(size);
  }

  // Load the saved design when the page loads or the ticket type changes. Not
  // after saving (the editor already shows what was saved) and not when
  // toggling formats (handled in selectFormat so unsaved edits survive).
  const loaded = templates !== undefined;
  useEffect(() => {
    const key = scope + '|' + formats[0];
    // Leaving a layout with unsaved edits: keep them, so coming back (or copying from it) still has them.
    if (shownKey.current !== key && dirty) drafts.current[shownKey.current] = snapshot();
    shownKey.current = key;
    const pending = pendingDesigns.current[scope];
    const draft = drafts.current[key];
    if (pending) {
      // A layout just added or copied into: it starts as the blank / copy that was chosen for it.
      delete pendingDesigns.current[scope];
      delete drafts.current[key];
      applyDesign(pending);
      setDirty(true);
    } else if (draft) {
      delete drafts.current[key];
      applyDesign(draft);
      setDirty(true);
    } else if (loaded) {
      loadDesign(sourceFor(formats));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scope]);


  // "Design ticket" on a ticket type opens this page on that type's layout (?type=<id>). A type without a
  // layout of its own starts as a copy of "All ticket types", so there is something to build on.
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const readyForType = Boolean(data) && templates !== undefined;
  useEffect(() => {
    if (!typeParam || !readyForType) return;
    if (!data![1].some((t) => t.id === typeParam)) return;
    const own = (templates ?? []).some((t) => t.ticketTypeId === typeParam && t.format === formats[0]);
    const all = (templates ?? []).find((t) => !t.ticketTypeId && t.format === formats[0]);
    if (!own && all) pendingDesigns.current[typeParam] = designFromTemplate(all);
    setAddedScopes((s) => (s.includes(typeParam) ? s : [...s, typeParam]));
    setScope(typeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeParam, readyForType]);

  const unsavedKeys = [...new Set([...(dirty ? [scope + '|' + formats[0]] : []), ...Object.keys(drafts.current)])];
  const unsavedLayouts = unsavedKeys.map((key) => {
    const [sc, fm] = key.split('|');
    const typeName = sc === ALL_TYPES ? 'All ticket types' : data?.[1].find((t) => t.id === sc)?.name ?? 'Ticket type';
    const now = key === scope + '|' + formats[0] ? snapshot() : drafts.current[key];
    const saved = (templates ?? []).find((t) => (t.ticketTypeId ?? ALL_TYPES) === sc && t.format === fm);
    const change = describeChange(saved ? designFromTemplate(saved) : null, now);
    return {
      key,
      label: typeName + ' · ' + (FORMATS.find((x) => x.value === fm)?.short ?? fm),
      ...change,
      onOpen: () => openLayout(sc, fm as TicketTemplateFormat),
    };
  });
  // Only layouts that really differ from what is saved count: edits that were undone are not "unsaved".
  const changedLayouts = unsavedLayouts.filter((l) => l.severity !== 'none');
  const openLayoutChanged = unsavedLayouts.some((l, i) => unsavedKeys[i] === scope + '|' + formats[0] && l.severity !== 'none');
  useUnsavedChanges(changedLayouts.length > 0, changedLayouts);

  // "Saved" tick on the button fades back to "Save" after a moment.
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [justSaved]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Event not found'} />;
  const [event, ticketTypes] = data;

  /** Everything an edit can change - what undo / redo restore. */
  function snapshot(): DesignSnapshot {
    return { background, urlInput, bgColor, bgFit, bgRect, ticketSize, followImage, placement, showCode, textFields };
  }

  function restore(s: DesignSnapshot) {
    applyDesign(s);
    setDirty(true);
    setJustSaved(false);
  }

  /** Before an edit: remember the design as it is now - once per action. */
  function record() {
    const h = history.current;
    // The action this edit belongs to: the drag / typing session in progress,
    // or (a click, a key press) just this moment - several edits made by one
    // handler land in the same task and share it.
    let step = inputSession.current ?? gesture.current;
    if (!step) {
      if (!tickStep.current) {
        tickStep.current = {};
        queueMicrotask(() => {
          tickStep.current = null;
        });
      }
      step = tickStep.current;
    }
    if (h.step !== step) {
      h.past.push(snapshot());
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
      h.step = step;
    }
    h.future = [];
    setHistoryTick((n) => n + 1);
  }

  function undo() {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(snapshot());
    h.step = null; // the next edit starts a new step
    restore(prev);
    setHistoryTick((n) => n + 1);
  }

  function redo() {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(snapshot());
    h.step = null;
    restore(next);
    setHistoryTick((n) => n + 1);
  }
  historyActions.current = { undo, redo };
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      record();
      changeCount.current++;
      setter(v);
      setDirty(true);
      setJustSaved(false);
    };
  }
  const changePlacement = edit(setPlacement);
  const changeBackground = edit(setBackground);
  const changeBgColor = edit(setBgColor);
  const changeBgFit = edit(setBgFit);
  /**
   * Lock / unlock the background. Locking lets go of it if it's selected;
   * unlocking selects it, ready to move or resize.
   */
  function toggleBgLock() {
    const next = !bgLocked;
    setBgLocked(next);
    if (next) {
      if (selected === 'background') setSelected(null);
    } else if (background) {
      setSelected('background');
    }
  }

  function removeBackground() {
    changeBackground(null);
    setUrlInput('');
    // A size taken from the image goes back to the standard shape; one the organizer set stays.
    if (followImage) applyTicketSize(DEFAULT_TICKET_SIZE);
    setFollowImage(false);
    setImageSize(null);
    setBgFit('COVER');
    setBgRect(null);
    if (selected === 'background') setSelected(null);
  }

  // Dragging or resizing the image switches it to its own placement.
  const changeBgRect = edit((r: BackgroundRect) => {
    setBgRect(r);
    setBgFit('CUSTOM');
  });
  // Picking a size (no background image) is an edit; the image's own size isn't.
  const changeTicketSize = edit(applyTicketSize);
  const changeTextFields = edit(setTextFields);
  const changeShowCode = edit(setShowCode);
  // A group drag: every moved field (and the code, if it was in the group) as one edit.
  const changeGroup = edit((g: { fields: TextField[]; code: CodePlacement | null }) => {
    const moved = new Map(g.fields.map((f) => [fieldId(f), f]));
    setTextFields((prev) => prev.map((x) => moved.get(fieldId(x)) ?? x));
    if (g.code) setPlacement(g.code);
  });
  function moveGroup(fields: TextField[], code: CodePlacement | null) {
    changeGroup({ fields, code });
  }
  /** Delete a multi-selection: its text goes now; the code (if in it) asks first, as usual. */
  function removeSelection() {
    const ids = [selected, ...multi].filter((x): x is string => Boolean(x));
    const gone = ids.filter((id) => id !== 'code');
    fadeOut(gone, () => changeTextFields(textFields.filter((f) => !ids.includes(fieldId(f)))));
    setSelected(ids.includes('code') && showCode ? 'code' : null);
    if (ids.includes('code') && showCode) setConfirmRemoveCode(true);
  }

  const selectedField = textFields.find((f) => fieldId(f) === selected) ?? null;
  const customCount = textFields.filter((f) => f.key === 'CUSTOM').length;
  /** Dynamic fields show X's ("XXX"); static ones the event's real value; labels their text. */
  function fieldText(f: TextField) {
    return fieldDisplayText(f, event);
  }

  function updateField(f: TextField) {
    changeTextFields(textFields.map((x) => (fieldId(x) === fieldId(f) ? clampField(f) : x)));
  }

  /**
   * Change a text field's alignment (the edge it grows from) without it jumping: x is the anchor
   * (left edge, centre or right edge), so moving the anchor to the matching spot on the same box
   * keeps the box where it is.
   */
  function withAlign(f: TextField, align: TextField['align']): TextField {
    const el = document.querySelector<HTMLElement>(`[data-field-id="${fieldId(f)}"]`);
    const canvas = document.querySelector<HTMLElement>('.ticket-canvas');
    if (!el || !canvas || f.align === align) return { ...f, align };
    const share = { LEFT: 0, CENTER: 0.5, RIGHT: 1 };
    const widthPct = (el.offsetWidth / canvas.offsetWidth) * 100;
    const left = f.x - share[f.align] * widthPct;
    return { ...f, align, x: left + share[align] * widthPct };
  }

  function removeField(id: string) {
    if (leaving.includes(id)) return;
    fadeOut([id], () => {
      changeTextFields(textFields.filter((x) => fieldId(x) !== id));
      if (selected === id) setSelected(null);
    });
  }

  /** "Add label": put the typed text on the ticket as a custom label and select it. */
  function addCustomLabel(e: FormEvent) {
    e.preventDefault();
    const text = cleanCustomText(labelInput);
    if (!text || customCount >= MAX_CUSTOM_LABELS) return;
    const f = newField('CUSTOM', textFields, text);
    changeTextFields([...textFields, f]);
    setSelected(fieldId(f));
    setLabelInput('');
  }

  /** A chip in the placeholder box was clicked: add it to the ticket, or take it off. */
  function togglePlaceholder(key: PlaceholderKey) {
    if (key === 'CODE') {
      if (showCode) {
        setConfirmRemoveCode(true); // a ticket without a code can't be scanned - ask first
      } else {
        changeShowCode(true);
        setSelected('code');
      }
      return;
    }
    if (textFields.some((f) => f.key === key)) {
      removeField(key);
    } else {
      changeTextFields([...textFields, newField(key, textFields)]);
      setSelected(key);
    }
  }

  function isOnTicket(key: PlaceholderKey) {
    return key === 'CODE' ? showCode : textFields.some((f) => f.key === key);
  }
  const label = codeLabel(placement.codeType);
  // For mid-sentence use: "QR code" keeps its capitals, "Barcode" becomes "barcode".
  const noun = placement.codeType === 'QR' ? label : label.toLowerCase();
  const canRotate = isRotatable(placement.codeType);
  const gridPx = gridPxFor(gridChoice, ticketSize);
  // Where the image is drawn: its own placement, or the fit preset once its size is known.
  const bgRectShown =
    bgFit === 'CUSTOM' ? bgRect : imageSize ? fitBackground(bgFit, ticketSize, imageSize) : null;
  // A checked format with no saved design yet also needs saving.
  // A layout that was never saved needs saving only once it has something in it.
  const openIsEmpty = textFields.length === 0 && !showCode && !background && !bgColor;
  const needsSave = openLayoutChanged || (formats.some((f) => !savedFor[f]) && !openIsEmpty);
  const anySaved = formats.some((f) => savedFor[f]);

  // Layouts shown: the default, every ticket type that has a saved design of its own, and the ones just
  // added with "+" (not saved yet). Delete a saved one with the trash button next to Save.
  const savedScopes = (templates ?? []).map((t) => t.ticketTypeId).filter((id): id is string => Boolean(id));
  const layoutScopes = [ALL_TYPES, ...new Set([...savedScopes, ...addedScopes])];
  const freeTypes = ticketTypes.filter((t) => !layoutScopes.includes(t.id));

  /**
   * The design of a layout to copy from: what is on screen if it is open, else its pending or unsaved
   * edits, else its saved design. Null when there is nothing to copy (never saved, never edited).
   */
  function designOfLayout(srcScope: string): DesignSnapshot | null {
    if (srcScope === scope) return snapshot();
    const pending = pendingDesigns.current[srcScope];
    if (pending) return pending;
    const draft = drafts.current[srcScope + '|' + formats[0]];
    if (draft) return draft;
    const saved = (templates ?? []).find((t) => (t.ticketTypeId ?? ALL_TYPES) === srcScope && t.format === formats[0]);
    return saved ? designFromTemplate(saved) : null;
  }

  /**
   * "+": add a layout for a ticket type, in the format open now. 'blank' starts empty; { from } starts as a
   * copy of one of the layouts in the switcher. Nothing is saved until Save.
   */
  function addLayout(typeId: string, mode: 'blank' | { from: string }) {
    const design = mode === 'blank' ? designFromTemplate(undefined) : designOfLayout(mode.from);
    if (!design) {
      setErr('That layout has no design to copy in ' + FORMATS.find((x) => x.value === formats[0])!.short + ' yet. Save it first, or pick another layout.');
      return;
    }
    pendingDesigns.current[typeId] = design;
    setAddedScopes((s) => (s.includes(typeId) ? s : [...s, typeId]));
    setScope(typeId);
  }

  /** Whether a layout already has content (unsaved edits, or a saved design with a code, text, or a background). */
  function layoutHasContent(target: { scope: string; format: TicketTemplateFormat }) {
    if (drafts.current[target.scope + '|' + target.format] || pendingDesigns.current[target.scope]) return true;
    const saved = (templates ?? []).find((t) => (t.ticketTypeId ?? ALL_TYPES) === target.scope && t.format === target.format);
    return Boolean(
      saved && ((saved.textFields?.length ?? 0) > 0 || (saved.codeType && saved.codeType !== 'NONE') || saved.backgroundImageUrl || saved.backgroundColor),
    );
  }

  /** Go to a layout (from the "unsaved changes" list): its tab and its format. Its unsaved edits come back. */
  function openLayout(targetScope: string, targetFormat: TicketTemplateFormat) {
    if (targetScope === scope && targetFormat === formats[0]) return;
    if (targetScope === scope) return selectFormat(targetFormat);
    setAddedScopes((s) => (targetScope === ALL_TYPES || s.includes(targetScope) ? s : [...s, targetScope]));
    setFormats([targetFormat]);
    setScope(targetScope);
  }

  /**
   * Duplicate: send what is on screen to another layout (another ticket type, or the other format) in one
   * step and open it there. Nothing is saved until Save; a layout that already has a saved design is
   * replaced on screen only.
   */
  function duplicateLayout(target: { scope: string; format: TicketTemplateFormat }) {
    const snap = snapshot();
    if (target.scope !== scope) {
      pendingDesigns.current[target.scope] = snap; // the scope effect applies it once the new layout opens
      if (target.scope !== ALL_TYPES) setAddedScopes((s) => (s.includes(target.scope) ? s : [...s, target.scope]));
      setFormats([target.format]);
      setScope(target.scope);
      return;
    }
    // Same ticket type, other format.
    if (dirty) drafts.current[scope + '|' + formats[0]] = snap;
    shownKey.current = scope + '|' + target.format;
    changeCount.current++;
    setFormats([target.format]);
    history.current = { past: [], future: [], step: null };
    setHistoryTick((n) => n + 1);
    applyDesign(snap);
    setSelected(null);
    setDirty(true);
    setJustSaved(false);
  }

  /**
   * Delete the open layout for good: its saved designs (digital and print) are deleted on the
   * server, then it leaves the switcher and "All ticket types" opens. That ticket type then prints with
   * the "All ticket types" design.
   */
  async function removeLayout() {
    setConfirmRemoveLayout(false);
    if (scope === ALL_TYPES || busy) return;
    const doomed = (templates ?? []).filter((t) => (t.ticketTypeId ?? ALL_TYPES) === scope);
    setBusy('save');
    setErr(null);
    const results = await Promise.allSettled(doomed.map((t) => ticketTemplateApi.delete(t.id)));
    const gone = new Set(doomed.filter((_, i) => results[i].status === 'fulfilled').map((t) => t.id));
    if (gone.size) setData((d) => (d ? [d[0], d[1], d[2].filter((t) => !gone.has(t.id))] : d));
    setBusy(null);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) {
      setErr("Couldn't delete the layout: " + errorMessage(failed.reason));
      return;
    }
    const removed = scope;
    for (const fm of FORMATS) delete drafts.current[removed + '|' + fm.value];
    delete pendingDesigns.current[removed];
    setDirty(false); // what was on screen is deleted with it
    setAddedScopes((s) => s.filter((id) => id !== removed));
    setScope(ALL_TYPES);
  }

  /** Switch the layout being edited. The one you leave keeps its unsaved edits until you come back. */
  function selectFormat(f: TicketTemplateFormat) {
    const current = formats[0];
    if (f === current) return;
    if (dirty) drafts.current[scope + '|' + current] = snapshot();
    else delete drafts.current[scope + '|' + current];
    const draft = drafts.current[scope + '|' + f];
    delete drafts.current[scope + '|' + f];
    shownKey.current = scope + '|' + f;
    const saved = savedFor[f];
    changeCount.current++;
    setFormats([f]);
    setJustSaved(false);
    setSelected(null);
    history.current = { past: [], future: [], step: null };
    setHistoryTick((n) => n + 1);
    if (draft) {
      applyDesign(draft);
      setDirty(true);
    } else if (saved) {
      loadDesign(saved);
    } else {
      setDirty(true); // no saved layout yet: start from this one, it still needs saving
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErr('Please choose a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr('That image is larger than 5 MB.');
      return;
    }
    setBusy('upload');
    setErr(null);
    try {
      const uploaded = await uploadApi.image(file);
      setBgFit('COVER');
      setBgRect(null);
      changeBackground(uploaded.url);
      setUrlInput(uploaded.url);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(null);
    }
  }

  /** Returns true when the URL was accepted (so the popover can close). */
  function applyUrl(): boolean {
    const url = urlInput.trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
      setErr('Enter a full image URL starting with http:// or https://');
      return false;
    }
    setErr(null);
    setBgFit('COVER');
    setBgRect(null);
    changeBackground(url);
    return true;
  }

  /** The current design as the API takes it (the parts every template shares). */
  function designBody(d: DesignSnapshot = snapshot()) {
    const { placement, ticketSize, showCode, textFields, bgFit, bgRect } = d;
    const p = clampPlacement(placement, ticketSize);
    // Round to 2 decimals without breaking the API's checks: the width first,
    // then x capped so codeX + codeWidth can't round up past 100.
    const codeWidth = round2(p.codeWidth);
    const codePart = showCode
      ? {
          codeType: p.codeType,
          codeX: Math.max(0, Math.min(round2(p.codeX), round2(100 - codeWidth))),
          codeY: Math.max(0, Math.min(round2(p.codeY), 100)),
          codeWidth,
          codeRotation: isRotatable(p.codeType) ? p.codeRotation : 0,
        }
      : { codeType: 'NONE' as const }; // the organizer took the code off the ticket
    const codeFields = {
      ...codePart,
      textFields: fieldsForSave(textFields),
      // The shape the % above refer to, so the ticket can be rendered to match.
      ticketWidth: Math.round(ticketSize.width),
      ticketHeight: Math.round(ticketSize.height),
    };
    // How the image sits: a fit preset, or (moved/resized) its exact place in %.
    const backgroundPart =
      bgFit === 'CUSTOM' && bgRect
        ? {
            backgroundFit: 'CUSTOM' as const,
            backgroundX: round2(bgRect.x),
            backgroundY: round2(bgRect.y),
            backgroundWidth: round2(bgRect.width),
            backgroundHeight: round2(bgRect.height),
          }
        : { backgroundFit: bgFit === 'CUSTOM' ? ('COVER' as const) : bgFit };
    return { ...backgroundPart, ...codeFields };
  }

  /**
   * Save the current design to each target (ticket type + format): update its
   * template if it has one, otherwise create it. One failing doesn't stop the
   * others. Returns the targets that failed, and the first error.
   */
  async function saveTo(targets: { scope: string; format: TicketTemplateFormat; design?: DesignSnapshot }[]) {
    const results = await Promise.allSettled(
      targets.map(({ scope: s, format: f, design }) => {
        const d = design ?? snapshot();
        const body = designBody(d);
        const { background, bgColor } = d;
        const existing = (templates ?? []).find((t) => (t.ticketTypeId ?? ALL_TYPES) === s && t.format === f);
        return existing
          ? ticketTemplateApi.update(existing.id, {
              // "" clears a previously saved background / color.
              backgroundImageUrl: background ?? '',
              backgroundColor: bgColor ?? '',
              ...body,
            })
          : ticketTemplateApi.create(eventId, {
              ticketTypeId: s === ALL_TYPES ? null : s,
              format: f,
              backgroundImageUrl: background ?? undefined,
              backgroundColor: bgColor ?? undefined,
              ...body,
            });
      }),
    );
    const saved = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (saved.length) {
      setData((d) => {
        if (!d) return d;
        const ids = new Set(saved.map((t) => t.id));
        return [d[0], d[1], [...d[2].filter((t) => !ids.has(t.id)), ...saved]];
      });
    }
    const failed = targets.filter((_, i) => results[i].status === 'rejected');
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
    return { failed, firstError };
  }

  /** Run a save; the design is "saved" only if nothing was edited meanwhile. */
  async function runSave(targets: { scope: string; format: TicketTemplateFormat }[], describeFailure: (failed: typeof targets) => string) {
    if (busy === 'save') return; // the button stays clickable-looking while saving
    const changeAtStart = changeCount.current;
    setBusy('save');
    setErr(null);
    const { failed, firstError } = await saveTo(targets);
    if (failed.length) {
      setErr(`${describeFailure(failed)}: ${errorMessage(firstError)}`);
    } else if (changeCount.current === changeAtStart) {
      for (const t of targets) delete drafts.current[t.scope + '|' + t.format];
      setDirty(false);
      setJustSaved(true);
    }
    // Otherwise something was edited during the save: it stays "unsaved".
    setBusy(null);
  }

  /** The open layout's key ("<ticket type id>|<format>"), and the design of an unsaved layout by key. */
  const openKey = scope + '|' + formats[0];
  const designByKey = (key: string) => (key === openKey ? snapshot() : drafts.current[key]);

  /** Save several layouts at once (the open one and/or the ones whose edits were kept). */
  async function saveLayouts(keys: string[]) {
    setConfirmBatch(null);
    if (busy === 'save' || keys.length === 0) return;
    const changeAtStart = changeCount.current;
    setBusy('save');
    setErr(null);
    const targets = keys.map((key) => {
      const [sc, fm] = key.split('|');
      return { scope: sc, format: fm as TicketTemplateFormat, design: designByKey(key) };
    });
    const { failed, firstError } = await saveTo(targets);
    if (failed.length) {
      const names = failed.map(
        (t) =>
          (t.scope === ALL_TYPES ? 'All ticket types' : ticketTypes.find((x) => x.id === t.scope)?.name ?? 'Ticket type') +
          ' · ' +
          FORMATS.find((x) => x.value === t.format)!.short,
      );
      setErr("Couldn't save " + names.join(', ') + ': ' + errorMessage(firstError));
    }
    const failedKeys = new Set(failed.map((t) => t.scope + '|' + t.format));
    for (const key of keys) if (!failedKeys.has(key) && key !== openKey) delete drafts.current[key];
    if (!failedKeys.has(openKey) && keys.includes(openKey) && changeCount.current === changeAtStart) {
      setDirty(false);
      setJustSaved(true);
    }
    setBusy(null);
  }

  /** Save the given layouts; if that goes beyond the open layout, list every change first and ask. */
  function requestSaveLayouts(keys: string[], title: string) {
    if (keys.length === 0) return;
    if (keys.length === 1 && keys[0] === openKey) {
      void saveLayouts(keys);
      return;
    }
    setConfirmBatch({ keys, title });
  }

  /** What a dynamic field prints on the chosen sample ticket (preview only). */
  function sampleValue(key: TextField['key'], sample: PreviewSample): string {
    const prefix = event.ticketPrefix || 'TKT';
    const typeName = ticketTypes.find((t) => t.id === scope)?.name ?? ticketTypes[0]?.name ?? 'VIP';
    const values: Record<PreviewSample, Partial<Record<TextField['key'], string>>> = {
      SEATED: { TICKET_TYPE: typeName, SECTION: 'A', ROW: '12', SEAT: '7', TICKET_NUMBER: `${prefix}-000123`, ATTENDEE_NAME: 'Juan Dela Cruz' },
      GA: {
        TICKET_TYPE: 'General Admission',
        SECTION: 'GA',
        ROW: '—',
        SEAT: '—',
        TICKET_NUMBER: `${prefix}-000124`,
        ATTENDEE_NAME: 'Maria Santos',
      },
      LONG: {
        TICKET_TYPE: 'Premium Platinum VIP Experience',
        SECTION: 'Lower Box 214',
        ROW: 'AA',
        SEAT: '1024',
        TICKET_NUMBER: `${prefix}-0001234567`,
        ATTENDEE_NAME: 'Maria Clara de los Santos-Ramirez',
      },
    };
    return values[sample][key] ?? '';
  }

  /**
   * Export the design as a PNG at the ticket's real size: what's on screen
   * without the editing aids (sample values when previewing, X's otherwise).
   */
  /**
   * Auto-fit: find the biggest blank area of the background with the code's
   * shape (clear of text fields) and put the code there, unrotated - e.g. the
   * empty "scan here" square of a ticket design.
   */
  async function onAutoFitCode(): Promise<boolean> {
    if (!background || fitting) return false;
    setFitting(true);
    setErr(null);
    setFitIssue(null);
    try {
      const canvasEl = document.querySelector('.ticket-canvas');
      const c = canvasEl?.getBoundingClientRect();
      const avoid =
        canvasEl && c
          ? [...canvasEl.querySelectorAll('.ticket-field')].map((el) => {
              const r = el.getBoundingClientRect();
              return {
                x: ((r.left - c.left) / c.width) * 100,
                y: ((r.top - c.top) / c.height) * 100,
                width: (r.width / c.width) * 100,
                height: (r.height / c.height) * 100,
              };
            })
          : [];
      const shape = codeShape(placement.codeType, ticketSize.width);
      const heightPct = ((placement.codeWidth / 100) * ticketSize.width) / shape.aspect / ticketSize.height * 100;
      const found = await findBlankArea({
        imageUrl: background,
        imageRect: bgRectShown,
        ticket: ticketSize,
        aspect: shape.aspect,
        minWidthPct: shape.minWidth,
        avoid,
        near: { x: placement.codeX + placement.codeWidth / 2, y: placement.codeY + heightPct / 2 },
      });
      if (!found) {
        setFitIssue(`No blank area on the background is big enough for the ${noun} (it needs at least ${pxToUnitText((shape.minWidth / 100) * ticketSize.width, sizeUnit)} ${sizeUnit}).`);
        return false;
      }
      if ('noBox' in found) {
        setFitIssue(`No black square found on the background to put the ${noun} in. Add a box (outlined square) to the design, or place the ${noun} by hand.`);
        return false;
      }
      if ('tooSmall' in found) {
        setFitIssue(
          `The blank box on the background is too small for a scannable ${noun}: about ${pxToUnitText(found.boxPx, sizeUnit)} ${sizeUnit} inside, ` +
            `but it needs at least ${pxToUnitText(found.needPx, sizeUnit)} ${sizeUnit}. Make the box bigger, or the ticket narrower.`,
        );
        return false;
      }
      changePlacement(clampPlacement({ ...placement, ...found, codeRotation: 0 }, ticketSize));
      setSelected('code');
      return true;
    } catch (e) {
      setErr(`Couldn't auto-fit the ${noun}: ${errorMessage(e)}`);
      return false;
    } finally {
      setFitting(false);
    }
  }

  /** Auto-centre toggle: switching on fits the code into the blank box; switching off frees resizing. */
  async function toggleAutoCentre() {
    if (autoCentre) return setAutoCentre(false);
    if (await onAutoFitCode()) setAutoCentre(true);
  }

  /** The design as a picture (PNG), the way the export and the real-size preview show it. */
  function renderDesign() {
    return exportTicketPng({
      size: ticketSize,
      backgroundColor: bgColor,
      backgroundUrl: background,
      backgroundRect: bgRectShown,
      texts: textFields.map((f) => ({
        field: f,
        lines: printedLines(fieldDisplayText(f, event), f.lineBreaks).split('\n'),
        value: preview && isDynamicKey(f.key) ? sampleValue(f.key, preview) : undefined,
      })),
      code: showCode
        ? {
            placement: clampPlacement(placement, ticketSize),
            svg: document.querySelector('.ticket-canvas .dummy-code svg')?.outerHTML ?? null,
          }
        : null,
    });
  }

  async function onExportPng() {
    if (exporting) return;
    setExporting(true);
    setErr(null);
    try {
      const { blob, skippedImage } = await renderDesign();
      const type = scope === ALL_TYPES ? 'All ticket types' : ticketTypes.find((t) => t.id === scope)?.name ?? 'ticket';
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ticket';
      // event title - ticket layout name - digital or print
      const format = FORMATS.find((x) => x.value === formats[0])!.short;
      downloadBlob(blob, slug(event.title) + '-' + slug(type) + '-' + slug(format) + '.png');
      if (skippedImage) {
        setErr('Exported without the background image - it couldn’t be read (its site may block copying).');
      }
    } catch (e) {
      setErr(`Couldn't export the PNG: ${errorMessage(e)}`);
    } finally {
      setExporting(false);
    }
  }

  function onSave() {
    // The same design goes to every checked format of the chosen ticket type.
    return runSave(
      formats.map((f) => ({ scope, format: f })),
      (failed) =>
        `Couldn't save the ${failed.map((t) => FORMATS.find((x) => x.value === t.format)!.label.toLowerCase()).join(' and ')}`,
    );
  }

  /** "Save to all ticket types": this design, for the checked formats, on every ticket type. */
  function onSaveToAll() {
    setConfirmSaveAll(false);
    const scopes = [ALL_TYPES, ...ticketTypes.map((t) => t.id)];
    return runSave(
      scopes.flatMap((s) => formats.map((f) => ({ scope: s, format: f }))),
      (failed) => `Couldn't save ${failed.length} of the designs`,
    );
  }

  return (
    <div className="designer-page">
      <h1 className="designer-title">Design your ticket</h1>
      <p className="muted small designer-subtitle">{event.title} · make a ticket people will want to keep</p>

      {/* Row 1: which template, and save. */}
      <div className="designer-bar">
        {/* One layout by default; the organizer adds another one (for a ticket type) only if wanted. */}
          <div className="segmented segmented-text" role="radiogroup" aria-label="Layout">
            {layoutScopes.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={scope === id} onClick={() => setScope(id)}>
                {id === ALL_TYPES ? 'All ticket types' : ticketTypes.find((t) => t.id === id)?.name ?? 'Ticket type'}
              </button>
            ))}
          </div>
        {freeTypes.length > 0 && (
          <Popover label="Add a layout for a ticket type" icon={<PlusIcon />} floating>
            {(close) => (
              <div className="bg-menu" role="menu" aria-label="Add a layout for">
                <p className="menu-heading">Add a layout for</p>
                {freeTypes.map((t) => {
                  return (
                    <div key={t.id} className="layout-add-row">
                      <span className="layout-add-name">{t.name}</span>
                      <div className="layout-add-actions">
                        <button
                          type="button"
                          role="menuitem"
                          className="placeholder-chip"
                          title={'Add a blank layout for ' + t.name}
                          onClick={() => {
                            close();
                            addLayout(t.id, 'blank');
                          }}
                        >
                          New layout
                        </button>
                      </div>
                      <span className="layout-add-sub">Duplicate from layout</span>
                      <div className="layout-add-actions">
                        {layoutScopes.map((src) => {
                          const name = src === ALL_TYPES ? 'All ticket types' : ticketTypes.find((x) => x.id === src)?.name ?? 'layout';
                          return (
                            <button
                              key={src}
                              type="button"
                              role="menuitem"
                              className="placeholder-chip"
                              title={'Start ' + t.name + ' as a copy of "' + name + '"' + (src === scope ? ' (open now, with your edits)' : '')}
                              onClick={() => {
                                close();
                                addLayout(t.id, { from: src });
                              }}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Popover>
        )}
        <span className="nav-divider" aria-hidden="true" />
        {/* Layout toggle: the digital design and the print design are separate. */}
        <div className="segmented segmented-text format-toggle" role="radiogroup" aria-label="Format">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={formats[0] === f.value}
              title={f.label}
              onClick={() => selectFormat(f.value)}
            >
              {f.icon}
              <span>{f.short}</span>
            </button>
          ))}
        </div>
        {/* One "Copy to" button replaces copy / paste / duplicate: pick where this layout goes. */}
        <Popover label="Copy this layout to..." icon={<DuplicateIcon />}>
          {(close) => {
            const nameOf = (id: string) => (id === ALL_TYPES ? 'All ticket types' : ticketTypes.find((t) => t.id === id)?.name ?? 'Ticket type');
            const here = FORMATS.find((x) => x.value === formats[0])!;
            return (
              <div className="bg-menu" role="menu" aria-label="Copy this layout to">
                <p className="menu-heading">Copy "{nameOf(scope) + ' · ' + here.short}" to</p>
                {layoutScopes.map((id) => (
                  <div key={id} className="layout-add-row">
                    <span className="layout-add-name">{nameOf(id)}</span>
                    <div className="layout-add-actions">
                      {FORMATS.filter((fm) => !(id === scope && fm.value === formats[0])).map((fm) => {
                        const hasSaved = (templates ?? []).some((x) => (x.ticketTypeId ?? ALL_TYPES) === id && x.format === fm.value);
                        return (
                          <button
                            key={fm.value}
                            type="button"
                            role="menuitem"
                            className="placeholder-chip"
                            title={hasSaved ? 'Replaces its saved design (on screen until you save)' : 'Creates a new layout'}
                            onClick={() => {
                              close();
                              const target = { scope: id, format: fm.value };
                              if (layoutHasContent(target)) {
                                setConfirmCopy({ ...target, label: nameOf(id) + ' · ' + fm.short });
                              } else {
                                duplicateLayout(target);
                              }
                            }}
                          >
                            {fm.icon}
                            {fm.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          }}
        </Popover>
        <span className="bar-spacer" />
        <IconButton
          label={preview ? 'Export as PNG (with the preview’s sample values)' : 'Export as PNG'}
          disabled={exporting}
          onClick={onExportPng}
        >
          {exporting ? <SpinnerIcon /> : <DownloadIcon />}
        </IconButton>
        {scope !== ALL_TYPES && (
          <IconButton
            label="Delete this layout"
            className="icon-button-danger"
            onClick={() => setConfirmRemoveLayout(true)}
          >
            <TrashIcon />
          </IconButton>
        )}
        {needsSave && (
          <span className="unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes" role="status" />
        )}
        <button
          type="button"
          className={`btn btn-cta btn-sm${justSaved ? ' is-saved' : ''}`}
          disabled={!needsSave && busy !== 'save'}
          aria-busy={busy === 'save'}
          title={
            formats.length > 1
              ? `Save to both formats${anySaved ? ' (updates saved designs)' : ''}`
              : anySaved
                ? 'Update the saved design'
                : 'Save this design'
          }
          onClick={() => (layoutWarnings.length ? setConfirmWarnings('save') : onSave())}
        >
          {busy === 'save' ? <SpinnerIcon /> : justSaved ? <CheckIcon /> : <SaveIcon />}
          {busy === 'save' ? 'Saving' : justSaved ? 'Saved!' : 'Save'}
        </button>
        {/* More ways to save: every unsaved layout of this ticket type, or of all ticket types. */}
        <Popover label="More ways to save" icon={<ChevronDownIcon />} floating>
          {(close) => {
            const changed = unsavedLayouts.filter((l) => l.severity !== 'none');
            const ofType = changed.filter((l) => l.key.split('|')[0] === scope).map((l) => l.key);
            const all = changed.map((l) => l.key);
            return (
              <div className="bg-menu" role="menu" aria-label="Save">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  disabled={ofType.length === 0 || busy === 'save'}
                  onClick={() => {
                    close();
                    requestSaveLayouts(ofType, 'Save all layouts of this ticket type?');
                  }}
                >
                  <SaveIcon />
                  <span>
                    Save all layouts of this ticket type
                    <small>{ofType.length ? ofType.length + ' with unsaved changes (Digital and Print)' : 'Nothing unsaved'}</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  disabled={all.length === 0 || busy === 'save'}
                  onClick={() => {
                    close();
                    requestSaveLayouts(all, 'Save all layouts?');
                  }}
                >
                  <SaveIcon />
                  <span>
                    Save all layouts
                    <small>{all.length ? all.length + ' with unsaved changes, in every ticket type' : 'Nothing unsaved'}</small>
                  </span>
                </button>
              </div>
            );
          }}
        </Popover>
      </div>

      {/*
        Row 2: tools that always apply - background, grid, snap, help. The QR /
        barcode controls live in the selection bar below and show when it's selected.
      */}
      <div className="designer-bar">
        <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <RedoIcon />
        </IconButton>
        <span className="bar-spacer" />
        {/* Every layout warning in one place; the number is how many there are. Click one to select that item. */}
        {layoutWarnings.length > 0 && (
          <Popover
            label={`${layoutWarnings.length} layout warning${layoutWarnings.length > 1 ? 's' : ''}`}
            icon={
              <span className="warn-icon">
                <WarningIcon />
                <span className="warn-count">{layoutWarnings.length}</span>
              </span>
            }
          >
            {(close) => (
              <div className="bg-menu warn-menu" role="menu" aria-label="Layout warnings">
                <p className="menu-heading">
                  {layoutWarnings.length} warning{layoutWarnings.length > 1 ? 's' : ''}
                </p>
                {layoutWarnings.map((w, i) => (
                  <button
                    key={`${w.target}-${i}`}
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    title="Select it on the ticket"
                    onClick={() => {
                      close();
                      setPreview(null);
                      setSelected(w.target);
                    }}
                  >
                    <WarningIcon />
                    <span>
                      {w.item}
                      <small>{w.message}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Popover>
        )}

        <input ref={fileInput} type="file" accept={ACCEPTED_TYPES.join(',')} hidden onChange={onFile} />
        {/* One "background" button: choose upload or a link from its menu. */}
        <Popover
          label={busy === 'upload' ? 'Uploading background…' : background ? 'Change background' : 'Add background'}
          icon={busy === 'upload' ? <SpinnerIcon /> : <ImageIcon />}
        >
          {(close) => (
            <BackgroundMenu
              url={urlInput}
              onUrlChange={setUrlInput}
              onUpload={() => {
                close();
                fileInput.current?.click();
              }}
              onUseUrl={() => {
                if (applyUrl()) close();
              }}
            />
          )}
        </Popover>
        {/* Only while locked: the way back, since a locked image can't be clicked (locking is on the image's own bar). */}
        {background && bgLocked && (
          <button
            type="button"
            className="icon-button toggle-button"
            aria-pressed="true"
            aria-label="Unlock background"
            title="Background locked - click to unlock"
            onClick={toggleBgLock}
          >
            <LockIcon />
          </button>
        )}
        {/* Ticket size (without an image) and fill color. */}
        <Popover
          label={`Ticket: ${sizeText(ticketSize, sizeUnit)}${bgColor ? `, ${bgColor}` : ''}`}
          icon={<TicketSizeIcon />}
        >
          {() => (
            <TicketMenu
              size={ticketSize}
              imageSize={background ? imageSize : null}
              followImage={followImage}
              unit={sizeUnit}
              onUnit={setUnitChoice}
              onFitImage={(s) => {
                setFollowImage(false); // applied once; the size stays editable afterwards
                changeTicketSize(s);
                setBgFit('COVER');
                setBgRect(null);
              }}
              color={bgColor}
              onColor={changeBgColor}
              onSize={(s) => {
                setFollowImage(false); // the organizer's size wins over the image's
                changeTicketSize(s);
              }}
            />
          )}
        </Popover>

        <span className="nav-divider" aria-hidden="true" />

        {/* Layout aids (not saved with the design). The grid icon opens size options. */}
        <Popover
          label={showGrid ? `Grid: ${Math.round(gridPx)} px` : 'Grid'}
          icon={<GridLinesIcon />}
          pressed={showGrid}
        >
          {(close) => (
            <GridMenu
              choice={gridChoice}
              size={ticketSize}
              showGrid={showGrid}
              onPick={(choice) => {
                setGridChoice(choice);
                setShowGrid(true);
                close();
              }}
              onHide={() => {
                setShowGrid(false);
                close();
              }}
            />
          )}
        </Popover>
        <button
          type="button"
          className="icon-button toggle-button"
          aria-pressed={snap}
          aria-label="Snap to grid"
          title={snap ? 'Snapping: on (lines up with the grid and other items; hold Alt to skip)' : 'Snapping: off'}
          onClick={() => setSnap(!snap)}
        >
          <MagnetIcon />
        </button>

        {/* Preview with sample data: see real-looking values (and no editing aids). */}
        <Popover
          label={preview ? `Preview: ${PREVIEW_SAMPLES.find((p) => p.value === preview)!.label}` : 'Views: real size, preview with sample data'}
          icon={<EyeIcon />}
          pressed={Boolean(preview)}
        >
          {(close) => (
            <PreviewMenu
              value={preview}
              onPick={(v) => {
                close();
                setPreview(v);
                if (v) setSelected(null);
              }}
              onRealSize={() => {
                close();
                setRealSizeOpen(true);
              }}
            />
          )}
        </Popover>
        <Popover label="Help" icon={<InfoIcon />}>
          {() => (
            <ul className="popover-help">
              <li>Undo / redo: arrows at the left of the toolbar, or Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z also redoes).</li>
              <li>Eye icon (views): Real size shows the ticket as big as it prints; or preview with sample data (seated, general admission, long values).</li>
              <li>Copy icon: copy another saved design in, or save this design to every ticket type.</li>
              <li>Shift-click items to select several, then drag one to move them together. Pink lines show when something lines up with the centre or another item (hold Alt to turn them off).</li>
              <li>The amber triangle (with a number) lists every layout warning - a code that may not scan, text off the ticket or outside the print safe area; click one to select it. Printable tickets show the safe area as a blue dashed line.</li>
              <li>
                Add only what you need from the “Add to ticket” box; click a ✓ item to take it off.
              </li>
              <li>
                Dynamic placeholders show X’s (set “Digits” to the longest value you expect) or, with “Aa”, your own sample text like a typical
                name. That box is the space each ticket’s value fills, from where
                the small arrow starts (alignment buttons: left, middle or right). Each ticket prints its own value (general admission:
                Section “GA”, Row and Seat “—”).
              </li>
              <li>
                Static items (event name, date, time, venue) show the event’s real details, the same on every ticket. Type your own text and
                press “+ Label” to add a custom label; select it to edit the text.
              </li>
              <li>
                Double-click a static item or label (or press F2) to split it into lines: Enter breaks the line, Backspace joins it back. Only line
                breaks can change there; Escape or clicking away finishes.
              </li>
              <li>Select a text field to change its size, digits, rotation, color, bold or alignment; Delete removes it. It turns around its centre.</li>
              <li>
                Grid icon: pick Small, Medium or Large, or type a size in pixels of your ticket image; magnet snaps
                dragged items to the grid.
              </li>
              <li>Drag the {noun} to move it.</li>
              <li>Corner dots: drag any corner to resize - the opposite corner stays put.</li>
              <li>Auto-fit (scan-frame icon on the code’s bar): puts the code in the blank box of your background design (e.g. a “scan here” square), centred with a margin.</li>
              <li>Knob on top: rotate (Shift snaps to 15°).</li>
              <li>Keys: arrows move, + / − resize, [ / ] rotate, Shift for bigger steps.</li>
              <li>
                Click the background image to select it: drag to move, corner dot to resize (keeps its shape). Cover, Contain or Stretch
                puts it back to a standard fit. Lock it with the padlock on its bar so it can't be
                selected or moved; the padlock in the toolbar unlocks it.
              </li>
              <li>
                Ticket icon: fill color and size - pick one, type W × H (px, in or cm; 300 px per inch) or “Match image”. The ticket starts at
                Standard and a background image is fitted into it (Image fit) unless you pick “Match image”
                ({ticketSize.width}×{ticketSize.height} now).
              </li>
              <li>Issued tickets use the saved code type and position. The background image is saved but not printed on tickets yet.</li>
            </ul>
          )}
        </Popover>
      </div>

      {/* Row 3: the placeholder box - add only what this ticket needs. */}
      <div className="placeholder-box" role="group" aria-label="Add to ticket">
        <span className="placeholder-total" title="Items on the ticket (text fields, plus the QR / barcode)">
          {textFields.length + (showCode ? 1 : 0)} on ticket
        </span>
        {PLACEHOLDER_GROUPS.map((g) => (
          <div key={g.label} className="placeholder-group" role="group" aria-label={`${g.label} add-ons`}>
            <span className="placeholder-box-label" title={g.hint}>
              {g.label}
              <span className="count-badge" aria-label={`${g.items.filter((p) => isOnTicket(p.key)).length + (g.custom ? customCount : 0)} added`}>
                {g.items.filter((p) => isOnTicket(p.key)).length + (g.custom ? customCount : 0)}
              </span>
            </span>
            {g.items.map((p) => {
              const on = isOnTicket(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`placeholder-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  title={on ? `Remove ${p.label} from the ticket` : `Add ${p.label} to the ticket`}
                  onClick={() => togglePlaceholder(p.key)}
                >
                  {on ? <CheckIcon /> : <PlusIcon />}
                  {p.label}
                </button>
              );
            })}
            {g.custom && (
              <form className="custom-label-form" onSubmit={addCustomLabel}>
                <input
                  type="text"
                  value={labelInput}
                  maxLength={CUSTOM_TEXT_MAX}
                  placeholder={customCount >= MAX_CUSTOM_LABELS ? `Max ${MAX_CUSTOM_LABELS} labels` : 'Your own label…'}
                  aria-label="Custom label text"
                  disabled={customCount >= MAX_CUSTOM_LABELS}
                  onChange={(e) => setLabelInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="placeholder-chip"
                  title="Add this label to the ticket"
                  disabled={!cleanCustomText(labelInput) || customCount >= MAX_CUSTOM_LABELS}
                >
                  <PlusIcon />
                  Label
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Selection bar: controls for whatever is selected (QR / barcode or a text field). Always the same height, so selecting never moves the ticket. */}
      <div
        className="designer-bar field-style-bar"
        aria-live="polite"
        key={`${preview ? "preview" : multi.length > 0 ? "multi" : (selected ?? "none")}`}
      >
        {preview ? (
          <span className="muted small">
            Preview: {PREVIEW_SAMPLES.find((p) => p.value === preview)!.label.toLowerCase()} - sample values, as it prints. Click the eye
            to keep editing.
          </span>
        ) : multi.length > 0 ? (
          <>
            <span className="field-chip">{multi.length + 1} selected</span>
            <span className="muted small">Drag any of them to move them together · Shift-click to add or remove</span>
            <span className="bar-spacer" />
            <IconButton label="Remove the selected items" className="icon-button-danger" onClick={removeSelection}>
              <TrashIcon />
            </IconButton>
          </>
        ) : selected === 'background' && background ? (
          <>
            <span className="field-chip">Background</span>
            <div className="segmented segmented-text" role="radiogroup" aria-label="Image fit">
              {FIT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={bgFit === o.value}
                  title={o.hint}
                  onClick={() => changeBgFit(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="muted small">
              {bgFit === 'CUSTOM' ? 'Moved / resized - pick a fit to reset' : 'Drag to move, corner dot to resize'}
            </span>
            <span className="bar-spacer" />
            <IconButton label="Lock background (can't be selected or moved)" onClick={toggleBgLock}>
              <LockIcon />
            </IconButton>
            <IconButton label="Remove background" className="icon-button-danger" onClick={removeBackground}>
              <TrashIcon />
            </IconButton>
          </>
        ) : selected === 'code' && showCode ? (
          <>
            <span className="field-chip">{label}</span>
            <div className="segmented segmented-text" role="radiogroup" aria-label="Code type">
              {CODE_TYPES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={placement.codeType === c.value}
                  aria-label={codeLabel(c.value)}
                  title={codeLabel(c.value)}
                  onClick={() => changePlacement(changeCodeType(placement, c.value, ticketSize))}
                >
                  {c.icon}
                </button>
              ))}
            </div>

            <span className="nav-divider" aria-hidden="true" />

            <div className="stepper" title="Size (width of the code)">
              <IconButton
                label={`Make ${noun} smaller (Shift: 5%)`}
                onClick={(e) =>
                  changePlacement(resizePlacement(placement, placement.codeWidth - (e.shiftKey ? 5 : 1), ticketSize, resizeAnchor))
                }
              >
                <MinusIcon />
              </IconButton>
              <NumberField
                value={pctToUnit(placement.codeWidth, ticketSize.width, itemUnit)}
                format={(v) => formatInUnit(v, itemUnit)}
                label={`${label} width in ${itemUnit === '%' ? 'percent of ticket width' : itemUnit}`}
                suffix=""
                step={unitStep(itemUnit)}
                onChange={(v) =>
                  changePlacement(resizePlacement(placement, unitToPct(v, ticketSize.width, itemUnit), ticketSize, resizeAnchor))
                }
              />
              <UnitPicker unit={itemUnit} onChange={setItemUnit} />
              <IconButton
                label={`Make ${noun} bigger (Shift: 5%)`}
                onClick={(e) =>
                  changePlacement(resizePlacement(placement, placement.codeWidth + (e.shiftKey ? 5 : 1), ticketSize, resizeAnchor))
                }
              >
                <PlusIcon />
              </IconButton>
            </div>

            <span className="nav-divider" aria-hidden="true" />

            {/* Greyed out (not hidden) for code types that can't rotate, so the bar keeps its layout. */}
            <div className="stepper" title={canRotate ? 'Rotation' : 'This code type can’t be rotated'}>
              <IconButton
                label="Rotate left 90°"
                disabled={!canRotate}
                onClick={() => changePlacement(rotatePlacement(placement, placement.codeRotation - 90, ticketSize))}
              >
                <RotateLeftIcon />
              </IconButton>
              <NumberField
                value={placement.codeRotation}
                format={formatDegrees}
                wrap={360}
                label={canRotate ? 'Rotation in degrees' : 'Rotation (not available for this code type)'}
                suffix="°"
                step={1}
                disabled={!canRotate}
                onChange={(deg) => changePlacement(rotatePlacement(placement, deg, ticketSize))}
              />
              <IconButton
                label="Rotate right 90°"
                disabled={!canRotate}
                onClick={() => changePlacement(rotatePlacement(placement, placement.codeRotation + 90, ticketSize))}
              >
                <RotateRightIcon />
              </IconButton>
            </div>

            <IconButton
              label={
                !background
                  ? `Auto-fit needs a background image with a blank area for the ${noun}`
                  : fitIssue
                    ? `Auto-centre isn't possible: ${fitIssue}`
                  : autoCentre
                    ? `Auto-centre is on: resizing keeps the ${noun} centred in its box. Click to turn off`
                    : `Auto-centre: put the ${noun} in the centre of the biggest blank area, and keep it centred when resized`
              }
              className={autoCentre ? 'toggle-button' : ''}
              aria-pressed={autoCentre}
              disabled={!background || fitting}
              onClick={toggleAutoCentre}
            >
              {fitting ? <SpinnerIcon /> : <AutoFitIcon />}
              {fitIssue && !fitting && (
                <span className="btn-badge" aria-hidden="true">
                  !
                </span>
              )}
            </IconButton>
            <IconButton
              label={`Reset position: ${noun} back to the bottom-right corner, default size, unrotated`}
              onClick={() => changePlacement(defaultPlacement(placement.codeType, ticketSize))}
            >
              <ResetIcon />
            </IconButton>
            <span className="bar-spacer" />
            <IconButton
              label={`Remove the ${noun} from the ticket`}
              className="icon-button-danger"
              onClick={() => setConfirmRemoveCode(true)}
            >
              <TrashIcon />
            </IconButton>
          </>
        ) : selectedField ? (
          <>
            <span className="field-chip" title={isDynamicKey(selectedField.key) ? 'Dynamic: each ticket prints its own value' : 'Static: the same on every ticket'}>
              {placeholderLabel(selectedField.key)}
            </span>
            {selectedField.key === 'CUSTOM' && (
              <input
                type="text"
                className="custom-label-edit"
                value={selectedField.text ?? ''}
                maxLength={CUSTOM_TEXT_MAX}
                aria-label="Label text"
                placeholder="Label text"
                onChange={(e) => updateField({ ...selectedField, text: e.target.value })}
              />
            )}
            <div className="stepper" title="Text size">
              <IconButton
                label="Smaller text"
                onClick={() => updateField({ ...selectedField, fontSize: selectedField.fontSize - 0.5 })}
              >
                <MinusIcon />
              </IconButton>
              <NumberField
                value={pctToUnit(selectedField.fontSize, ticketSize.height, itemUnit)}
                format={(v) => formatInUnit(v, itemUnit)}
                label={`Text size in ${itemUnit === '%' ? 'percent of ticket height' : itemUnit}`}
                suffix=""
                step={unitStep(itemUnit)}
                onChange={(v) =>
                  updateField({ ...selectedField, fontSize: unitToPct(v, ticketSize.height, itemUnit) })
                }
              />
              <UnitPicker unit={itemUnit} onChange={setItemUnit} />
              <IconButton
                label="Bigger text"
                onClick={() => updateField({ ...selectedField, fontSize: selectedField.fontSize + 0.5 })}
              >
                <PlusIcon />
              </IconButton>
            </div>
            {/* How many X's the placeholder shows - size it for the longest real value. */}
            {isDynamicKey(selectedField.key) && (
              <div className="segmented segmented-text" role="radiogroup" aria-label="Placeholder">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedField.sampleText == null}
                  aria-label="Placeholder: X's"
                  title="Show X's - set how many with Digits"
                  onClick={() => updateField({ ...selectedField, sampleText: undefined })}
                >
                  <span className="placeholder-mode">XX</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedField.sampleText != null}
                  aria-label="Placeholder: own text"
                  title="Type your own placeholder text (e.g. a typical name)"
                  onClick={() =>
                    selectedField.sampleText == null &&
                    updateField({
                      ...selectedField,
                      sampleText: exampleSampleText(selectedField.key as DynamicTextFieldKey, event.ticketPrefix),
                    })
                  }
                >
                  <span className="placeholder-mode">Aa</span>
                </button>
              </div>
            )}
            {isDynamicKey(selectedField.key) && selectedField.sampleText != null && (
              <input
                type="text"
                className="custom-label-edit"
                value={selectedField.sampleText ?? ''}
                maxLength={SAMPLE_TEXT_MAX}
                aria-label="Placeholder text"
                placeholder="X's when empty"
                title="Placeholder text: its width is the space each ticket's value fills"
                onChange={(e) => updateField({ ...selectedField, sampleText: e.target.value })}
              />
            )}
            {isDynamicKey(selectedField.key) && selectedField.sampleText == null && (
            <div className="stepper" title="Digits: how many characters the placeholder shows (XXX = 3)">
              <IconButton
                label="Fewer digits"
                onClick={() => updateField({ ...selectedField, sampleLength: (selectedField.sampleLength ?? 1) - 1 })}
              >
                <MinusIcon />
              </IconButton>
              <NumberField
                value={selectedField.sampleLength ?? 1}
                format={(n) => String(Math.round(n))}
                label="Digits shown in the placeholder"
                suffix="X"
                step={1}
                onChange={(n) => updateField({ ...selectedField, sampleLength: n })}
              />
              <IconButton
                label="More digits"
                onClick={() => updateField({ ...selectedField, sampleLength: (selectedField.sampleLength ?? 1) + 1 })}
              >
                <PlusIcon />
              </IconButton>
            </div>
            )}
            <label className="color-swatch" title="Text color">
              <input
                type="color"
                aria-label="Text color"
                value={selectedField.color}
                onChange={(e) => updateField({ ...selectedField, color: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="icon-button toggle-button"
              aria-pressed={selectedField.bold}
              aria-label="Bold"
              title="Bold"
              onClick={() => updateField({ ...selectedField, bold: !selectedField.bold })}
            >
              <BoldIcon />
            </button>
            <span className="nav-divider" aria-hidden="true" />
            {/* One button showing the current alignment; its three choices open underneath. */}
            <Popover
              label={`${isDynamicKey(selectedField.key) ? 'Fill direction' : 'Alignment'}: ${
                isDynamicKey(selectedField.key)
                  ? ALIGNMENTS.find((a) => a.value === selectedField.align)!.fill
                  : ALIGNMENTS.find((a) => a.value === selectedField.align)!.label
              }`}
              icon={ALIGNMENTS.find((a) => a.value === selectedField.align)!.icon}
              floating
              compact
            >
              {(close) => (
                <div
                  className="segmented segmented-text"
                  role="radiogroup"
                  aria-label={isDynamicKey(selectedField.key) ? 'Fill direction' : 'Alignment'}
                >
                  {ALIGNMENTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={selectedField.align === a.value}
                      aria-label={isDynamicKey(selectedField.key) ? a.fill : a.label}
                      title={
                        isDynamicKey(selectedField.key)
                          ? `Fill direction: ${a.fill} - each ticket's value fills the X box this way`
                          : `Align ${a.label} - the text grows away from this edge`
                      }
                      onClick={() => {
                        updateField(withAlign(selectedField, a.value));
                        close();
                      }}
                    >
                      {a.icon}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            <span className="nav-divider" aria-hidden="true" />
            <div className="stepper" title="Rotation (turns around the text's centre)">
              <IconButton
                label="Rotate text left 90°"
                onClick={() => updateField({ ...selectedField, rotation: (selectedField.rotation ?? 0) - 90 })}
              >
                <RotateLeftIcon />
              </IconButton>
              <NumberField
                value={selectedField.rotation ?? 0}
                format={formatDegrees}
                wrap={360}
                label="Text rotation in degrees"
                suffix="°"
                step={1}
                onChange={(deg) => updateField({ ...selectedField, rotation: deg })}
              />
              <IconButton
                label="Rotate text right 90°"
                onClick={() => updateField({ ...selectedField, rotation: (selectedField.rotation ?? 0) + 90 })}
              >
                <RotateRightIcon />
              </IconButton>
            </div>
            <span className="bar-spacer" />
            <IconButton
              label={`Remove ${selectedField.key === 'CUSTOM' ? 'this label' : placeholderLabel(selectedField.key)} from the ticket`}
              className="icon-button-danger"
              onClick={() => removeField(fieldId(selectedField))}
            >
              <TrashIcon />
            </IconButton>
          </>
        ) : (
          <span className="muted small">
            {showCode || textFields.length
              ? 'Looking good! Click the QR / barcode or any text on the ticket to fine-tune it.'
              : 'Pick items from the box above to drop them on your ticket, then drag them where they look best.'}
          </span>
        )}
      </div>

      <ErrorBox message={err} />

      <TicketCanvas
        backgroundUrl={background}
        backgroundColor={bgColor}
        size={ticketSize}
        placement={placement}
        onChange={changePlacement}
        resizeFromCentre={autoCentre}
        onCodeMove={() => setAutoCentre(false)}
        leavingIds={leaving}
        onImageSize={onImageSize}
        backgroundFit={bgFit}
        backgroundRect={bgRectShown}
        onBackgroundChange={bgLocked ? undefined : changeBgRect}
        showCode={showCode}
        textFields={textFields}
        fieldText={fieldText}
        preview={Boolean(preview)}
        fieldValue={(f) => (preview && isDynamicKey(f.key) ? sampleValue(f.key, preview) : null)}
        selected={selected}
        selectedIds={[selected, ...multi].filter((x): x is string => Boolean(x))}
        onGroupMove={moveGroup}
        onWarnings={setLayoutWarnings}
        printGuides={formats.includes('PHYSICAL')}
        dimensions={{
          width: `${pxToUnitText(ticketSize.width, sizeUnit)} ${sizeUnit}`,
          height: `${pxToUnitText(ticketSize.height, sizeUnit)} ${sizeUnit}`,
        }}
        onSelect={(s, additive) => (additive && s ? toggleInSelection(s) : setSelected(s))}
        onFieldChange={updateField}
        onFieldRemove={removeField}
        onCodeRemove={() => setConfirmRemoveCode(true)}
        showGrid={showGrid}
        snap={snap}
        gridPx={gridPx}
      />

      <RealSizePreview
        open={realSizeOpen}
        size={ticketSize}
        render={() => renderDesign().then((r) => r.blob)}
        onClose={() => setRealSizeOpen(false)}
      />

      {/* Saving a layout that has warnings: list them and ask first. */}
      <ConfirmDialog
        open={confirmWarnings !== null}
        title={`Save with ${layoutWarnings.length} warning${layoutWarnings.length === 1 ? '' : 's'}?`}
        confirmLabel="Save anyway"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmWarnings(null)}
        onConfirm={() => {
          const which = confirmWarnings;
          setConfirmWarnings(null);
          if (which === 'all') onSaveToAll();
          else onSave();
        }}
      >
        <p>The ticket may not print or scan well:</p>
        <ul className="save-warning-list">
          {layoutWarnings.map((w, i) => (
            <li key={`${w.target}-${i}`}>
              <strong>{w.item}</strong> - {w.message}
            </li>
          ))}
        </ul>
        <p>Are you sure you want to save it like this?</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmSaveAll}
        title="Save this design to every ticket type?"
        confirmLabel="Save to all"
        cancelLabel="Cancel"
        onCancel={() => setConfirmSaveAll(false)}
        onConfirm={() => {
          if (!layoutWarnings.length) return onSaveToAll();
          setConfirmSaveAll(false);
          setConfirmWarnings('all');
        }}
      >
        This design becomes the {formats.length > 1 ? 'digital and printable' : formatNoun(formats[0])} design for “All ticket
        types” and for {ticketTypes.map((t) => t.name).join(', ') || 'every ticket type'}. Their saved designs for{' '}
        {formats.length > 1 ? 'these formats' : 'this format'} are replaced.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmBatch !== null}
        title={confirmBatch?.title ?? ''}
        confirmLabel="Save"
        cancelLabel="Cancel"
        onCancel={() => setConfirmBatch(null)}
        onConfirm={() => {
          if (confirmBatch) void saveLayouts(confirmBatch.keys);
        }}
      >
        <p>These layouts will be saved:</p>
        <ul className="small unsaved-list">
          {unsavedLayouts
            .filter((l) => confirmBatch?.keys.includes(l.key))
            .map((l) => (
              <li key={l.key}>
                {l.label}
                <span className={'change-tag change-' + l.severity} title={l.note}>
                  {l.severity === 'major' ? 'Major' : l.severity === 'minor' ? 'Minor' : 'No change'}
                  {l.note ? ': ' + l.note : ''}
                </span>
              </li>
            ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmCopy !== null}
        title={'Replace "' + (confirmCopy?.label ?? '') + '"?'}
        confirmLabel="Replace"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmCopy(null)}
        onConfirm={() => {
          const target = confirmCopy;
          setConfirmCopy(null);
          if (target) duplicateLayout({ scope: target.scope, format: target.format });
        }}
      >
        This layout is not empty. Copying will overwrite it with the layout you are on now. The change only applies
        on screen until you save.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRemoveLayout}
        title="Delete this layout?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmRemoveLayout(false)}
        onConfirm={removeLayout}
      >
        This permanently deletes the layout and its saved designs (digital and print). Tickets of this type will then use the "All ticket types" design.{dirty ? " Your unsaved changes to it are lost too." : ""}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRemoveCode}
        title={`Remove the ${noun}?`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmRemoveCode(false)}
        onConfirm={() => {
          setConfirmRemoveCode(false);
          fadeOut(['code'], () => {
            changeShowCode(false);
            if (selected === 'code') setSelected(null);
          });
        }}
      >
        Tickets without a QR code or barcode can’t be scanned at the door. You can add it back from
        the box any time.
      </ConfirmDialog>
    </div>
  );
}

/** An on/off setting kept in this browser's localStorage (falls back to `initial` if unavailable). */
function useStoredFlag(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? initial : saved === '1';
    } catch {
      return initial;
    }
  });
  function set(next: boolean) {
    setValue(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // storage unavailable
    }
  }
  return [value, set] as const;
}

/** A string kept in this browser's localStorage (falls back to `initial`). */
function useStoredString(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  function set(next: string) {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // storage unavailable
    }
  }
  return [value, set] as const;
}

/**
 * Grid size presets, as squares across the ticket's width - so "Medium" is
 * comfortable on any image size. A custom size is stored as its px number.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Ticket size limits (px) and quick picks, for tickets without a background image. */
const TICKET_PX = { min: 100, max: 5000 } as const;
/*
 * Size units. Tickets are stored in px; inches and centimetres convert at
 * 300 DPI (print quality), so a 5.5 × 2 in ticket is 1650 × 600 px.
 */
type SizeUnit = 'px' | 'in' | 'cm';
const PRINT_DPI = 300;
const PX_PER_UNIT: Record<SizeUnit, number> = { px: 1, in: PRINT_DPI, cm: PRINT_DPI / 2.54 };
const UNIT_DECIMALS: Record<SizeUnit, number> = { px: 0, in: 2, cm: 1 };
const SIZE_UNITS: { value: SizeUnit; label: string; title: string }[] = [
  { value: 'px', label: 'px', title: 'Pixels' },
  { value: 'in', label: 'in', title: `Inches (${PRINT_DPI} px per inch)` },
  { value: 'cm', label: 'cm', title: `Centimetres (${PRINT_DPI} px per inch)` },
];
const isSizeUnit = (u: string): u is SizeUnit => u === 'px' || u === 'in' || u === 'cm';

/** px -> the unit, as display text ("5.5", "14", "1650"). */
function pxToUnitText(px: number, unit: SizeUnit): string {
  const f = 10 ** UNIT_DECIMALS[unit];
  return String(Math.round((px / PX_PER_UNIT[unit]) * f) / f);
}
/** A typed value in the unit -> whole px (NaN if it isn't a number). */
function unitToPx(text: string, unit: SizeUnit): number {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) ? NaN : Math.round(n * PX_PER_UNIT[unit]);
}
/** "1650×600 px" / "5.5×2 in". */
function sizeText(s: { width: number; height: number }, unit: SizeUnit): string {
  return `${pxToUnitText(s.width, unit)}×${pxToUnitText(s.height, unit)} ${unit}`;
}

/*
 * Units for item sizes (code width, text size): % of the ticket (what is
 * saved), or a real length - px, in, cm (300 DPI, like the ticket size).
 */
type ItemUnit = '%' | SizeUnit;
const ITEM_UNITS: { value: ItemUnit; label: string; title: string }[] = [
  { value: '%', label: '%', title: 'Percent of the ticket' },
  ...SIZE_UNITS,
];
const isItemUnit = (u: string): u is ItemUnit => u === '%' || isSizeUnit(u);
/** A saved % of `basePx` (ticket width or height) in the chosen unit. */
function pctToUnit(pct: number, basePx: number, unit: ItemUnit): number {
  return unit === '%' ? pct : ((pct / 100) * basePx) / PX_PER_UNIT[unit];
}
/** A value typed in the chosen unit back to % of `basePx`. */
function unitToPct(value: number, basePx: number, unit: ItemUnit): number {
  return unit === '%' ? value : ((value * PX_PER_UNIT[unit]) / basePx) * 100;
}
function formatInUnit(value: number, unit: ItemUnit): string {
  const f = 10 ** (unit === '%' ? 1 : UNIT_DECIMALS[unit]);
  return String(Math.round(value * f) / f);
}
const unitStep = (unit: ItemUnit) => (unit === '%' ? 0.5 : unit === 'px' ? 1 : unit === 'in' ? 0.01 : 0.1);

/** One button for the size unit: shows the unit, opens a short list to change it. */
function UnitPicker({ unit, onChange }: { unit: ItemUnit; onChange: (u: ItemUnit) => void }) {
  return (
    <Popover label={`Size unit: ${unit} (change)`} icon={<span className="unit-picker-label">{unit}</span>} floating>
      {(close) => (
        <div className="bg-menu unit-menu" role="menu" aria-label="Size unit">
          {ITEM_UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              role="menuitemradio"
              aria-checked={unit === u.value}
              className="menu-item"
              onClick={() => {
                onChange(u.value);
                close();
              }}
            >
              <span>
                {u.label}
                <small>{u.title}</small>
              </span>
              {unit === u.value && (
                <span className="menu-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

const SIZE_PRESETS = [
  { label: 'Standard', width: 900, height: 380 },
  { label: 'Wide', width: 1200, height: 400 },
  { label: 'Square', width: 800, height: 800 },
  { label: 'Portrait', width: 400, height: 900 },
] as const;

const FIT_OPTIONS: { value: Exclude<BackgroundFit, 'CUSTOM'>; label: string; hint: string }[] = [
  { value: 'COVER', label: 'Cover', hint: 'Fill the ticket, crop what sticks out' },
  { value: 'CONTAIN', label: 'Contain', hint: 'Show the whole image, color around it' },
  { value: 'STRETCH', label: 'Stretch', hint: 'Squash or stretch the image to the ticket' },
];

/**
 * Menu behind the ticket button: fill color and size (match the image, a
 * preset, or W × H). How the image fits is set on the
 * image's own selection bar.
 */
function TicketMenu({
  size,
  imageSize,
  followImage,
  onFitImage,
  color,
  onColor,
  onSize,
  unit,
  onUnit,
}: {
  size: TicketSize;
  /** The background image's own size; null = no image (or not loaded yet). */
  imageSize: TicketSize | null;
  followImage: boolean;
  /** Set the ticket to this size (the image's shape) and show the whole image on it. */
  onFitImage: (s: TicketSize) => void;
  color: string | null;
  onColor: (c: string | null) => void;
  onSize: (s: TicketSize) => void;
  unit: SizeUnit;
  onUnit: (u: SizeUnit) => void;
}) {
  const [w, setW] = useState(pxToUnitText(size.width, unit));
  const [h, setH] = useState(pxToUnitText(size.height, unit));
  const valid = (v: string) => {
    const n = unitToPx(v, unit);
    return n >= TICKET_PX.min && n <= TICKET_PX.max;
  };
  const customValid = valid(w) && valid(h);
  const isSize = (p: { width: number; height: number }) =>
    Math.round(size.width) === p.width && Math.round(size.height) === p.height;
  return (
    <div className="bg-menu ticket-menu" role="menu" aria-label="Ticket size and color">
      <div className="ticket-menu-row">
        <span>Color</span>
        <label className="color-swatch" title="Ticket background color">
          <input
            type="color"
            aria-label="Ticket background color"
            value={color ?? '#ffffff'}
            onChange={(e) => onColor(e.target.value.toLowerCase())}
          />
        </label>
        <button type="button" className="btn-link small" disabled={!color} onClick={() => onColor(null)}>
          White
        </button>
      </div>
      {imageSize && (
        <>
          {/* One click: keep one side, set the other to the image's shape, and show the whole image (Cover = no crop). */}
          {(() => {
            const ratio = imageSize.width / imageSize.height;
            const clampPx = (n: number) => Math.min(Math.max(Math.round(n), TICKET_PX.min), TICKET_PX.max);
            const byWidth = { width: clampPx(size.height * ratio), height: Math.round(size.height) };
            const byHeight = { width: Math.round(size.width), height: clampPx(size.width / ratio) };
            const options = [
              { label: 'Auto width', hint: 'Keeps the height, width follows the image', icon: <WidthIcon />, next: byWidth },
              { label: 'Auto height', hint: 'Keeps the width, height follows the image', icon: <HeightIcon />, next: byHeight },
            ];
            return options.map((o) => (
              <button
                key={o.label}
                type="button"
                role="menuitem"
                className="menu-item"
                title={isSize(o.next) ? 'The ticket already has the image’s shape' : undefined}
                onClick={() => {
                  setW(pxToUnitText(o.next.width, unit));
                  setH(pxToUnitText(o.next.height, unit));
                  onFitImage(o.next);
                }}
              >
                {o.icon}
                <span>
                  {o.label}
                  <small>{o.hint}</small>
                </span>
              </button>
            ));
          })()}
        </>
      )}
      <div className="ticket-menu-row">
        <span>Size unit</span>
        <div className="segmented segmented-text" role="radiogroup" aria-label="Size unit">
          {SIZE_UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              role="radio"
              aria-checked={unit === u.value}
              title={u.title}
              onClick={() => {
                // Keep what's typed: convert the boxes to the new unit.
                const pw = unitToPx(w, unit);
                const ph = unitToPx(h, unit);
                setW(Number.isNaN(pw) ? w : pxToUnitText(pw, u.value));
                setH(Number.isNaN(ph) ? h : pxToUnitText(ph, u.value));
                onUnit(u.value);
              }}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="menuitemradio"
              aria-checked={(!imageSize || !followImage) && isSize(p)}
              className="menu-item"
              onClick={() => {
                setW(pxToUnitText(p.width, unit));
                setH(pxToUnitText(p.height, unit));
                onSize({ width: p.width, height: p.height });
              }}
            >
              <TicketSizeIcon />
              <span>
                {p.label}
                <small>
                  {sizeText(p, unit)}
                </small>
              </span>
              {(!imageSize || !followImage) && isSize(p) && (
                <span className="menu-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
          <form
            className="popover-form grid-custom"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (customValid) onSize({ width: unitToPx(w, unit), height: unitToPx(h, unit) });
            }}
          >
            <label className="grid-custom-label">
              <span>W</span>
              <input
                type="number"
                inputMode="decimal"
                step={unit === 'px' ? 1 : unit === 'in' ? 0.01 : 0.1}
                aria-label={`Ticket width in ${unit}`}
                aria-invalid={w !== '' && !valid(w)}
                value={w}
                onChange={(e) => setW(e.target.value)}
              />
            </label>
            <label className="grid-custom-label">
              <span>H</span>
              <input
                type="number"
                inputMode="decimal"
                step={unit === 'px' ? 1 : unit === 'in' ? 0.01 : 0.1}
                aria-label={`Ticket height in ${unit}`}
                aria-invalid={h !== '' && !valid(h)}
                value={h}
                onChange={(e) => setH(e.target.value)}
              />
              <span className="muted">{unit}</span>
            </label>
            <button
              className="icon-button"
              aria-label="Use this ticket size"
              title={`Use this size (${sizeText({ width: TICKET_PX.min, height: TICKET_PX.max }, unit).replace('×', ' to ')})`}
              disabled={!customValid}
            >
              <CheckIcon />
            </button>
          </form>
    </div>
  );
}

const GRID_PRESETS = [
  { value: 'small', label: 'Small', columns: 80 },
  { value: 'medium', label: 'Medium', columns: 40 },
  { value: 'large', label: 'Large', columns: 20 },
] as const;

/** Grid cell size in ticket (= image) pixels for a stored choice. */
function gridPxFor(choice: string, size: TicketSize): number {
  const preset = GRID_PRESETS.find((p) => p.value === choice);
  if (preset) return size.width / preset.columns;
  const px = Number(choice);
  return Number.isFinite(px) && px >= GRID_PX.min ? Math.min(px, GRID_PX.max) : autoGridPx(size);
}

/** Menu behind the grid button: Small / Medium / Large, a custom px size, or hide. */
function GridMenu({
  choice,
  size,
  showGrid,
  onPick,
  onHide,
}: {
  choice: string;
  size: TicketSize;
  showGrid: boolean;
  onPick: (choice: string) => void;
  onHide: () => void;
}) {
  const isCustom = !GRID_PRESETS.some((p) => p.value === choice);
  const [custom, setCustom] = useState(isCustom ? choice : String(Math.round(gridPxFor(choice, size))));
  const customPx = Math.round(Number(custom));
  const customValid = Number.isFinite(customPx) && customPx >= GRID_PX.min && customPx <= GRID_PX.max;
  return (
    <div className="bg-menu grid-menu" role="menu" aria-label="Grid size">
      {GRID_PRESETS.map((p) => {
        const active = showGrid && choice === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            className="menu-item"
            onClick={() => onPick(p.value)}
          >
            <GridLinesIcon />
            <span>
              {p.label}
              <small>
                {Math.round(size.width / p.columns)} px · {p.columns} across
              </small>
            </span>
            {active && (
              <span className="menu-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
      <form
        className="popover-form grid-custom"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (customValid) onPick(String(customPx));
        }}
      >
        <label className="grid-custom-label">
          <span>Custom{showGrid && isCustom ? ' ✓' : ''}</span>
          <input
            type="number"
            inputMode="numeric"
            min={GRID_PX.min}
            max={GRID_PX.max}
            step={1}
            aria-label="Custom grid size in pixels"
            aria-invalid={custom !== '' && !customValid}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <span className="muted">px</span>
        </label>
        <button className="icon-button" aria-label="Use this grid size" title="Use this grid size" disabled={!customValid}>
          <CheckIcon />
        </button>
      </form>
      {showGrid && (
        <button type="button" className="menu-item grid-hide" onClick={onHide}>
          <span>Hide grid</span>
        </button>
      )}
    </div>
  );
}

const formatNoun = (f: TicketTemplateFormat | undefined) => (f === 'PHYSICAL' ? 'printable' : 'digital');

/** Sample tickets for the preview: a seated one, a general admission one, and long values. */
type PreviewSample = 'SEATED' | 'GA' | 'LONG';
const PREVIEW_SAMPLES: { value: PreviewSample; label: string; hint: string }[] = [
  { value: 'SEATED', label: 'Seated ticket', hint: 'Section A, Row 12, Seat 7' },
  { value: 'GA', label: 'General admission', hint: 'Section GA, Row and Seat —' },
  { value: 'LONG', label: 'Long values', hint: 'Check nothing runs off the ticket' },
];

/** Menu behind the eye button: pick a sample ticket to preview, or go back to editing. */
function PreviewMenu({
  value,
  onPick,
  onRealSize,
}: {
  value: PreviewSample | null;
  onPick: (v: PreviewSample | null) => void;
  /** Open the real-size view (the ticket as big as it prints). */
  onRealSize: () => void;
}) {
  return (
    <div className="bg-menu" role="menu" aria-label="Views">
      <button type="button" role="menuitem" className="menu-item" onClick={onRealSize}>
        <RulerIcon />
        <span>
          Real size
          <small>The ticket as big as it prints, on this screen</small>
        </span>
      </button>
      <p className="menu-heading menu-heading-split">Preview with</p>
      {PREVIEW_SAMPLES.map((p) => (
        <button
          key={p.value}
          type="button"
          role="menuitemradio"
          aria-checked={value === p.value}
          className="menu-item"
          onClick={() => onPick(p.value)}
        >
          <EyeIcon />
          <span>
            {p.label}
            <small>{p.hint}</small>
          </span>
          {value === p.value && (
            <span className="menu-check" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
      {value && (
        <button type="button" className="menu-item menu-item-split" onClick={() => onPick(null)}>
          <EditIcon />
          <span>Back to editing</span>
        </button>
      )}
    </div>
  );
}

/** Menu behind the copy button: take in another saved design, or save this one to every ticket type. */
/** Menu behind the background button: upload a file, or reveal a box for an image link. */
function BackgroundMenu({
  url,
  onUrlChange,
  onUpload,
  onUseUrl,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onUpload: () => void;
  onUseUrl: () => void;
}) {
  const [showUrl, setShowUrl] = useState(false);
  return (
    <div className="bg-menu">
      <button type="button" className="menu-item" onClick={onUpload}>
        <UploadIcon />
        <span>
          Upload image
          <small>PNG, JPEG, WebP or GIF, up to 5 MB</small>
        </span>
      </button>
      <button
        type="button"
        className="menu-item"
        aria-expanded={showUrl}
        onClick={() => setShowUrl((s) => !s)}
      >
        <LinkIcon />
        <span>From URL</span>
      </button>
      {showUrl && (
        <form
          className="popover-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onUseUrl();
          }}
        >
          <input
            type="url"
            autoFocus
            placeholder="https://example.com/ticket.png"
            aria-label="Background image URL"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
          <button className="icon-button" aria-label="Use this image" title="Use this image" disabled={!url.trim()}>
            <CheckIcon />
          </button>
        </form>
      )}
    </div>
  );
}

/** Icon-only button; the label becomes the tooltip and the accessible name. */
function IconButton({
  label,
  children,
  className = '',
  ...rest
}: {
  label: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  'aria-pressed'?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

/** Icon button that opens a small panel below it; closes on outside click or Escape. */
function Popover({
  label,
  icon,
  disabled,
  pressed,
  floating = false,
  compact = false,
  children,
}: {
  label: string;
  icon: ReactNode;
  /** Shrink the panel to its content (a short row of buttons) instead of the usual menu width. */
  compact?: boolean;
  disabled?: boolean;
  /** Show the button as "on" (e.g. the grid is visible). */
  pressed?: boolean;
  /**
   * Place the panel on the page (fixed) instead of inside the button's box -
   * for buttons in a bar that clips its contents (the selection bar scrolls).
   */
  floating?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; centre: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    // A floating panel is placed on the page: keep it under its button when
    // the page or the bar scrolls (clicking in a scrolling bar can scroll it).
    function onMove() {
      if (floating) place();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, floating]);

  function place() {
    if (!button.current) return;
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), centre: r.left + r.width / 2 });
  }

  function toggle() {
    if (!open && floating) place();
    setOpen((o) => !o);
  }

  return (
    <div className="popover" ref={root}>
      <button
        ref={button}
        type="button"
        className={`icon-button${pressed !== undefined ? ' toggle-button' : ''}`}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={toggle}
      >
        {icon}
      </button>
      {open && (
        <div
          className={`popover-panel${compact ? ' popover-panel-compact' : ''}`}
          role="dialog"
          aria-label={label}
          style={
            floating && pos
              ? compact
                ? { position: 'fixed', top: pos.top, left: pos.centre, right: 'auto', transform: 'translateX(-50%)' }
                : { position: 'fixed', top: pos.top, right: pos.right }
              : undefined
          }
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/**
 * Number box with a unit suffix. It keeps its own text while focused (so the
 * user can type "50" even though "5" alone gets clamped up to the minimum),
 * applies every valid number as they type, follows outside changes (buttons,
 * dragging) only while not focused, and shows the final value on blur.
 */
function NumberField({
  value,
  format,
  onChange,
  label,
  suffix,
  step,
  disabled,
  wrap,
}: {
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  label: string;
  suffix: string;
  step: number;
  disabled?: boolean;
  /** Wrap typed values into 0..wrap-1 right away (degrees: 360 -> 0, -1 -> 359). */
  wrap?: number;
}) {
  const [draft, setDraft] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(format(value));
  }, [value, format]);

  return (
    <label className="number-field">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={label}
        value={draft}
        disabled={disabled}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          let n = Number(e.target.value);
          if (e.target.value.trim() === '' || !Number.isFinite(n)) return;
          if (wrap) {
            const wrapped = ((Math.round(n) % wrap) + wrap) % wrap;
            if (wrapped !== n) setDraft(String(wrapped));
            n = wrapped;
          }
          onChange(n);
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(format(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span aria-hidden="true">{suffix}</span>
    </label>
  );
}

const formatDegrees = (v: number) => String(normalizeRotation(v));
