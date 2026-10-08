Let organizers edit, pause/resume and delete promo codes. Today the API only has `GET` and `POST /api/v1/events/{eventId}/promo-codes` (`EventPromoCodeController`, `PromoCodeService`); a promo code can never be changed or switched off once created. Follow the ticket-type work as the template: `PUT /api/v1/ticket-types/{id}/sales-status` (`SalesStatus`, `setSalesPaused`, flag column `sales_paused` in V28), `DELETE` with a 409 when it already has sales, `BusinessAuditLogger`, `OrganizationAccessGuard` (owner / organizer of the event's organization, or admin; the organization always comes from the promo code's own event, never from client input). Add the migration (V29+), entity, DTOs, service, controller, `openapi.yaml`, and tests (service, controller, and a checkout case).

## 1. Data
- `promo_codes.paused BOOLEAN NOT NULL DEFAULT FALSE`; `PromoCode.paused` (default false), exposed as `paused` in `PromoCodeResponse` (and `PromoCode` in `openapi.yaml`).
- `PromoCodeResponse.usedCount` (integer): how many orders used the code (count non-cancelled orders whose `promo_code` equals the code for that event; reuse the queries `PromoCodeUsageLimitGuard` already runs). The web app shows "3 / 100 used" and decides what may be edited / deleted from it.

## 2. Endpoints (all under the promo code's own id, like ticket types)
- `PATCH /api/v1/promo-codes/{promoCodeId}` - body `PromoCodeUpdateRequest`, every field optional, null = unchanged: `code`, `discountType`, `discountValue`, `applicableTicketTypeIds`, `usageLimitTotal`, `usageLimitPerBuyer`, `validFrom`, `validUntil`. Same validation as create (`@NoHtml`, max 50, `validUntil` after `validFrom` checked on the merged values, `discountValue` >= 0 and <= 100 for PERCENTAGE, ticket types must belong to the same event). To clear a limit send 0 (0 = no limit); to apply to every ticket type send `[]`. Returns the updated `PromoCodeResponse`.
  - Duplicate `code` within the event (unique `(event_id, code)`) -> 409 with a readable message, not a 500.
  - Once `usedCount > 0` the `code` and `discountType` can no longer change (409 "This code has already been used; pause it and create a new one instead"); the other fields may still change. A new `usageLimitTotal` below `usedCount` -> 400.
- `PUT /api/v1/promo-codes/{promoCodeId}/status` - body `{ "status": "ACTIVE" | "PAUSED" }` (reuse or mirror `SalesStatus` / `TicketTypeSalesStatusRequest`). Asking for the state it is already in is not an error and writes nothing. Allowed whatever the event's status. Returns `PromoCodeResponse`.
- `DELETE /api/v1/promo-codes/{promoCodeId}` -> 204, soft delete (`markDeleted()`). 409 "This code has already been used, so it can't be deleted. Pause it instead." when `usedCount > 0`. Carts that still hold a deleted code simply lose it (see 3).
- Existing `GET` list: include paused ones (the organizer sees everything except soft-deleted); add `paused` and `usedCount` to each item.

## 3. Behaviour at the cart and checkout
- `CartServiceImpl.applyPromoCode`: a paused code is rejected like an invalid one (422, "Promo code is invalid or inapplicable to this cart"; do not reveal that it exists but is paused).
- `CheckoutServiceImpl.doCheckout` (the re-check that runs right before charging, next to `promoCodeUsageLimitGuard`): reject a cart whose applied code has been paused or deleted since it was applied, with the same 422 and no charge. Resuming the code makes it usable again, and tickets / orders that already used it are untouched.
- `CartServiceImpl` cart view: if the applied code is paused or deleted, return the cart without a discount (do not throw).

## 4. Housekeeping
- `SecurityConfig`: the three new routes need an authenticated user (no new public routes); keep CORS as is.
- `BusinessAuditLogger.record("promo_code.updated" | "promo_code.paused" | "promo_code.resumed" | "promo_code.deleted", "PromoCode", id, Outcome.SUCCESS)`.
- Update `openapi.yaml`, `docs/` business rules / use cases (BR-PROMO-*), and run `mvnw.cmd test`.

## 5. What the web app will do once this exists
The organizer's promo code screen lists each code as a readable row (code, discount, ticket types, validity window, usage, status chip Active / Paused / Expired / Scheduled) with Edit, Pause / Resume and Delete (delete is hidden or disabled when `usedCount > 0`, with "pause it instead"). It calls `PATCH /promo-codes/{id}`, `PUT /promo-codes/{id}/status` and `DELETE /promo-codes/{id}`, and reads `paused` / `usedCount` from the list.
