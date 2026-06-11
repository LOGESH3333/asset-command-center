# Asset Request Schema Alignment Report

**Date:** 2026-06-09  
**Issue:** `Could not find the 'employee_id' column of 'asset_requests' in the schema cache`  
**Resolution:** Updated application code to match the live `asset_requests` table (no database migrations applied).

---

## Target Schema (unchanged)

| Column | Purpose |
|--------|---------|
| `id` | Primary key |
| `requester_id` | User who submitted the request |
| `category_id` | Optional asset category |
| `justification` | Business case / item description |
| `priority` | Low / Medium / High |
| `status` | Workflow status |
| `manager_id`, `procurement_id`, `finance_id` | Approval chain |
| `manager_approval_date`, `procurement_approval_date`, `finance_approval_date` | Timestamps |
| `rejection_reason` | Rejection notes |
| `created_at`, `updated_at` | Audit timestamps |

**Removed from code (not in DB):** `employee_id`, `title`, `description`

---

## Field Mapping Applied

| Old code field | New DB field | Notes |
|----------------|--------------|-------|
| `employee_id` | `requester_id` | Set from logged-in user on create |
| `title` + `description` | `justification` | Form combines item name + reason into one string |
| `title` (display) | `justification` | Truncated via `formatRequestLabel()` |

---

## Files Changed (18)

### Core types & data layer

| File | Changes |
|------|---------|
| `src/lib/supabase/requests.ts` | Rewrote `AssetRequest` type; added `AssetRequestInsert`, `AssetRequestUpdate`, `AssetRequestLookup`, `formatRequestLabel()`; search uses `justification`; removed `title`, `description`, `employee_id` |
| `src/lib/supabase/asset-request-insert.ts` | Inserts/updates use `justification`, `requester_id`, `category_id`; removed description-column fallback logic |
| `src/app/actions/crud.ts` | `createRequestAction` / `updateRequestAction` use new types; removed schema-repair retry on insert |

### Request UI

| File | Changes |
|------|---------|
| `src/app/dashboard/requests/new/page.tsx` | Form: item name + justification → `justification`; `requester_id` from profile; optional `category_id` |
| `src/app/dashboard/requests/page.tsx` | List column shows `justification` via `formatRequestLabel()` |
| `src/app/dashboard/requests/[id]/page.tsx` | Detail shows `justification`, `requester_id`, `category_id`, `rejection_reason` |

### Seed data

| File | Changes |
|------|---------|
| `src/app/actions/seed.ts` | Sample requests use `justification` + `requester_id` |

### BRD module integration

| File | Changes |
|------|---------|
| `src/lib/brd/types.ts` | Nested `asset_requests` uses `justification` instead of `title` |
| `src/lib/supabase/brd/approvals.ts` | Selects `justification` from joined `asset_requests` |
| `src/lib/supabase/brd/procurement.ts` | Selects `justification` from joined `asset_requests` |
| `src/app/actions/brd/lookups.ts` | Request lookup query: `id, justification, status` |
| `src/app/dashboard/approvals/page.tsx` | Request column uses `formatRequestLabel()` |
| `src/app/dashboard/approvals/[id]/page.tsx` | Header uses `justification` |
| `src/app/dashboard/approvals/new/page.tsx` | Request dropdown labels use `justification` |
| `src/app/dashboard/procurement/[id]/page.tsx` | Linked request label uses `justification` |
| `src/app/dashboard/procurement/new/page.tsx` | Request dropdown labels use `justification` |

### Activity widgets

| File | Changes |
|------|---------|
| `src/components/dashboard/activity-feed.tsx` | Query + display use `justification` |
| `src/components/layout/activity-panel.tsx` | Query + display use `justification` |

---

## Verification Checklist

- [ ] Open `/dashboard/requests/new` and submit a request
- [ ] Confirm row appears on `/dashboard/requests` with justification text
- [ ] Open request detail — fields load without errors
- [ ] BRD approval/procurement dropdowns show request labels
- [ ] No console errors referencing `employee_id`, `title`, or `description` on `asset_requests`

---

## Not Modified (intentionally)

- **Database schema / migrations** — per requirement
- **`schema-repair.ts` / settings page** — still references legacy `description` column repair (optional admin tool; does not affect request create flow)
- **`assigned_employee_id` on `assets` table** — unrelated to `asset_requests`

---

## New Request Payload Example

```json
{
  "justification": "MacBook Pro M3 — New hire onboarding for backend team",
  "requester_id": "<user-uuid>",
  "category_id": "<category-uuid-or-null>",
  "priority": "Medium",
  "status": "Pending"
}
```
