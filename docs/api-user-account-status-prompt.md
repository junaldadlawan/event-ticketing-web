The admin Users tab needs to show which accounts are suspended, but `GET /api/v1/users` (and `PATCH /api/v1/users/{id}`) return `UserResponse` without the account state. `User.accountStatus` (ACTIVE | SUSPENDED, BR-ADMIN-002, enforced at login) already exists; it is just not exposed.

## Change
- Add `accountStatus` (`ACTIVE` | `SUSPENDED`) to `UserResponse` and to the `User` schema in `openapi.yaml`. It is returned from `GET /users` and `PATCH /users/{id}` (admin only), and may also appear on `/users/me` and the login response (harmless), but must never be settable through `PATCH /users/me` or `PATCH /users/{id}` - suspending and reinstating stay moderation actions (`POST /api/v1/admin/moderation-actions`, target USER) so a reason is always recorded.
- `GET /users`: keep it admin-only. Optional but useful for a long list: accept `keyword` (name or email contains), `role` and `accountStatus` filters and paging with `PageResponse` (`page`, `size` default 20, cap 100). The web app currently loads the whole list once and filters in the browser; when paging exists it will switch to these parameters.
- Guard rails for the admin actions the Users tab uses (return 409 / 403 with a readable message, not a 500): an admin cannot delete, suspend or demote themselves; the last remaining ADMIN cannot be deleted, suspended or demoted.

## Housekeeping
- `openapi.yaml`, docs (BR-ADMIN-002 / the user management use case), and tests: `accountStatus` appears in the admin list; it flips to SUSPENDED after a SUSPEND moderation action on the user and back after REINSTATE; self and last-admin guard rails; paging and filters if added.

## What the web app does once this exists
The Users tab shows a "Suspended" chip on suspended accounts and switches the row's button between Suspend and Reinstate. Until then it shows Suspend on every row.
