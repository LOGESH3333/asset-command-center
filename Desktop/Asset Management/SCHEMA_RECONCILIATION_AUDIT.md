# Schema Reconciliation Audit

**Date:** 2026-06-09  
**Scope:** Live Supabase schema vs all application code (pages, forms, actions, queries, types, dropdown loaders)  
**Constraint:** No database schema changes applied — code aligned to existing tables only.

---

## Executive Summary

| Module | Status | Notes |
|--------|--------|-------|
| **asset_requests** | ✅ Reconciled | All reads/writes use `requester_id`, `justification`, `category_id` |
| **vendors** | ✅ Reconciled | All reads/writes use `name`, `contact_person`, `email`, `phone`, `address` (+ mirrored legacy columns) |
| **Dropdown loaders** | ✅ OK | All use `id, name` only for vendors; `id, justification, status` for requests |
| **TypeScript build** | ✅ Pass | `npx tsc --noEmit` exit code 0 |
| **Repo migrations/docs** | ⚠️ Drift | Local `supabase/schema.sql` and migration 004/005 still document old columns (not executed) |

---

## Live Database Schema (source of truth)

### `asset_requests`

| Column | Used in code |
|--------|--------------|
| `id` | ✅ |
| `requester_id` | ✅ (was `employee_id`) |
| `category_id` | ✅ |
| `justification` | ✅ (was `title` + `description`) |
| `priority` | ✅ |
| `status` | ✅ |
| `manager_id`, `procurement_id`, `finance_id` | ✅ (type only; BRD workflow) |
| `manager_approval_date`, `procurement_approval_date`, `finance_approval_date` | ✅ (type only) |
| `rejection_reason` | ✅ |
| `created_at`, `updated_at` | ✅ |

**Removed from code (not in live DB):** `employee_id`, `title`, `description`

### `vendors`

| Column | Used in code |
|--------|--------------|
| `id` | ✅ |
| `name` | ✅ |
| `contact_person` | ✅ (was missing) |
| `email` | ✅ (primary; was `contact_email` only) |
| `phone` | ✅ (primary; was `contact_phone` only) |
| `address` | ✅ |
| `contact_email` | ✅ (mirrored on write from `email`) |
| `contact_phone` | ✅ (mirrored on write from `phone`) |
| `created_at`, `updated_at` | ✅ |

**Not found in codebase:** `vendor_name`, `contact_name`, `vendor_email`, `vendor_phone`

---

## Every Mismatch Found

### A. `asset_requests` (fixed)

| # | Location (before) | Wrong field(s) | Correct field | Fix |
|---|-------------------|----------------|---------------|-----|
| A1 | `requests.ts` type | `title`, `description`, `employee_id` | `justification`, `requester_id` | Type rewritten |
| A2 | `asset-request-insert.ts` | Insert payload used old columns + description fallback | `justification`, `requester_id`, `category_id` | Direct insert; fallback removed |
| A3 | `crud.ts` `createRequestAction` | `title`, `description`, `employee_id` | `justification`, `requester_id` | Params + insert updated |
| A4 | `requests/new/page.tsx` | Title + description form → old columns | Combined → `justification` | Form redesigned |
| A5 | `requests/page.tsx` | Column `title` | `justification` + `formatRequestLabel()` | List updated |
| A6 | `requests/[id]/page.tsx` | `title`, `description`, `employee_id` display | `justification`, `requester_id` | Detail updated |
| A7 | `seed.ts` | `title`, `description`, `employee_id` | `justification`, `requester_id` | Seed payload updated |
| A8 | `brd/lookups.ts` | `select('id, title, status')` | `justification` | Query updated |
| A9 | `brd/approvals.ts`, `brd/procurement.ts` | Join `asset_requests(id, title, …)` | `justification` | Select updated |
| A10 | `brd/types.ts` | Nested `title` on `asset_requests` | `justification` | Types updated |
| A11 | Approvals/procurement pages | Display `asset_requests?.title` | `formatRequestLabel(justification)` | UI updated |
| A12 | `activity-feed.tsx`, `activity-panel.tsx` | `select id, title` | `justification` | Widget queries updated |
| A13 | `schema-repair.ts` | ALTER ADD `description` | N/A — removed (would conflict with live DB) | Repair SQL cleaned |
| A14 | `settings/page.tsx` | UI text referenced `asset_requests.description` | Updated copy | Misleading text removed |

### B. `vendors` (fixed)

| # | Location (before) | Wrong field(s) | Correct field | Fix |
|---|-------------------|----------------|---------------|-----|
| B1 | `vendors.ts` type | Missing `contact_person`, `email`, `phone` | Full type | Type expanded |
| B2 | `vendor-db.ts` | Only `contact_email`/`contact_phone`; schema fallback | `email`, `phone`, `contact_person` + mirror | Payload builder rewritten |
| B3 | `crud.ts` vendor actions | `contact_email`, `contact_phone` params | `email`, `phone`, `contact_person` | Action types updated |
| B4 | `vendors/new`, `[id]/edit` | Form fields `contact_email`, `contact_phone` | `email`, `phone`, `contact_person` | Forms updated |
| B5 | `vendors/page.tsx`, `[id]/page.tsx` | Display `contact_email`/`contact_phone` only | `getVendorEmail()` / `getVendorPhone()` helpers | Read with fallback |
| B6 | `seed.ts` | `contact_email`, `contact_phone` only | `contact_person`, `email`, `phone` | Seed updated |
| B7 | `assets/[id]/page.tsx` | Join `contact_email, contact_phone` | `contact_person, email, phone` | Select updated |
| B8 | `schema-repair.ts` | ALTER ADD vendor contact columns | Removed from repair SQL | No longer suggests wrong DDL |

### C. No mismatch (verified OK)

| Area | Query pattern | Status |
|------|---------------|--------|
| Assets vendor dropdown | `vendors(id, name)` via `crud.ts`, `lookup.ts` | ✅ |
| Maintenance vendor dropdown | `maintenance-db.ts` → `id, name` | ✅ |
| Procurement vendor dropdown | `brd/lookups.ts` → `id, name` | ✅ |
| PO / Inventory vendor dropdown | `brd/lookups.ts` → `id, name` | ✅ |
| BRD joins | `vendors(id, name)` in procurement, PO, inventory, maintenance | ✅ |
| `assigned_employee_id` on **assets** | Separate column on `assets` table — not vendor/request drift | ✅ N/A |
| Procurement `title`/`description` | Belongs to `procurements` table — not `asset_requests` | ✅ N/A |
| Maintenance `description` | Belongs to `maintenance_records` table | ✅ N/A |
| Notifications `title` | Belongs to `notifications` table | ✅ N/A |
| UI prop `description` on PageHeader/EmptyState | React props — not DB columns | ✅ N/A |

---

## Every File Changed (cumulative)

### asset_requests reconciliation (18 files)

| File | Fix applied |
|------|-------------|
| `src/lib/supabase/requests.ts` | Canonical types, `formatRequestLabel()`, search on `justification` |
| `src/lib/supabase/asset-request-insert.ts` | Insert/update use live columns only |
| `src/app/actions/crud.ts` | `createRequestAction` / `updateRequestAction` aligned |
| `src/app/actions/seed.ts` | Request seed uses `justification`, `requester_id` |
| `src/app/dashboard/requests/new/page.tsx` | Form → `justification`, `requester_id`, `category_id` |
| `src/app/dashboard/requests/page.tsx` | List column → `justification` |
| `src/app/dashboard/requests/[id]/page.tsx` | Detail fields aligned |
| `src/lib/brd/types.ts` | Nested request type uses `justification` |
| `src/lib/supabase/brd/approvals.ts` | Join selects `justification` |
| `src/lib/supabase/brd/procurement.ts` | Join selects `justification` |
| `src/app/actions/brd/lookups.ts` | Request lookup query fixed |
| `src/app/dashboard/approvals/page.tsx` | Request column label |
| `src/app/dashboard/approvals/[id]/page.tsx` | Header uses `justification` |
| `src/app/dashboard/approvals/new/page.tsx` | Dropdown uses `justification` |
| `src/app/dashboard/procurement/[id]/page.tsx` | Linked request label |
| `src/app/dashboard/procurement/new/page.tsx` | Request dropdown |
| `src/components/dashboard/activity-feed.tsx` | Query + display |
| `src/components/layout/activity-panel.tsx` | Query + display |

### vendors reconciliation (10 files)

| File | Fix applied |
|------|-------------|
| `src/lib/supabase/vendors.ts` | Full type + `getVendorEmail()` / `getVendorPhone()` |
| `src/lib/supabase/vendor-db.ts` | Payload builder; mirrors email/phone to legacy columns |
| `src/app/actions/crud.ts` | Vendor create/update param types |
| `src/app/actions/seed.ts` | Vendor seed fields |
| `src/app/dashboard/vendors/new/page.tsx` | Form fields aligned |
| `src/app/dashboard/vendors/[id]/edit/page.tsx` | Load/save aligned |
| `src/app/dashboard/vendors/[id]/page.tsx` | Detail display |
| `src/app/dashboard/vendors/page.tsx` | List columns |
| `src/app/dashboard/assets/[id]/page.tsx` | Vendor join columns |

### This audit pass (2 files)

| File | Fix applied |
|------|-------------|
| `src/app/actions/schema-repair.ts` | Removed DDL for non-existent `asset_requests.description` and vendor contact columns |
| `src/app/dashboard/settings/page.tsx` | Updated schema repair help text |

### Reports generated

- `ASSET_REQUEST_SCHEMA_FIX_REPORT.md`
- `VENDOR_SCHEMA_FIX_REPORT.md`
- `SCHEMA_RECONCILIATION_AUDIT.md` (this file)

---

## Exact Fixes Applied (summary)

### Requests — write path

```typescript
// Before (broken)
{ title, description, employee_id, priority, status }

// After (live schema)
{ justification, requester_id, category_id, priority, status }
```

### Requests — read/display

```typescript
// Before
query.ilike('title', …)  |  row.title  |  asset_requests(id, title, status)

// After
query.ilike('justification', …)  |  formatRequestLabel(row.justification)  |  asset_requests(id, justification, status)
```

### Vendors — write path

```typescript
// Before (partial / wrong)
{ name, contact_email, contact_phone, address }

// After (live schema)
{ name, contact_person, email, phone, address, contact_email: email, contact_phone: phone }
```

### Vendors — read/display

```typescript
// Before
vendor.contact_email  |  vendor.contact_phone

// After
getVendorEmail(vendor)  // email ?? contact_email
getVendorPhone(vendor)  // phone ?? contact_phone
vendor.contact_person
```

---

## Verification Results

### Static analysis

| Check | Result |
|-------|--------|
| `grep employee_id` in request context | ✅ None (only `assigned_employee_id` on **assets**) |
| `grep title/description` on `asset_requests` queries | ✅ None in `src/` |
| `grep contact_email` in vendor **forms** | ✅ None — only in type + server mirror |
| `grep vendor_name/contact_name/vendor_email/vendor_phone` | ✅ None anywhere |
| `npx tsc --noEmit` | ✅ Exit code 0 |

### Requests module — expected runtime behavior

| Test | Expected |
|------|----------|
| Create at `/dashboard/requests/new` | Inserts `justification`, `requester_id`; no schema cache error |
| List `/dashboard/requests` | Shows truncated `justification`; search filters on `justification` |
| Detail `/dashboard/requests/[id]` | Shows `justification`, `requester_id`, `category_id`, status |
| Approvals/procurement dropdowns | Labels from `formatRequestLabel(justification)` |
| Activity widgets | No query errors on `title` column |

### Vendors module — expected runtime behavior

| Test | Expected |
|------|----------|
| Create at `/dashboard/vendors/new` | Inserts all contact fields; mirrors email/phone to legacy columns |
| List `/dashboard/vendors` | Email/phone columns populate for new and legacy rows |
| Edit `/dashboard/vendors/[id]/edit` | Loads via helpers; saves canonical fields |
| Delete | Standard delete on `vendors` by `id` |
| Asset/maintenance/procurement dropdowns | Load `id, name` without error |

### Manual checklist (run in browser)

- [ ] Submit asset request — success toast / redirect, no console error
- [ ] Submit vendor — success, appears in list
- [ ] Maintenance new record — vendor dropdown populated
- [ ] Asset new/edit — vendor dropdown populated
- [ ] Procurement new — vendor + request dropdowns populated

---

## Remaining repo drift (documentation only — not executed)

These files still describe **old** columns but were **not** run against your live DB:

| File | Drift |
|------|-------|
| `supabase/schema.sql` | Documents `asset_requests.title/description/employee_id` and vendors without `contact_person/email/phone` |
| `supabase/migrations/004_full_schema_sync.sql` | Adds old request/vendor columns |
| `supabase/migrations/005_asset_requests_description.sql` | Adds `description` to requests |
| `supabase/migrations/006_vendors_contact_columns.sql` | May DROP `email`/`phone` |
| `BRD_IMPLEMENTATION_STATUS.md`, `AUDIT_REPORT.md` | Historical references to old columns |

**Recommendation:** Treat live Supabase as source of truth; update repo SQL docs in a separate pass if desired. Do **not** run migrations 004–006 against the reconciled production schema without review.

---

## Conclusion

Application code in `src/` is **fully reconciled** with the live `asset_requests` and `vendors` schemas. No remaining references to `employee_id`, `title`, or `description` on asset requests, and no vendor form/query usage of non-existent column names. Schema repair tooling was updated so it no longer attempts to add columns that conflict with the live database.
