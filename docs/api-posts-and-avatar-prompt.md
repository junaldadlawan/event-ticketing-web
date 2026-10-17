Two features the web app already shows, but only keeps in the browser (localStorage), so other users and devices never see them. Add them to the API so the web app can switch over. Follow the existing module layout (controller -> service + Impl -> repository -> entity, `Auditable`, `getOrThrow`, `OrganizationAccessGuard` / admin checks, `BusinessAuditLogger`, Flyway migration with the next free number after V29, `openapi.yaml`, tests). Promo code edit / pause / delete is a separate prompt (`api-promo-code-management-prompt.md`).

## 1. Posts: sales and announcements

What the web app does today: an admin writes a post (type ANNOUNCEMENT or SALE, a title, optional details) either on the Home page (site-wide) or for one event; buyers read them on Home and on the event's landing page (`/events/:id/updates`). Only admins can write or remove posts; everyone, logged in or not, can read them.

- Table `posts` (entity `Post`, module `post/`): `id` UUID, `event_id` UUID NULL (null = site-wide, shown on Home), `kind` ANNOUNCEMENT | SALE, `title` (1-120, `@NoHtml`, trimmed), `body` (0-2000, `@NoHtml`, may be empty), plus the `Auditable` columns (soft delete via `markDeleted()`, `createdAt`, `createdBy`). Index on `(event_id, created_at DESC)`.
- `POST /api/v1/posts` - ADMIN only (403 otherwise). Body `{ eventId?: uuid|null, kind, title, body? }`. If `eventId` is given the event must exist and not be deleted (404). Returns 201 `PostResponse`.
- `GET /api/v1/posts` - public (`security: []`, permit it in `SecurityConfig`, like the public event list). Query: `eventId` (that event's posts only), `siteWide=true` (only `event_id IS NULL`), neither = site-wide posts plus posts of published events, newest first. Paged with `PageResponse` (`page`, `size` default 20, max 50). Posts of DRAFT / CANCELLED / deleted events are not listed.
- `DELETE /api/v1/posts/{postId}` - ADMIN only, 204, soft delete, 404 if unknown.
- `PostResponse`: `id`, `eventId` (nullable), `eventTitle` (nullable, so Home can print "Event name: title" without extra calls), `kind`, `title`, `body`, `createdAt`.
- Audit: `post.created`, `post.deleted`. Optional later: PATCH to edit a post (not needed by the web app now).

## 2. Profile picture

What the web app does today: the profile page has a round picture with a pencil button to choose an image (cropped to a 256 px square in the browser); it is shown on the Profile page and next to the user's first name in the top bar, with initials as the fallback. Remove deletes it.

- Reuse the upload module (`UploadController`, `ImageStorageService`, `/api/v1/uploads` returning a URL under `/api/v1/uploads/files/`). Add `users.avatar_url VARCHAR(500) NULL` (migration) and `avatarUrl` (nullable) to `User`, `UserResponse` and the `User` schema in `openapi.yaml`, so it also comes back from `/auth/login`, `/users/me` and `/users/{id}`.
- `PATCH /api/v1/users/me` accepts `avatarUrl` (null = unchanged, "" = remove). Only our own `/api/v1/uploads/files/` URLs are accepted (400 otherwise, same rule as the ticket template's `backgroundImageUrl`); delete the replaced file from storage if nothing else references it.
- Upload limits stay as they are (type allow-list jpg / png / webp, size limit); the web app sends an already-resized JPEG.
- Do not return other users' avatar through anything that exposes private data; `avatarUrl` is only added to the existing user payloads.

## 3. What the web app will change once this exists
- Home and the event landing page read `GET /posts` instead of localStorage; the admin composer calls `POST /posts`, Remove calls `DELETE /posts/{id}`.
- Profile uploads the cropped image to `/uploads`, then `PATCH /users/me { avatarUrl }`; the avatar component shows `user.avatarUrl` (falling back to initials) instead of localStorage.
