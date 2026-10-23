# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **ticket buyers**, people finding an event, buying tickets (often on a phone), and showing a QR code at the door. They also look up orders, transfer tickets to someone else, and read an event's posts and recap afterwards.

Supporting audiences, confirmed from the product's roles and screens:
- **Organization owners and organizers**: apply to host, then run events, ticket types, promo codes, team permissions, finance and payouts, and the door check-in; organizers get only the permissions the owner grants.
- **Check-in staff**: read-only view of their organization's events and the scanner app (APK) to scan tickets at the door.
- **Platform admins** (and a super admin): review organizer applications and detail changes, payouts, disputes, users, posts and platform settings.

## Product Purpose

An event ticketing platform where buyers find and buy tickets, organizations sell them, and staff admit people at the door, with admins keeping the platform trustworthy. Success is a buyer getting from an event to a ticket quickly, an organizer running an event without help, and a door team scanning people in correctly, online or offline.

## Positioning

Confirmed by the product owner as real differences:
- **Admin-approved organizers.** Hosting needs an application with verification documents, and later changes to an organization's details and documents go through admin approval.
- **A door scanner app that works offline.** An Android scanner with online and offline check-in, scan history, and the APK distributed to staff from within the app.
- **Philippine market focus.** Pesos, +63 phone numbers, PayMongo, local venues, Asia/Manila time by default.
- **Time-of-day events.** Events are shown as daytime or evening, with live "starts in" countdowns and a "happening now" view.

## Operating Context

- Buyers browse the public site, add tickets to a cart (tickets are held briefly), pay through PayMongo or the mock gateway, and receive tickets with QR codes; they can transfer a ticket to another member by that member's "My QR".
- Organizers work from a management view that they can switch off to browse as a customer.
- Door staff sign in to the Android scanner app, pick the published event, and scan tickets; offline scans are uploaded when the phone reconnects.
- Admins review applications, payouts and changes in an admin area, and platform settings (fees, ticket-sale timing, draft cleanup) live there too.
- Unpublished draft events are deleted automatically shortly before they start (an admin setting, default 60 minutes).

## Capabilities and Constraints

- **Stack (existing, not to be reconsidered):** React 18 + TypeScript + Vite single-page app, plain CSS in `src/index.css`, no UI library, talking to the `event-ticketing-api` Spring Boot backend; `netlify.toml` is present.
- **The frontend must not lie about the API:** screens show only what the API supports; missing capabilities are reported to the API session, not faked.
- Shared UI building blocks live in `src/components/` (`ui.tsx`, `fields/`, `Button.tsx`, `Segmented.tsx`, `SettingsLayout.tsx`); `docs/ui-template.md` is the written UI standard.
- Role and permission rules (owner, organizer permissions such as Events, Team, Finance, Scanner app; check-in staff; admin) are enforced by the API; the UI only chooses what to show.
- Undecided or not yet confirmed: production hosting, which payment provider is live at launch, the date of the real launch, and whether native mobile apps beyond the staff scanner are planned.

## Brand Commitments

- The product currently calls itself simply "events" (footer and tab titles); no formal brand name, logo or voice guide has been given.
- Interface copy is plain, sentence case, and says exactly what a button does ("Save changes", not "Submit").

## Evidence on Hand

- A demo seed of accounts for every role (super admin, admins, organization owners, an organizer, check-in staff, customers) and sample events, organizations and tickets, for development only.
- Real screens for every role in `src/`, and a written UI standard in `docs/ui-template.md`.
- No customer testimonials, case studies, press, pricing page, benchmarks or launch metrics exist. Future work must not invent them.

## Product Principles

1. **Buyers first.** The path from finding an event to holding a QR ticket is the product; everything else supports it.
2. **Trust is earned by review.** Organizers, their details and their money flow through admin approval; the interface says plainly what is waiting and what happened.
3. **The API is the truth.** The UI shows real state and real limits; it never hides a rule by hiding a button, and never presents something the API cannot do.
4. **The door must never block.** Check-in works offline, and staff and buyers always know whether a ticket is valid, used or wrong.
5. **Say what time it is.** Dates, durations, countdowns and "happening now" are first-class, in the event's own timezone.

## Accessibility & Inclusion

No product-specific standard has been set. The product is used on phones at doors and in daylight and dark, in Philippine English with local formats (pesos, +63).
