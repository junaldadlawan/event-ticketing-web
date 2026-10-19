# UI template

How every page in this app should look. Follow this when you add or change a screen, so the whole app stays uniform.

The style in one line: **black ink on white paper, one typeface, color only when it means something.** The one loud element is the ticket slab: an inverted block shaped like a ticket.

All styles live in `src/index.css`. Shared building blocks live in `src/components/ui.tsx`.

---

## 1. Principles

1. **Monochrome.** Black, white and greys. Color is only for status: success, warning, danger.
2. **One typeface.** Archivo (loaded in `index.html`). Titles use its narrowest width, heavy weight; body text uses its normal width.
3. **One loud thing per page at most.** That is the slab. Everything else stays quiet: hairlines, plain buttons, white surfaces.
4. **Structure means something.** A border, divider or number is there because it says something about the content, not as decoration.
5. **No decoration.** Don't use gradients, glows, colored shadows, illustrations, all-caps labels or emoji in the UI.

---

## 2. Tokens

Always use the CSS variables. Never hard-code a hex value in a component or a new CSS rule. Dark mode swaps every token automatically.

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--page` | `#f3f3f3` | `#000000` | Page background |
| `--bg` / `--surface` | `#ffffff` | `#141414` | Cards, panels, inputs |
| `--subtle` | `#ebebeb` | `#1f1f1f` | Quiet fills (chips, hover, table stripes) |
| `--text` | `#000000` | `#f5f5f5` | Body text, icons, strong borders |
| `--muted` | `#6b6b6b` | `#9a9a9a` | Secondary text, hints, ledes |
| `--border` | `#e0e0e0` | `#2b2b2b` | Hairlines and outlines |
| `--accent` / `--cta` | `#000000` | `#f5f5f5` | The filled primary button |
| `--on-accent` | `#ffffff` | `#000000` | Text on a filled primary button |
| `--slab` | `#000000` | `#f5f5f5` | Ticket slab background (inverts in dark) |
| `--on-slab` | `#ffffff` | `#000000` | Text on the slab |
| `--slab-muted` | `#a3a3a3` | `#5c5c5c` | Secondary text on the slab |
| `--success` / `--success-bg` | green | green | Paid, live, on sale, done |
| `--warn` | amber | amber | Paused, needs attention |
| `--danger` / `--error-bg` | red | red | Errors, delete, failed, refunded |

**Radius: two sizes only.**
- `--radius` (4px): buttons, inputs, chips, small tiles.
- `--radius-lg` (10px): cards, panels, modals, the slab.
- `999px` is only for pill badges, and `50%` only for avatars and dots.

**Shadows:** none on cards. Only floating layers (modals, menus, toasts) get a plain black shadow.

---

## 3. Typography

| Element | Style |
|---|---|
| `h1` | Archivo 800, `font-stretch: 62%`, `clamp(2rem, …, 2.75rem)`, line-height 1. Set globally; don't restyle it per page. |
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

The slab is the one loud element. Use it **only** for a page's hero moment. It's in use today on:

- Home: headline, plus the next event as the tear-off stub
- Events: headline and search
- Log-in / sign-up: the left panel
- Event page: the cover when the event has no picture
- Order page: "You're going to …" with the countdown

Don't add it to admin or management pages; those use `PageHeader`.

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
| `btn btn-primary` | The main action of a page or form (filled ink). One per screen. |
| `btn btn-cta` | Same look as primary, used for header and nav calls to action (Sign up, New event). |
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

### Status colors
- `.badge` is a small dot plus a label. Use it for order, event and payout statuses.
- `.status-chip status-good | status-warn | status-bad | status-info` is a filled chip. Use it for live state on management pages.
- Never use these colors for decoration.

### Layout helpers
- `.container`: 880px max width (already applied by `Layout`).
- `.narrow`: narrow column for forms.
- `.row-between`: title on the left, action on the right, inside a section.
- `.stack`: a vertical list separated by hairlines.
- `.card`: flat section; on the manage event page it becomes a `--subtle` panel with a border and `--radius-lg`.
- `.modal`: every pop-up, through `<dialog className="modal">`.

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
- [ ] No hex colors, gradients or colored shadows: tokens only.
- [ ] Radius is `var(--radius)` or `var(--radius-lg)`.
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
- **Manage event page and ticket designer** have their own header layout (title, status, edit button) and don't use `PageHeader`.
