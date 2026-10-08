import type { ReactNode, SVGProps } from 'react';

/** 16px line icons for the ticket designer (stroke follows the text color). */
function Icon({ children, ...rest }: { children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const QrIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
  </Icon>
);

export const BarcodeIcon = () => (
  <Icon>
    <path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14" />
  </Icon>
);

export const PhoneIcon = () => (
  <Icon>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M11 18h2" />
  </Icon>
);

export const PrinterIcon = () => (
  <Icon>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M6 14h12v7H6z" />
  </Icon>
);

/** Magnifying glass, a bit larger and bolder so the icon-only Search button reads clearly. */
export const SearchIcon = () => (
  <Icon width="18" height="18" strokeWidth="2.25">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Icon>
);

/** Eye: "view as the public sees it". */
export const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

/** Pencil: "edit / manage this". */
export const EditIcon = () => (
  <Icon>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);

/** Grid lines: "show grid". */
export const GridLinesIcon = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </Icon>
);

/** Magnet: "snap to grid". */
export const MagnetIcon = () => (
  <Icon>
    <path d="M6 3v8a6 6 0 0 0 12 0V3" />
    <path d="M6 3h4v8a2 2 0 0 0 4 0V3h4" />
    <path d="M6 7h4M14 7h4" />
  </Icon>
);

export const BoldIcon = () => (
  <Icon strokeWidth="2.25">
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </Icon>
);

export const AlignLeftIcon = () => (
  <Icon>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </Icon>
);

export const AlignCenterIcon = () => (
  <Icon>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
  </Icon>
);

export const AlignRightIcon = () => (
  <Icon>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M5 12h14M12 5v14" />
  </Icon>
);

export const RotateLeftIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </Icon>
);

export const RotateRightIcon = () => (
  <Icon style={{ transform: 'scaleX(-1)' }}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </Icon>
);

/** Triangle with "!": "warning". */
export const WarningIcon = () => (
  <Icon>
    <path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

/** Two overlapping sheets: "copy". */
/** Two stacked pages with a plus: "duplicate". */
export const DuplicateIcon = () => (
  <Icon>
    <rect x="3" y="7" width="12" height="14" rx="2" />
    <path d="M9 3h10a2 2 0 0 1 2 2v10" />
    <path d="M9 11v6M6 14h6" />
  </Icon>
);

/** A clipboard: "paste". */
export const PasteIcon = () => (
  <Icon>
    <rect x="5" y="5" width="14" height="16" rx="2" />
    <path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 12h6M9 16h6" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Icon>
);

/** Three dots: "more options". */
export const MoreIcon = () => (
  <Icon>
    <circle cx="5" cy="12" r="1.25" fill="currentColor" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    <circle cx="19" cy="12" r="1.25" fill="currentColor" />
  </Icon>
);

/** Stacked layers with an arrow up: "bring to front". */
export const BringFrontIcon = () => (
  <Icon>
    <rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.3" />
    <path d="M4 16V5a1 1 0 0 1 1-1h11" />
  </Icon>
);

/** Stacked layers, the bottom one filled: "send to back". */
export const SendBackIcon = () => (
  <Icon>
    <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.3" />
    <path d="M20 8v11a1 1 0 0 1-1 1H8" />
  </Icon>
);

/** Closed padlock: "locked". */
export const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

/** Open padlock: "unlocked". */
export const UnlockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </Icon>
);

/** Hooked arrow back: "undo". */
export const UndoIcon = () => (
  <Icon>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

/** Hooked arrow forward: "redo". */
export const RedoIcon = () => (
  <Icon>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);

/** Two circling arrows - the usual "reset / start over" icon (distinct from single-arrow rotate). */
export const ResetIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Icon>
);

/** A page with a folded corner: "ticket size and color". */
export const TicketSizeIcon = () => (
  <Icon>
    <path d="M6 3h8l5 5v13H6z" fill="currentColor" fillOpacity="0.15" />
    <path d="M14 3v5h5" />
    <path d="M9 13h7M9 17h7" />
  </Icon>
);

/** Picture frame: "background image". */
export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.75" />
    <path d="M21 16l-5-5-9 9" />
  </Icon>
);

/** Double arrow left-right between bars: "set the width". */
export const WidthIcon = () => (
  <Icon>
    <path d="M3 5v14M21 5v14" />
    <path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" />
  </Icon>
);

/** Double arrow up-down between bars: "set the height". */
export const HeightIcon = () => (
  <Icon>
    <path d="M5 3h14M5 21h14" />
    <path d="M12 7v10M12 7l-3 3M12 7l3 3M12 17l-3-3M12 17l3-3" />
  </Icon>
);

/** Scan-frame corners around a small square: "fit the code into the blank area". */
export const AutoFitIcon = () => (
  <Icon>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </Icon>
);

/** A ruler: "real size". */
export const RulerIcon = () => (
  <Icon>
    <rect x="2" y="7" width="20" height="10" rx="1.5" />
    <path d="M6 7v3M10 7v4M14 7v3M18 7v4" />
  </Icon>
);

/** Arrow down into a tray: "download / export". */
export const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Icon>
);

export const UploadIcon = () => (
  <Icon>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Icon>
);

export const LinkIcon = () => (
  <Icon>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const SaveIcon = () => (
  <Icon>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 3v5h8V3M7 21v-7h10v7" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M5 12l5 5 9-10" />
  </Icon>
);

export const SpinnerIcon = () => (
  <Icon className="icon-spin">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
);

/** A small down arrow: "more options". */
export const ChevronDownIcon = () => (
  <Icon>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

/** A ticket with side notches and a tear-off line: "the ticket design". */
export const TicketIcon = () => (
  <Icon>
    <path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5V7z" />
    <path d="M14.5 6.5v2M14.5 11v2M14.5 15.5v2" />
  </Icon>
);

/** Two bars: "pause". */
export const PauseIcon = () => (
  <Icon>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Icon>
);

/** A triangle: "play / resume". */
export const PlayIcon = () => (
  <Icon>
    <path d="M7 5l12 7-12 7V5z" />
  </Icon>
);

/** Six dots in two columns: "drag to reorder". */
export const GripIcon = () => (
  <Icon>
    <circle cx="9" cy="6" r="1.4" />
    <circle cx="15" cy="6" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="18" r="1.4" />
    <circle cx="15" cy="18" r="1.4" />
  </Icon>
);
