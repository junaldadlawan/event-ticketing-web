Admins must not change ticket types. Today every ticket-type write allows the platform ADMIN as well as the event's owner / organizer (`TicketTypeServiceImpl.requireOwnerOrOrganizerOrAdmin`: "BR-AUTH-004 admin bypass"). Change it so that only an OWNER or ORGANIZER of the event's own organization may add, edit, pause / resume, reorder or delete a ticket type. An admin keeps read access (listing ticket types, viewing them, orders, analytics) but gets 403 on these writes unless that admin is also a member (owner / organizer) of the event's organization. The web app already hides these controls for admins; this makes the API enforce the same rule.

## Endpoints that become organizer-only (no admin bypass)
- `POST /api/v1/events/{eventId}/ticket-types` (create)
- `PATCH /api/v1/ticket-types/{ticketTypeId}` (edit, including the `salesPaused` flag)
- `PUT /api/v1/ticket-types/{ticketTypeId}/sales-status` (pause / resume sales)
- `PUT /api/v1/events/{eventId}/ticket-types/order` (reorder)
- `DELETE /api/v1/ticket-types/{ticketTypeId}` (delete)

## How
- In `TicketTypeServiceImpl`, replace `requireOwnerOrOrganizerOrAdmin` by an organizer-only check: `OrganizationAccessGuard.hasRole(callerId, event.getOrganizationId(), OWNER)` or `... ORGANIZER`; remove the `accessGuard.isAdmin()` early return for these five operations. The organization still always comes from the ticket type's / event's own record, never from client input.
- 403 message: "Only the organization's owner or organizer may change this event's ticket types".
- Reads stay as they are: `GET /events/{id}/ticket-types` (a DRAFT event's list is still visible to its organizers and to admins) and `GET /ticket-types/{id}`.
- Audit: on refusal, keep the existing FAILURE / forbidden logging if there is one; nothing new on success.

## Housekeeping
- `openapi.yaml`: update the descriptions and 403 responses of the five operations ("owning organizer only").
- Docs: update BR-AUTH-004 (admin bypass no longer applies to ticket types) and the related use cases (UC-TICKETTYPE-*).
- Tests: for each of the five operations - an admin who is not a member of the organization gets 403 and nothing changes; an admin who is also an owner / organizer of that organization still succeeds; owner and organizer succeed as before; a member with another role (e.g. staff) gets 403. Update existing tests that rely on the admin bypass.

## What the web app does
For an admin who is not an owner / organizer of the event's organization, the manage page shows the ticket types read-only: no "Add ticket type", no edit pencil, no pause / resume, no drag handle, and no Duplicate / Delete in the More menu.
