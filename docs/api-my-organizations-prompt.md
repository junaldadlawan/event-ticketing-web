Add `GET /api/v1/organizations/mine` so the web app can find the caller's organizations on its own. Today `GET /organizations` is admin only and `GET /organizations/{id}` needs an id, so the New event page cannot tell an organizer which organization to create the event for (it used to ask them to type a UUID). The page currently falls back to guessing from `GET /events/managed`, which only finds organizations that already have an event, so a brand-new organizer with an approved organization and no events gets "You don't have an organization yet".

## Endpoint
- `GET /api/v1/organizations/mine` (any authenticated user; add it to `SecurityConfig` before the `/api/v1/organizations/{id}` handling if a matcher needs ordering): the APPROVED organizations where the caller is an OWNER or ORGANIZER, as `OrganizationResponse[]`, oldest first. An empty list (not 404) when there are none. Reuse `OrganizationAccessGuard.managedOrganizationIds(userId)` and filter by `OrganizationStatus.APPROVED` and not deleted. It must sit above the `/{orgId}` mapping in `OrganizationController` so "mine" is not parsed as a UUID.
- A platform ADMIN who is not a member gets only the organizations they belong to (the web app uses `GET /organizations?status=APPROVED` for admins).

## Housekeeping
- `openapi.yaml` (new path under Organizations), docs (the organization / event-creation use case), tests: owner sees theirs; organizer sees theirs; a CHECK_IN_STAFF-only member gets an empty list; PENDING / REJECTED / SUSPENDED organizations are excluded; unauthenticated is 401.

## What the web app does
`/manage/new` calls this endpoint (falling back to the events workaround if it fails): one organization is used automatically ("Hosting as <name>"), several show a name dropdown, none shows a link to apply.
