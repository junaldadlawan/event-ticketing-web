Extend ticket templates so they store and render everything the web app's ticket designer saves. Today the API keeps only `codeType` (QR | BARCODE), `codeX`, `codeY`, `codeWidth`, `codeRotation` (latest migration V26); every field below is currently dropped. Add them to the entity, Flyway migration (V27+), `TicketTemplateCreateRequest`, `TicketTemplateUpdateRequest` (PATCH: null = unchanged) and `TicketTemplateResponse`, validate them, and use them in `PngTicketRenderer` / `PdfTicketRenderer`. All new request fields are optional so older clients keep working.

## 1. Ticket canvas
- `ticketWidth`, `ticketHeight`: integers 100–5000 (px). The ticket's real size; it does NOT have to match the background image. Absent = current default (900 × 380).
- `backgroundColor`: "#RRGGBB" fill under everything; on update "" clears it (white).
- `backgroundImageUrl`: already exists - keep; on update "" clears it.
- `backgroundFit`: COVER (default) | CONTAIN | STRETCH | CUSTOM.
- `backgroundX`, `backgroundY`, `backgroundWidth`, `backgroundHeight`: doubles, % of the ticket's width / height. Required when `backgroundFit` = CUSTOM, must be null otherwise. x/y may be negative and width/height may exceed 100 (up to 500) - the image may extend past the edges and is clipped.

## 2. Code
- `codeType` gains NONE = no code printed (codeX/Y/Width/Rotation null and skipped by validation). Existing QR / BARCODE rules unchanged.

## 3. Text fields
`textFields`: ordered list (max 30), stored as an element collection (`ticket_template_text_fields`: template_id, sort_order, ...; mirror `Organization.documents` - `@ElementCollection` + `@OrderColumn`). PATCH: null = unchanged, [] = none. Each item:

| field | rules |
|---|---|
| `key` | TICKET_TYPE, SECTION, ROW, SEAT, TICKET_NUMBER, ATTENDEE_NAME (dynamic); EVENT_NAME, EVENT_DATE, EVENT_TIME, VENUE (static); CUSTOM |
| `x`, `y` | 0–100 (% of width / height). x = anchor: left edge (LEFT), centre (CENTER), right edge (RIGHT). y = vertical centre of the whole text block |
| `fontSize` | 2–25, % of the ticket height |
| `color` | "#RRGGBB" |
| `bold` | boolean |
| `align` | LEFT, CENTER, RIGHT |
| `rotation` | integer 0–359, optional (default 0) |
| `sampleLength` | 1–30; dynamic keys only |
| `sampleText` | 1–30 chars, single line, trimmed, `@NoHtml`; dynamic keys only, optional |
| `text` | 1–60 chars, single line, trimmed, `@NoHtml`; required for CUSTOM, null otherwise |
| `lineBreaks` | ascending unique integers > 0, max 10; static keys and CUSTOM only (reject on dynamic keys); for CUSTOM each < `text.length` |

- Every key except CUSTOM appears at most once; CUSTOM up to 10 times.

## 4. Rendering (PNG and PDF must match)
1. Canvas `ticketWidth × ticketHeight` (or default), filled with `backgroundColor` or white.
2. Background image, if any (only our own `/api/v1/uploads/files/` images; keep timeouts / size limits), clipped to the ticket:
   - COVER: scale to fill, centre-crop. CONTAIN: scale to fit, centred, fill colour shows around it. STRETCH: exactly the ticket size. CUSTOM: at (x% × W, y% × H), size (width% × W, height% × H).
3. Text fields, in list order (later ones on top). Font SansSerif, size `fontSize% × H`, bold if set, line height 1.15 × font size.
   - Value printed:
     - TICKET_TYPE = ticket type name.
     - SECTION = seat.section, or "GA" for general admission.
     - ROW / SEAT = seat.row / seat.seatNumber, or "—".
     - TICKET_NUMBER = ticket.ticketNumber.
     - ATTENDEE_NAME = the current owner's name (follows transfers).
     - EVENT_NAME = event title.
     - EVENT_DATE = event start in the event's time zone, `EEE, MMM d, yyyy`, `Locale.US`.
     - EVENT_TIME = same time zone, `h:mm a`, `Locale.US`.
     - VENUE = venue name, or nothing.
     - CUSTOM = `text`.
   - Static / CUSTOM: split the value at `lineBreaks` (positions past its length ignored), trim each line; each line aligned at the anchor x by `align`; y is the vertical centre of the block.
   - Dynamic: the field's box is RESERVED space - as wide as `sampleText` in the field's font if present, else `sampleLength` "X" characters. The value fills that box from its left edge (LEFT), middle (CENTER) or right edge (RIGHT); a longer value keeps growing in that direction (never truncate). One line.
   - Rotation: turn the whole block clockwise around the centre of its box (widest line × all lines; for dynamic fields the reserved box), after placing it by its anchor.
4. The code last (always on top of text), unless NONE - existing placement / rotation logic.
- If none of the new fields are set, keep today's default layout.

## 5. Tests
- Validation: duplicate non-CUSTOM key, too many CUSTOM, CUSTOM without text, text / sampleText too long, lineBreaks on a dynamic key, out-of-range sizes / percents, bad hex, CUSTOM background without its rect, rect set for a non-CUSTOM fit, codeType NONE with placement fields.
- Values: seated, general admission (GA / — / —), transferred ticket (attendee = new owner), event date / time in the event's time zone.
- Rendering: each background fit; an image partly off the ticket; line breaks; dynamic fill directions with a value longer than its box; rotation; text order; code drawn last; NONE draws no code.
- Create / update / PATCH round-trip returns every new field.

Also: permit `/error` in `SecurityConfig` (or let the JWT filter run on ERROR dispatches) so real 404 / 500 responses aren't reported as 401 "Authentication required".
