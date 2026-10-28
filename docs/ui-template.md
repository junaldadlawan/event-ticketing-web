# UI template

How every page in this app should look. Follow this when you add or change a screen, so the whole app stays uniform.

The style in one line: **a marketplace look: photos first, violet actions on white cards over a light grey page, big rounded corners, one typeface, status colors only when they mean something.** The loud elements are the picture hero (Home) and the ticket slab (a deep violet block shaped like a ticket).

All styles live in `src/index.css`. Shared building blocks live in `src/components/ui.tsx`.

---

## 1. Principles

1. **One brand color.** Violet: primary `#6D28D9` for buttons and main actions, secondary `#8B5CF6` for highlights and interactive states (focus), accent `#C4B5FD` for subtle highlights. Everything else is white, greys and dark text. Green, amber and red are only for status: success, warning, danger.
2. **One typeface.** Archivo (loaded in `index.html`). Titles use its narrowest width, heavy weight; body text uses its normal width.
3. **One loud thing per page at most.** That is a picture hero or the slab. Everything else stays quiet: hairlines, plain buttons, white surfaces. Photos carry the page (events, heroes); the interface around them stays calm.
4. **Structure means something.** A border, divider or number is there because it says something about the content, not as decoration.
5. **Little decoration.** No all-caps labels, emoji or illustrations. A gradient is allowed only to make text readable over a picture (the Home and Contact heroes), and a glow only on the Share button. Everything else is flat.

---

## 2. Tokens

Always use the CSS variables. Never hard-code a hex value in a component or a new CSS rule. Dark mode swaps every token automatically.

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--page` | `#f9fafb` | `#0e0a1a` | Page background |
| `--bg` / `--surface` | `#ffffff` | `#17122a` | Cards, panels, inputs |
| `--subtle` | `#f3effe` | `#221b3d` | Quiet fills (chips, hover, table stripes), a pale tint of the accent |
| `--text` | `#111827` | `#f3f4f6` | Headings, body text, icons |
| `--muted` | `#4b5563` | `#a1a1b5` | Secondary text, hints, ledes |
| `--border` | `#e5e7eb` | `#2f2750` | Hairlines and outlines |
| `--accent` / `--cta` | `#6d28d9` (primary) | `#a78bfa` | The filled primary button |
| `--on-accent` | `#ffffff` | `#1e1b4b` | Text on a filled primary button |
| `--cta-hover` | `#5b21b6` | `#c4b5fd` | Primary button on hover |
| `--cta-text` | `#6d28d9` | `#c4b5fd` | Outline button text, selected text |
| `--secondary` | `#8b5cf6` | `#8b5cf6` | Highlights and interactive states (focus ring, hover borders) |
| `--highlight` | `#c4b5fd` | `#c4b5fd` | Subtle highlights (accent) |
| `--slab` | `#2e1065` | `#2e1065` | Ticket slab background |
| `--on-slab` | `#ffffff` | `#ffffff` | Text on the slab |
| `--slab-muted` | `#c4b5fd` | `#c4b5fd` | Secondary text on the slab |
| `--success` / `--success-bg` | green | green | Paid, live, on sale, done |
| `--warn` | amber | amber | Paused, needs attention |
| `--danger` / `--error-bg` | red | red | Errors, delete, failed, refunded |

**Radius: a small scale, from the corners of the Log in window.**
| Where | Radius |
|---|---|
| `--radius` (4px) / `--radius-lg` (10px) | Small tiles, flat sections, the slab |
| Inputs, selects, textareas, `.btn` | 12px |
| Cards of the event page (ticket option, share choice) | 14px |
| Menus (`.account-popup`), booking card, event photo | 16–20px |
| Dialogs (`.modal`, including the Log in window) | 28px |
| `999px` | Pills: search bar, category pills, role pill, Share button, status dots and badges |
| `50%` | Avatars and the round account button |

**Shadows:** none on flat cards. Floating layers (dialogs, menus, the sticky tickets card, the search bar) get a soft shadow. The Share button has a violet glow.

**Size of fields in dialogs and forms:** 14px padding, 1rem text, a darker outline, and a thin secondary-violet ring on focus. The main button of a dialog is full width, 52px tall, with 24px above it.

---

## 3. Typography

| Element | Style |
|---|---|
| `h1` | Archivo 800, `font-stretch: 62%`, `clamp(2rem, …, 2.75rem)`, line-height 1. Set globally; the event pages (`.event-head h1`) size it a little differently. |
| Slab headline | Same face, larger: `clamp(2.5rem, …, 4.75rem)` (Events), up to `6.25rem` on Home. |
| `h2` | 1.05rem, weight 600, normal width. Section titles inside a page. |
| `h3` | 1rem, weight 600. |
| Body | 15px, line-height 1.6. |
| `.muted`, `.small` | Secondary text and smaller text. |

Rules:
- Use sentence case everywhere ("Download statement", not "Download Statement").
- No all-caps labels and no extra letter-spacing.
- Don't highlight one word of a headline with a different color, italics or a gradient.
- For big numbers (prices, countdowns, stats), reuse the title style: weight 800 at `font-stretch: 62%`.

---

## 4. Page template

Every standard page starts with `PageHeader`. Don't write a bare `<h1>` or the old `row-between page-header` div.

```tsx
import { PageHeader } from '../components/ui';

<PageHeader
  title="Finance & Payouts"
  lede="What each organization has earned, the platform fee, and what was paid out."
  actions={
    <Link to="/admin/payouts/generate" className="btn btn-primary">
      Generate payout
    </Link>
  }
/>
```

| Prop | Required | Notes |
|---|---|---|
| `title` | yes | Short, plain noun: "Users", "Team", "My orders". |
| `lede` | no | One sentence on what the page is for, or a small control such as the organization `<select>`. |
| `actions` | no | The page's main action, at most two buttons. One of them may be filled. |

It renders the title and lede on the left, the actions on the right (they wrap underneath on phones), and a hairline under the whole header.

Typical page shape:

```
PageHeader              title · lede · actions
───────────────────────────────────────────────
ErrorBox / SuccessBox   only when there's a message
toolbar                 search, filters (.admin-toolbar or .search)
content                 table, list, cards, form
Pagination              when the data is paged
```

```tsx
export function ExamplePage() {
  const { data, error, loading } = useAsync(() => api.list(), []);
  return (
    <>
      <PageHeader title="Example" lede="What this page is for." />
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>Nothing here yet. <Link to="/events">Find an event</Link></Empty>
      ) : (
        data && <>{/* content */}</>
      )}
    </>
  );
}
```

Narrow forms (apply, settings forms) go inside `<div className="narrow">` and still start with `PageHeader`.

---

## 5. The ticket slab (hero)

The slab is a loud element. Use it **only** for a page's hero moment. It's in use today on:

- Log-in / sign-up: the left panel
- Order page: "You're going to …" with the countdown
- The Contact page hero (the slab colour, with a soft violet glow, no stub)

Home no longer uses a slab: its hero is a picture (see section 6, Page shells). The event pages show the event's photo; an event without one gets a plain slab-coloured block with its category.

Don't add the slab to admin or management pages; those use `PageHeader`.

```tsx
{/* Plain slab */}
<section className="slab events-hero">
  <h1>Find your next event</h1>
  <p>…</p>
</section>

{/* Slab with a tear-off stub: add `has-stub` and a `.slab-stub` child */}
<section className="slab home-hero has-stub">
  <div className="home-hero-copy">…</div>
  <Link to="…" className="slab-stub">…</Link>
</section>
```

- `has-stub` cuts the two notches and draws the dashed perforation. On phones the stub drops below the main part with a horizontal perforation.
- Text on the slab uses `--on-slab`, and secondary text uses `--slab-muted`.
- A button on the slab uses `btn btn-invert`.
- Give the slab its own padding through a page class (`.events-hero`, `.home-hero-copy`), about `40px` on desktop and `28px 24px` on phones.

---

## 6. Components and classes

### Buttons
| Class | When |
|---|---|
| `btn` | Default outline button. |
| `btn btn-primary` | The main action of a page or form (filled violet). One per screen. |
| `btn btn-cta` | Same look as primary, used for header and nav calls to action (Sign up, Buy now, Share). Text on it is `--on-accent`. |
| `btn btn-lg` | A bigger button (hero buttons, Browse all events). |
| `btn btn-outline-cta` | Secondary action that should stand out ("View public page"). |
| `btn btn-link` | Text-only action. |
| `btn btn-sm` | Compact button in tables and rows. |
| `btn btn-danger` / `btn-link danger` | Destructive actions. |
| `btn btn-invert` | A button on the slab. |

Button labels say exactly what happens: "Save changes", "Generate payout", not "Submit" or "OK".

### Feedback (`src/components/ui.tsx`)
| Component | Use |
|---|---|
| `<Spinner />` | First load. |
| `<ErrorBox message={…} />` | API errors. Renders nothing when the message is empty. |
| `<SuccessBox message={…} />` | Confirmation after an action. |
| `<Empty>…</Empty>` | Empty states. Say what to do next and link to it. |
| `<StatusBadge status="PAID" />` | API status values (`badge badge-<status>`). |
| `<Pagination page={…} onChange={…} />` | Paged lists. |

### Shared form and layout components
Use these instead of writing a bare `<label><input/></label>`, a Cancel / Save row or a segmented control by hand.

| Component | Use |
|---|---|
| `<Field label hint optional required error>` (`components/fields/Field`) | One label, one control, a hint and an error. Required shows the red asterisk, optional shows "(optional)". `<FieldGroup legend hint>` is the fieldset for several controls. |
| `<TextField>`, `<TextAreaField>`, `<SelectField>`, `<DateField>` (`fields/TextField`) | A text, number, email, tel, url, password or datetime box, a textarea, a dropdown and a date box, each inside a `Field`. They take the native props. |
| `<DateTimeField>`, `<HourMinuteField>` (`fields/DateTimeFields`) | A date plus a 12-hour time on one line (event and sale start / end); hours and minutes that may both stay empty (gates open). `TimeField` and `StepSelect` stay the single time pickers. |
| `<QuantityField value onCommit min max>` (`fields/QuantityField`) | A whole number set with − / + or typed (cart, event page). `onBelowMin` turns − at the lowest number into an action such as "remove". |
| `<CheckRow>` (`fields/CheckRow`) | A checkbox with its text. |
| `<DocumentRows docs onChange>` (`fields/DocumentRows`) | Verification document rows: type, link, Add, Change, Remove. |
| `<Button variant size busy busyLabel>` (`components/Button`) | The one button: primary, secondary, cta, danger, link. `busy` turns it off and shows `busyLabel`. |
| `<IconButton label>` | A round icon-only button; the label is its tooltip and accessible name. |
| `<FormActions submitLabel busyLabel onCancel>` | Cancel and the main button at the bottom of a form window, with an optional extra at the start. |
| `<Segmented options value onChange label>` (`components/Segmented`) | Filter and layout toggles, with optional counts. |
| `<SettingsLayout label links>`, `<SettingRow>` (`components/SettingsLayout`) | The page list on the left and the chosen page on the right; one line of a settings list. |
| `<SearchBar onSearch>` (`components/SearchBar`) | The pill search, Airbnb style: each section (keyword, category) is one big click target that turns grey on hover, with a round violet search button. Home sends it to `/events?keyword=…&category=…`. |
| `<CategoryChips active onPick>` (`components/CategoryChips`) | The kinds of event as pills; links into Events on Home, toggling buttons on the Events page. Sits in a `.find-bar` under the search so both stay in view. |
| `<Section title to>` (`components/Section`) | A page section: heading, optional "See all" link, content. |
| `<ListingCard event from left>` (`components/ListingCard`) | A photo-first event card with a "Happening now" / "Starts in…" badge, when, where and the lowest price. Put them in a `.listing-row` grid. |

### Page shells and navigation
| Piece | Notes |
|---|---|
| Header (`Layout`, `.topbar-market`) | One header for everyone: the `eventKo` logo at the far left, the tabs centred (customers: Events, Posts, Contact us), the account items at the far right. Customers also get the bell, theme toggle and cart. |
| Role pill (`.view-badge`) | A violet pill beside the logo ("Admin view", "Organization Owner view") shown only while someone works in their management view. Nothing for customers. |
| `<AccountMenu>` (`components/AccountMenu`) | The round profile picture (a person icon when logged out) opens a menu: for hosts and admins a **Role** section (Customer / their position) with a check on the current one, then Profile, Settings, and in the customer view Orders, My tickets, Payment methods, Host an event, Contact us; Log out last (it still asks to confirm). There is no separate Log out button and no hamburger. |
| Sidebar (`.sidebar`, `.app-shell`) | In the management view the tabs (Events, Team & access, Finance, Check-in, Settings, and the admin ones) are a menu on the left, sticky under the header. Under 900px it becomes a scrolling row of tabs. The customer view has no sidebar. |
| Home hero (`.home-cover`) | A concert-crowd picture over the first screen that drifts slowly (switched off for reduced motion), the pitch on the left, the `SearchBar` and category pills on the right, vertically centred. |
| Event page (`.event-page`, `.event-cols`) | Title and a line with category, venue and status; one wide rounded photo; the key facts and "About this event" on the left; a sticky tickets card on the right (`.booking-card`) with one block per ticket type. The management event page uses the same layout, with a "Manage this event" card of buttons instead of the tickets card. Both use the wide container (`container-wide`, 1120px for these pages). |
| Contact page (`/contact`) | Public: the approval message, how approval works (three real steps), the contact details from `src/config.ts`, and the organizer application form (a login button when logged out). |
| Share (`<ShareEvent>`, `utils/eventPoster`) | Shown on published, on-sale and sold-out events. Pressing the button is counted at once (`POST /events/{id}/share-clicks`, even if the window is closed without sharing), and the link and the poster's QR use the tracked short link `/s/{code}` (`GET /events/{id}/share-link`; the plain event address is the fallback). The `/s/:code` page (`ShareRedirectPage`, public) counts the open and redirects to the event. The organizer sees "Share button clicks" and "Shared link opens" under Sales insights. A button with an invitation beside it opens a window with two choices: copy the link (the link is shown as text, and a message confirms the copy) or generate a QR poster. The poster is 720×1120 (phone shaped), has the event photo, details, QR and a footer with the socials and website, takes its colours from the photo's main colour, and is saved as a JPEG kept under 50 KB. |
| Uploads | Every upload field holds **one** picture; a new one replaces the old. The folder says what it is for (`events`, `platform`, `tickets`, `users`) so the API can delete replaced files. |

Not yet moved onto these: the signup and profile forms (`BirthdateField`, `PhoneField` stay as they are), the ticket designer, the admin finance and payout filters, the My tickets filter group, and the `dl.setting-row` rows on the admin Settings page.

### Status colors
- `.badge` is a small dot plus a label. Use it for order, event and payout statuses.
- `.status-chip status-good | status-warn | status-bad | status-info` is a filled chip. Use it for live state on management pages.
- Never use these colors for decoration.

### Layout helpers
- `.container`: 880px max width (already applied by `Layout`). `.container-wide` is 1280px (Home, Events, the event pages).
- `.narrow`: narrow column for forms.
- `.row-between`: title on the left, action on the right, inside a section.
- `.stack`: a vertical list separated by hairlines.
- `.card`: flat section; on the manage event page it becomes a `--subtle` panel with a border and `--radius-lg`.
- `.modal`: every pop-up, through `<dialog className="modal">`: 28px corners, centred title, tall rounded fields, a full-width main button.

---

## 7. Writing

- Name things the way a user would: "Payment methods", not "PayMongo config".
- Use active voice and plain verbs. An action keeps its name through the flow: a "Publish" button leads to a "Published" message.
- An error says what happened and how to fix it. Don't apologize or stay vague.
- An empty state is an invitation: "No orders yet. Find an event".
- Write money with `formatMoney` and dates with `formatDateTime` (`src/utils/format.ts`), never by hand.

---

## 8. Checklist for a new page

- [ ] Starts with `<PageHeader>` (or a `.slab` hero, if it's a public landing page).
- [ ] No hex colors in components: tokens only (the picture heroes and the poster are the exceptions).
- [ ] Radius comes from the scale in section 2.
- [ ] At most one filled button per screen.
- [ ] Loading, error and empty states use `Spinner`, `ErrorBox` and `Empty`.
- [ ] Looks right in light **and** dark mode (toggle in the header).
- [ ] No horizontal scroll at 375px width.
- [ ] Keyboard focus is visible on every control.
- [ ] `npx tsc -b --noEmit` passes.

---

## 9. Exceptions

- **Ticket designer canvas** (`TicketDesignerPage`, `.designer-page`): the selection, grid and dynamic-field outlines use violet (`--sel-line`, `--grid-line`, `--dyn-line`) so they stay visible on any ticket design. Don't use these colors anywhere else.
- **Rendered tickets and QR codes** keep their own colors and white backgrounds: they are the organizer's design, not app chrome.
- **The "Completed" stamp** on ended events is deliberately uppercase: it imitates a rubber stamp.
- **Manage event page** uses the public event layout (title line, photo, facts, a card of actions) and the ticket designer has its own header: neither uses `PageHeader`.
- **Event posters** (`utils/eventPoster`) draw their own colours from the event's picture, with brand violet as the fallback.

---

## 10. Not yet checked

These were changed through shared CSS or code but not looked at on screen:

- The management pages inside the sidebar layout and the management event page (they need a logged-in owner, organizer or admin).
- Every older form and dialog field in its new size: the time fields, quantity stepper, document rows, segmented controls and settings layout.
- The new pages at phone width: the event page, the Contact page and the sidebar as a row of tabs.
- A QR poster scanned with a phone, and the poster for events with different picture colours.
