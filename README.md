# Event Ticketing — Frontend

React + TypeScript (Vite) client for the
[event-ticketing-api](../event-ticketing-api) Spring Boot backend.

## Features

**Buyers**
- Browse/search published events (keyword, category, pagination)
- Event detail with ticket types, sale windows, availability
- Cart: add general-admission tickets, remove items, apply/remove promo codes
- Checkout (with `Idempotency-Key`) against the API's mock payment gateway
- Order history, order detail, view/print ticket artifacts, transfer tickets
- Register, log in/out, edit profile, change password

**Organizers** (owner/organizer of an organization, or admin)
- List managed events, filter by status
- Create draft events (with org venues), edit details, publish, cancel, delete
- Add ticket types, view an event's orders

Not yet covered: reserved-seat selection, waitlists, resale, refunds,
promo-code management, check-in/scanner, admin screens.

## Running

Requires **Node.js 18+** (`winget install OpenJS.NodeJS.LTS`).

1. Start the API (from `../event-ticketing-api`):
   ```bash
   docker compose up -d
   ./mvnw spring-boot:run
   ```
   Optionally load dev seed data (see `src/main/resources/db/seed/dev-seed.sql`)
   — all seed users share the password `Password123!`, e.g.
   `jordan.rivera@example.com` (buyer) and `morgan.lee@example.com` (organizer).
2. Start the frontend:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:5173

## How it talks to the API

- The API has no CORS configuration, so the Vite dev server proxies `/api/*`
  to `http://localhost:8081` (override with `VITE_API_TARGET` in `.env`).
  A production build must be served behind the same origin as the API or
  the API needs CORS enabled.
- Auth: access + refresh JWTs from `/auth/login` are kept in `localStorage`.
  On a `401` the client calls `/auth/refresh` once and retries; if that
  fails the user is logged out.
- The API has no "current cart" endpoint, so the cart id is remembered in
  `localStorage` per user.
- Money is in minor units (cents) on the wire; the UI converts.
- Mock payments: any payment token succeeds, tokens starting with
  `tok_fail` are declined.

## Structure

```
src/
  api/          fetch client (auth + refresh), typed endpoints, DTO types
  auth/         AuthContext (login/register/logout/current user)
  cart/         CartContext (cart id persistence, add/remove/promo/checkout)
  components/   Layout, RequireAuth, small UI primitives
  pages/        buyer pages; pages/organizer/ for event management
  utils/        formatting, useAsync hook
```
