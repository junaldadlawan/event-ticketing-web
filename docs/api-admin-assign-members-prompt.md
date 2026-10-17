Let a platform ADMIN assign roles to members of any organization. Today `OrganizationServiceImpl.assignMember` (`POST /api/v1/organizations/{orgId}/members`) only allows the organization's OWNER to assign a role to another user (a user may also self-assign if they already hold a role there), so an admin gets 403 "Only the organization's owner may assign roles to other users". The admin Organizations tab has a Members window (search by name / email or scan the person's My QR, pick Organizer or Check-in staff, Add) that depends on this.

## Change
- In `assignMember`, add the admin bypass for the "assign to another user" branch: `accessGuard.isAdmin()` OR the caller is the organization's OWNER. Keep every other rule:
  - `OWNER` can still not be granted through this endpoint (403 "The owner role cannot be granted through this endpoint"); the owner only comes from approving the application.
  - The organization must exist (404 for an unknown id). Decide whether a PENDING / REJECTED organization may get members (suggestion: allow ADMIN for APPROVED and SUSPENDED organizations, reject PENDING / REJECTED with a readable 409 "Approve the organization before adding members").
  - The target user must exist and not be deleted (404 / 400 with a readable message, not a 500). Assigning a role the user already has is a no-op that still returns the member.
  - Self-assignment rule unchanged for non-admins.
- Audit: `auditLogService.record(callerId, "organization_member.assigned", ...)` as now, and also mention it was done by an admin (e.g. keep the action name, the actor id is already recorded).
- Do not change who may LIST members: owner / organizer / admin as today.

## Housekeeping
- `openapi.yaml`: update the description / 403 text of `POST /organizations/{orgId}/members` ("owner or admin"); docs (BR-ORG-* about role assignment, BR-AUTH-004 admin bypass) and tests: admin can assign ORGANIZER and CHECK_IN_STAFF to another user in an organization they do not belong to; admin cannot assign OWNER; a non-owner non-admin member still gets 403; unknown user / organization; role already held; the pending / rejected case if you add it.

## What the web app does
The Members window of the admin Organizations tab calls this endpoint with the person picked from the search (or scanned QR) and the chosen role, and refreshes the member list. Until the API allows it the window shows the API's 403 message.
