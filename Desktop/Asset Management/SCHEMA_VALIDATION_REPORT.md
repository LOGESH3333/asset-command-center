# Schema Validation Report — Asset Command Center

**Generated:** 2026-06-09  
**Scope:** Live Supabase database vs TypeScript types, server actions, CRUD utilities, dashboard queries, BRD module queries  
**Method:** Automated column probe (`scripts/validate-schema.mjs`) against live PostgREST + static analysis of all `supabase.from(...)` calls in `src/`

---

## Executive Summary

| Status | Count | Meaning |
|--------|-------|---------|
| **PASS** | 10 / 12 tables | Live DB columns match application expectations |
| **FAIL** | 2 / 12 tables | Live DB missing columns the app reads/writes |
| **WARNING** | 6 items | Repo/migration drift, naming, or unverified runtime behavior |

**Production blockers (must fix before deploy):**

1. `users.auth_id` — missing on live DB (live has `clerk_id` instead)
2. `notifications.read` — missing on live DB

**Note on `inventory_items`:** The application uses table **`inventory`**, not `inventory_items`. No code references `inventory_items`. Live `inventory` table **PASS**.

---

## Live Database Probe Results

Probe date: 2026-06-09 via service-role PostgREST (`limit(0)` column selects).

| Table | Live Status | Notes |
|-------|-------------|-------|
| `assets` | **PASS** | All 13 expected columns present |
| `asset_categories` | **PASS** | |
| `vendors` | **PASS** | `contact_person`, `email`, `phone`, legacy `contact_email`/`contact_phone` all present |
| `asset_requests` | **PASS** | `justification`, `requester_id`, `category_id` present (FIX 2 applied) |
| `asset_allocations` | **PASS** | `allocated_at`, `status`, `acknowledged_*` present |
| `maintenance_records` | **PASS** | |
| `inventory` | **PASS** | `quantity_on_hand`, `sku`, `notes` present (007 schema) |
| `procurements` | **PASS** | |
| `purchase_orders` | **PASS** | `expected_delivery`, `order_date` present |
| `audit_logs` | **PASS** | `old_data`, `new_data` present (not `details`) |
| `notifications` | **FAIL** | `read` column does not exist |
| `users` | **FAIL** | `auth_id` does not exist; live row sample shows `clerk_id` |

### Foreign-key join probes (live)

| Query | Status |
|-------|--------|
| `assets` → `vendors(name)`, `asset_categories(name)` | **PASS** |
| `asset_allocations` → `assets(...)`, `users:user_id(...)` | **PASS** |
| `maintenance_records` → `assets(id, name)` | **PASS** |
| `inventory` → `asset_categories(...)`, `vendors(...)` | **PASS** |
| `procurements` → `vendors(...)`, `asset_requests(id, justification)` | **PASS** |
| `purchase_orders` → `vendors(...)`, `procurements(id, title)` | **PASS** |
| `request_approvals` → `asset_requests(...)`, `users:approver_id(...)` | **PASS** |

---

## Per-Table Validation

### 1. `assets` — PASS

**Canonical columns (live ✓):** `id`, `asset_tag`, `name`, `category_id`, `vendor_id`, `assigned_employee_id`, `cost`, `purchase_date`, `warranty_expiry`, `status`, `notes`, `created_at`, `updated_at`

**TypeScript:** `src/lib/supabase/assets.ts:3-17` — aligned

| File | Line | Operation | Columns / Filters | Status |
|------|------|-----------|-------------------|--------|
| `src/lib/supabase/assets.ts` | 34-49 | SELECT | `*`, filter `status`, order `created_at` | PASS |
| `src/lib/supabase/assets.ts` | 68 | INSERT | full asset row | PASS |
| `src/lib/supabase/assets.ts` | 75-77 | UPDATE | by `asset_tag` | PASS |
| `src/app/actions/crud.ts` | 70-80 | INSERT + allocation | `assigned_employee_id`, `status` | PASS |
| `src/app/actions/crud.ts` | 95-106 | UPDATE + allocation | `assigned_employee_id` | PASS |
| `src/app/dashboard/page.tsx` | 112-123 | COUNT / SELECT | `status`, `warranty_expiry`, `cost` | PASS |
| `src/app/dashboard/page.tsx` | 242-257 | SELECT + join | `category_id`, `vendor_id` FK joins | PASS |
| `src/components/dashboard/activity-feed.tsx` | 47 | SELECT | `asset_tag, name, created_at, status` | PASS |
| `src/components/layout/activity-panel.tsx` | 196-203 | SELECT | `asset_tag, name, updated_at`, filter `status=Allocated` | PASS |
| `src/app/actions/brd/allocations.ts` | 23-27, 74-76, 107-109 | SELECT/UPDATE | `id`, `status`, `assigned_employee_id` | PASS |
| `src/app/actions/asset.actions.ts` | 8-16 | SELECT + join | `users(first_name, last_name)` | WARNING — see §Warnings |

---

### 2. `asset_categories` — PASS

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `src/lib/supabase/categories.ts` | 17-65 | CRUD | PASS |
| `src/app/actions/crud.ts` | 129-151 | INSERT/UPDATE/DELETE `name` | PASS |
| `src/lib/supabase/lookup.ts` | 9 | SELECT `id, name` | PASS |

---

### 3. `vendors` — PASS

**TypeScript:** `src/lib/supabase/vendors.ts:3-14` — includes `contact_person`, `email`, `phone` + legacy mirrors

| File | Line | Operation | Columns | Status |
|------|------|-----------|---------|--------|
| `src/lib/supabase/vendor-db.ts` | 15-24 | INSERT/UPDATE | `email`, `phone`, `contact_person` (+ mirrors) | PASS |
| `src/lib/supabase/vendors.ts` | 47-57 | SELECT | `*`, `ilike(name)`, order `created_at` | PASS |
| `src/app/actions/crud.ts` | 162-201 | CREATE/UPDATE/DELETE | canonical vendor fields | PASS |
| `src/app/actions/seed.ts` | 16-25 | INSERT | `contact_person`, `email`, `phone` | PASS |
| `src/app/dashboard/assets/[id]/page.tsx` | 46 | JOIN | `contact_person, email, phone` | PASS |

---

### 4. `asset_requests` — PASS (live) / WARNING (repo canonical)

**App expects:** `justification`, `requester_id`, `category_id`, approval workflow columns  
**Live DB:** PASS (all columns present)  
**`supabase/schema.sql:94-103`:** Still documents `title`, `description`, `employee_id` — **WARNING** repo drift

| File | Line | Operation | Columns | Status |
|------|------|-----------|---------|--------|
| `src/lib/supabase/requests.ts` | 59-73 | SELECT | `ilike(justification)`, `eq(status)`, order `created_at` | PASS |
| `src/lib/supabase/asset-request-insert.ts` | 5-18 | INSERT | `justification`, `requester_id`, `category_id` | PASS |
| `src/lib/supabase/asset-request-insert.ts` | 26-32 | UPDATE | `justification`, etc. | PASS |
| `src/app/actions/crud.ts` | 210-229 | CREATE | via `insertAssetRequestRow` | PASS |
| `src/app/actions/seed.ts` | 163-171 | INSERT | `justification`, `requester_id` | PASS |
| `src/components/layout/activity-panel.tsx` | 156-160 | SELECT | `justification, status, created_at` | PASS |
| `src/components/dashboard/activity-feed.tsx` | 50 | SELECT | `justification`, filter `Approved` | PASS |
| `src/app/actions/brd/lookups.ts` | 11 | SELECT | `id, justification, status` | PASS |
| `src/lib/supabase/brd/approvals.ts` | 37-39 | SELECT | `justification` | PASS |
| `src/app/actions/brd/approvals.ts` | 78-84 | UPDATE | `status` | PASS |

---

### 5. `asset_allocations` — PASS

| File | Line | Operation | Columns | Status |
|------|------|-----------|---------|--------|
| `src/lib/supabase/brd/allocations.ts` | 11-18 | SELECT | order `allocated_at`, filter `status` | PASS |
| `src/app/actions/brd/allocations.ts` | 58-66 | INSERT | `allocated_at`, `status`, `notes` | PASS |
| `src/app/actions/brd/allocations.ts` | 99-100 | UPDATE | `returned_at`, `status` | PASS |
| `src/app/actions/brd/allocations.ts` | 126-130 | UPDATE | `acknowledged_at`, `acknowledged_by` | PASS |
| `src/app/actions/crud.ts` | 73-80, 99-106 | INSERT | `allocated_at`, `status` | PASS |
| `src/app/actions/seed.ts` | 147 | INSERT | `asset_id`, `user_id`, `notes` | PASS |

---

### 6. `maintenance_records` — PASS

| File | Line | Operation | Columns | Status |
|------|------|-----------|---------|--------|
| `src/lib/supabase/maintenance.ts` | 38-53 | SELECT + joins | `description`, `type`, order `created_at` | PASS |
| `src/lib/supabase/maintenance-db.ts` | 109-137 | INSERT/UPDATE | full record shape | PASS |
| `src/app/actions/crud.ts` | 263-314 | CREATE/DELETE | via `maintenance-db` | PASS |
| `src/app/dashboard/page.tsx` | 122, 228-230 | COUNT / SELECT | `completed_date`, `cost` | PASS |
| `src/components/layout/activity-panel.tsx` | 166-170 | SELECT | `description, type, scheduled_date` | PASS |

---

### 7. `inventory` (not `inventory_items`) — PASS

| File | Line | Operation | Columns | Status |
|------|------|-----------|---------|--------|
| `src/lib/supabase/brd/inventory.ts` | 11-18 | SELECT | `name`, `sku`, joins, order `name` | PASS |
| `src/app/actions/brd/inventory.ts` | 33-44 | INSERT | `quantity_on_hand`, `reorder_level`, `unit_cost`, `notes` | PASS |
| `src/app/actions/brd/inventory.ts` | 79, 90 | UPDATE/DELETE | by `id` | PASS |

**`inventory_items`:** Table does not exist on live DB. No application code references it. Use **`inventory`**.

---

### 8. `procurements` — PASS

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `src/lib/supabase/brd/procurement.ts` | 12-20 | SELECT `title`, filter `status` | PASS |
| `src/app/actions/brd/procurement.ts` | 27-40 | INSERT all BRD fields | PASS |
| `src/app/dashboard/page.tsx` | 125-127 | COUNT filter `status IN (...)` | PASS |

---

### 9. `purchase_orders` — PASS

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `src/lib/supabase/brd/purchase-orders.ts` | 12-20 | SELECT `po_number`, order `created_at` | PASS |
| `src/app/actions/brd/purchase-orders.ts` | 28-39 | INSERT `expected_delivery`, `order_date` | PASS |
| `src/app/dashboard/page.tsx` | 128-139 | COUNT `expected_delivery`, `status=Received` | PASS |

---

### 10. `audit_logs` — PASS (columns) / WARNING (trigger runtime)

**Live columns:** `id`, `user_id`, `action`, `table_name`, `record_id`, `old_data`, `new_data`, `created_at`

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `src/lib/supabase/audit-logs.ts` | 24-45 | SELECT, filters, order `created_at` | PASS |
| `src/components/layout/activity-panel.tsx` | 186-190 | SELECT `old_data`, `new_data` | PASS |
| `src/components/dashboard/activity-feed.tsx` | 46 | SELECT `*` | PASS |

**WARNING:** Confirm `write_audit_log()` on live DB uses `old_data`/`new_data` (migration `009_audit_logs_old_new_data.sql`). If the old function inserting into `details` is still active, all audited INSERT/UPDATE/DELETE operations will fail at runtime even though SELECT queries pass.

---

### 11. `notifications` — FAIL

**Missing on live DB:** `read` (BOOLEAN)

**App expects:** `src/lib/supabase/notifications.ts:8` — `read: boolean`

| File | Line | Operation | Issue |
|------|------|-----------|-------|
| `src/lib/supabase/notifications.ts` | 24 | SELECT filter `.eq('read', false)` | **FAIL** — column missing |
| `src/lib/supabase/notifications.ts` | 30 | UPDATE `{ read: true }` | **FAIL** |
| `src/lib/supabase/notifications.ts` | 38-40 | UPDATE mark all read | **FAIL** |
| `src/lib/brd/notify.ts` | 16 | INSERT `read: false` | **FAIL** |
| `src/app/actions/seed.ts` | 201-209 | INSERT `read: true/false` | **FAIL** |

#### SQL fix

```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

NOTIFY pgrst, 'reload schema';
```

#### Code fix (only if live column is named differently, e.g. `is_read`)

If the live column is `is_read` instead of adding `read`:

```typescript
// src/lib/supabase/notifications.ts — map field name
export type Notification = { /* ... */ is_read: boolean };
// Replace .eq('read', false) → .eq('is_read', false)
// Replace .update({ read: true }) → .update({ is_read: true })
```

**Recommended:** Apply SQL fix above to match `supabase/schema.sql:127` and all existing app code.

---

### 12. `users` — FAIL

**Missing on live DB:** `auth_id`  
**Live has instead:** `clerk_id` (legacy Clerk integration)  
**App expects:** `auth_id UUID REFERENCES auth.users(id)`

| File | Line | Operation | Issue |
|------|------|-----------|-------|
| `src/lib/auth/session.ts` | 81 | SELECT `.eq('auth_id', authId)` | **FAIL** |
| `src/lib/supabase/users.ts` | 6, 50 | Type + `.eq('auth_id', ...)` | **FAIL** |
| `src/app/actions/users.ts` | 46, 62, 106, 113, 143-148, 183-188 | INSERT/UPSERT/SELECT `auth_id` | **FAIL** |
| `src/app/actions/seed.ts` | 88 | INSERT `auth_id: null` | **FAIL** on strict NOT NULL; passes if column absent (insert omits) |
| `src/app/dashboard/users/[id]/page.tsx` | 139 | Display `auth_id` | **FAIL** (undefined) |
| `src/app/dashboard/users/[id]/edit/page.tsx` | 54 | Load `auth_id` | **FAIL** |

**PASS (unaffected):** Queries using `id`, `email`, `first_name`, `last_name`, `role`, `department` — e.g. `crud.ts:29`, `brd/lookups.ts:8`, allocation form lookups.

#### SQL fix

```sql
-- Migration 002_supabase_auth.sql (run in Supabase SQL Editor)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate legacy clerk_id → auth_id if clerk_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'clerk_id'
  ) THEN
    UPDATE public.users SET auth_id = clerk_id::uuid WHERE auth_id IS NULL AND clerk_id IS NOT NULL;
  END IF;
END $$;

-- Auth signup sync trigger (from 002_supabase_auth.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, first_name, last_name, department, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    'Employee'
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    department = EXCLUDED.department,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
```

#### Code fix (alternative — only if staying on Clerk)

Not recommended for production Supabase Auth deployment. Would require replacing all `auth_id` references with `clerk_id` across 6+ files.

---

## BRD Extension Tables (not in user list, used by app)

| Table | Live | App usage |
|-------|------|-----------|
| `request_approvals` | PASS (join probe) | Approvals module |
| `asset_disposals` | Not probed (likely PASS if 007 applied) | Disposals module |

---

## Warnings (non-blocking but should address)

### W1 — `supabase/schema.sql` out of date

| Item | Canonical file | Application |
|------|----------------|-------------|
| `asset_requests` | `title`, `description`, `employee_id` | `justification`, `requester_id`, `category_id` |
| `vendors` | `contact_email`, `contact_phone` only | `contact_person`, `email`, `phone` |

**Fix:** Update `supabase/schema.sql` to match 007 + ENTERPRISE_AUDIT FIX 2 so fresh installs match the app.

### W2 — `ENTERPRISE_AUDIT_SQL_FIXES.sql` inventory DDL is wrong

Lines 154-166 define `inventory` with `quantity`, `description`, `sku NOT NULL` — conflicts with `007_brd_modules.sql` (`quantity_on_hand`, `notes`). Do **not** run that inventory block on a DB that already has the correct 007 schema.

### W3 — `schema-repair.ts` incomplete

`src/app/actions/schema-repair.ts` repairs allocations + audit trigger but does **not** add:
- `users.auth_id`
- `notifications.read`
- `asset_requests.justification` columns

Extend repair statements or document that ENTERPRISE_AUDIT_SQL_FIXES.sql must be run separately.

### W4 — `asset.actions.ts` implicit user join

```10:15:src/app/actions/asset.actions.ts
    .select(`
      *,
      asset_categories(name),
      vendors(name),
      users(first_name, last_name)
```

Prefer explicit FK hint: `users:assigned_employee_id(first_name, last_name)` for clarity and PostgREST compatibility.

### W5 — Audit trigger not runtime-verified

Run after applying `009_audit_logs_old_new_data.sql`:

```sql
-- Smoke test (use a disposable inventory row)
INSERT INTO public.inventory (name, quantity_on_hand) VALUES ('__schema_test__', 1);
DELETE FROM public.inventory WHERE name = '__schema_test__';
SELECT action, table_name, old_data, new_data FROM public.audit_logs ORDER BY created_at DESC LIMIT 2;
```

### W6 — Demo auth masks `users.auth_id` failures

`getDemoSessionServer()` resolves users by `email`/`role`, so local demo mode may hide the `auth_id` mismatch until real Supabase Auth is enabled.

---

## Consolidated Pre-Production SQL Script

Run in Supabase SQL Editor in order:

```sql
-- 1. Users auth_id (002_supabase_auth.sql)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'clerk_id'
  ) THEN
    UPDATE public.users SET auth_id = clerk_id::uuid WHERE auth_id IS NULL AND clerk_id IS NOT NULL;
  END IF;
END $$;

-- 2. Notifications read flag
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;

-- 3. Audit trigger (009) — only if not already applied
-- Run full contents of supabase/migrations/009_audit_logs_old_new_data.sql

NOTIFY pgrst, 'reload schema';
```

Also confirm previously applied (live probe shows these are already OK):
- `008_asset_allocations_columns.sql` ✓
- ENTERPRISE_AUDIT FIX 2 (`asset_requests` justification) ✓
- `007_brd_modules.sql` (BRD tables) ✓

---

## Validation Tooling

Re-run live probe anytime:

```bash
node scripts/validate-schema.mjs
```

Output is JSON with per-table PASS/FAIL and FK join results.

---

## Final Checklist

| Check | Result |
|-------|--------|
| All 12 named tables exist (using `inventory` not `inventory_items`) | 11 PASS, 2 with column gaps |
| TypeScript types match live DB | FAIL on `users`, `notifications` |
| Server actions INSERT/UPDATE columns valid | FAIL on `users.ts`, `notify.ts`, `seed.ts` notifications |
| Dashboard queries valid | PASS (except notifications unread count if used) |
| BRD queries valid | PASS |
| Foreign keys for joins | PASS |
| Audit logging | PASS columns; WARNING trigger verification |

**Overall deployment readiness:** Fix **2 FAIL items** (`users.auth_id`, `notifications.read`), verify audit trigger (W5), then re-run `node scripts/validate-schema.mjs` — expect 12/12 PASS.
