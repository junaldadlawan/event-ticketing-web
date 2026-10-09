Let admins edit a post. The API has `POST /api/v1/posts`, public `GET /api/v1/posts` and `DELETE /api/v1/posts/{postId}`, but a post can't be changed once created, so a typo means deleting and re-creating it. Follow the existing `post/` module (controller -> service + Impl -> repository -> entity, `Auditable`, `getOrThrow`, admin check as in create / delete, `BusinessAuditLogger`, `openapi.yaml`, tests).

## Endpoint
- `PATCH /api/v1/posts/{postId}` - ADMIN only (403 otherwise), 404 if the post doesn't exist or is soft-deleted. Body `PostUpdateRequest`, every field optional, null = unchanged:
  - `kind`: ANNOUNCEMENT | SALE
  - `title`: 1-120 characters after trimming, `@NoHtml` (blank -> 400, same message style as create)
  - `body`: 0-2000 characters, trimmed, `@NoHtml`; send "" to clear the details
- `eventId` can NOT be changed (not part of the request; a post stays with its event, or stays site-wide). To move a post, delete and create a new one.
- An empty body or a body with no changes is not an error: return the post as it is, write nothing, no audit entry.
- Returns 200 `PostResponse` (same shape as create / list: `id`, `eventId`, `eventTitle`, `kind`, `title`, `body`, `createdAt`). `updatedAt` / `updatedBy` come from `Auditable`; add `updatedAt` to `PostResponse` (nullable) so the web app can show "edited".
- Audit: `BusinessAuditLogger.record("post.updated", "Post", id, Outcome.SUCCESS)`.
- No migration is needed (the `posts` table already has the audit columns).

## Housekeeping
- `SecurityConfig`: the route needs an authenticated user (not public); keep `GET /posts` public.
- `openapi.yaml`: add `patch` under `/posts/{postId}` and the `PostUpdate` schema; add `updated_at` to the `Post` schema.
- Tests: service (admin can edit, non-admin 403, unknown / deleted 404, blank title 400, HTML rejected, no-op writes nothing, event cannot change), controller, and one integration test that edits a post and reads it back from the public list.

## What the web app does once this exists
The admin Posts tab shows a pencil on each post. It opens the same window as "New post", filled in with the post's type, title and details, and "Save changes" calls `PATCH /posts/{id}` with `{ kind, title, body }`.
