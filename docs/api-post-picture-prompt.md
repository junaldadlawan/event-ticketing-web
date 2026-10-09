Let a post carry one optional picture. The web app already has it: in the admin's New / Edit post window you can add, change or remove a picture; it is uploaded with `POST /api/v1/uploads` first and the returned URL is sent with the post; the picture is shown under the text of the post on Home, on the event landing page and on the admin Posts tab. Until the API supports it, the field is ignored and the picture is lost. Follow the profile picture work (`users.avatar_url`, `avatarUrl` on `PATCH /users/me`) as the template, and the existing `post/` module conventions (entity, DTOs, service, `BusinessAuditLogger`, `openapi.yaml`, Flyway migration with the next free number after V33, tests).

## Data
- `posts.image_url VARCHAR(500) NULL`; `Post.imageUrl`.
- `imageUrl` (nullable) on `PostResponse`, `PostCreateRequest` and `PostUpdateRequest`, and in `openapi.yaml` (`Post`, `PostCreate`, `PostUpdate`). Returned by the public list, `GET /posts?all=true` and the create / update responses.

## Create - `POST /api/v1/posts`
- `imageUrl` optional. Same acceptance rule as `avatarUrl` and the ticket template's `backgroundImageUrl`: only this server's own existing `/api/v1/uploads/files/` URLs. Another host, a query string, a path trick or a file that does not exist -> 400 with a readable message. Blank / absent = no picture.

## Update - `PATCH /api/v1/posts/{postId}`
- `imageUrl` omitted or null = unchanged; "" = remove the picture; a valid URL = replace it. Sending the URL the post already has is a no-op (do not delete that file).
- When a picture is replaced or removed, delete the old file from storage unless something else still uses it (another post, a user's avatar, a ticket template, an event image, an organization document) - reuse the "still referenced" check written for the avatar cleanup, and add posts to it.
- Included in the `post.updated` audit entry's changed-fields list.

## Delete - `DELETE /api/v1/posts/{postId}`
- Soft delete as today. Delete the picture file only if nothing else references it (same check); if a soft-deleted post must stay restorable, keep the file instead and say so in the docs.

## Upload limits (unchanged)
- The web app uploads PNG / JPEG / WebP / GIF up to 5 MB through the existing `/uploads` endpoint, then sends the URL. No change to `UploadController` is needed; just make sure the "files in use" lookups used by cleanup now include `posts.image_url`.

## Housekeeping
- `docs/`: update the post business rule (BR-POST-*) and UC-ADMIN-05 to mention the optional picture.
- Tests: create with a valid own URL, rejected foreign URL / query string / missing file, update replace / remove / keep, old file removed when unreferenced and kept when another post uses it, public list returns `imageUrl`.

## What the web app does once this exists
Nothing more: it already sends `imageUrl` on create and update (and "" to remove) and reads `imageUrl` from every post it receives.
