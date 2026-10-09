The admin Organizations tab shows the date an organization was approved when you hover its status chip, but the API does not record it: `OrganizationResponse` only has `createdAt` and `updatedAt`, and `updatedAt` moves on every change (rename, suspend, reinstate), so it is only an approximation of the approval time.

## Change
- Add `approved_at TIMESTAMPTZ NULL` (and `approved_by UUID NULL`) to `organizations` (migration, next free number). Set both in `OrganizationServiceImpl.approve` (the same place that sets `status = APPROVED` and logs `organization.approved`); never change them afterwards (a suspend / reinstate does not touch them). Backfill existing approved organizations from the audit log's `organization.approved` entry where there is one, otherwise from `updated_at`.
- Return `approvedAt` (nullable) in `OrganizationResponse` (and `approvedBy` if you add it) and in the `Organization` schema in `openapi.yaml`; documents / docs / tests updated (approve sets it, a rename or suspend keeps it, a pending / rejected organization has null).

## What the web app does once this exists
The status chip's tooltip reads "Approved Oct 5, 2026, 4:30 PM". Until then it shows "Approved (last updated <date>)".
