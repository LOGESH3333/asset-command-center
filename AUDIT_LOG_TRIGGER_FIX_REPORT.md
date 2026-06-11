# Audit Log Trigger Fix Report

**Date:** 2026-06-09  
**Error:** `column "details" of relation "audit_logs" does not exist`  
**Affected:** Inventory create (and all tables with `audit_*` triggers)

---

## Root cause — **A: Database trigger function not redeployed**

| Layer | Status |
|-------|--------|
| Application TypeScript | **CLEAN** — no `audit_logs.details` references |
| SQL migrations in repo (003, 007, 009, schema-repair) | **CORRECT** — use `old_data` / `new_data` |
| **Live Supabase `write_audit_log()`** | **STALE** — still inserts into `details` |

### How inventory fails

1. User submits **New Inventory Item** → `createInventoryAction` (`src/app/actions/brd/inventory.ts:31-47`)
2. `INSERT INTO public.inventory` succeeds at row level
3. Trigger `audit_inventory` fires (`007_brd_modules.sql:235-242`)
4. Stale `write_audit_log()` runs `INSERT INTO audit_logs (..., details, ...)`
5. PostgreSQL rejects: column `details` does not exist
6. Entire transaction rolls back → user sees the error

### Live verification (reproduced)

```text
node scripts/test-inventory-insert.mjs
→ INSERT FAILED: column "details" of relation "audit_logs" does not exist
```

---

## Code search results — `details` + audit

### Application code (`src/`)

| File | Line | Reference | Audit-related? |
|------|------|-----------|----------------|
| — | — | **No matches** for `audit_logs` + `details` | N/A |

UI strings like "Supplier details" / "asset details" are unrelated.

### SQL / migrations (`supabase/`)

| File | Line | Content |
|------|------|---------|
| `migrations/009_audit_logs_old_new_data.sql` | 5 | Comment only (documents the error) |
| `migrations/003_fix_rls_and_allocations.sql` | 56-77 | `old_data`, `new_data` ✓ |
| `migrations/007_brd_modules.sql` | 39-60 | `old_data`, `new_data` ✓ |
| `schema.sql` | 175-196 | `old_data`, `new_data` ✓ |
| `schema-repair.ts` | (via shared module) | `old_data`, `new_data` ✓ |

**No migration file in the repo still inserts into `details`.**

### `write_audit_log` references

| Location | Purpose |
|----------|---------|
| `supabase/migrations/009_audit_logs_old_new_data.sql` | Canonical fix (not applied on live DB) |
| `src/lib/supabase/sql/write-audit-log-function.ts` | Shared SQL constant (new) |
| `src/app/actions/schema-repair.ts` | Includes function redeploy |
| `src/app/actions/audit-trigger-repair.ts` | Dedicated one-click repair (new) |

### Tables with `audit_*` triggers (all use same function)

From `007_brd_modules.sql` + core schema:

`assets`, `asset_categories`, `vendors`, `asset_requests`, `maintenance_records`, `users`, `asset_allocations`, `request_approvals`, `procurements`, `purchase_orders`, **`inventory`**, `asset_disposals`

---

## SQL fix (run on live Supabase)

**Option 1 — Supabase Dashboard → SQL Editor → Run:**

Use entire contents of:

`supabase/migrations/009_audit_logs_old_new_data.sql`

**Option 2 — Settings page (after adding DB password):**

1. Add `SUPABASE_DB_PASSWORD` to `.env.local`
2. Dashboard → **Settings** → **Fix Audit Log Trigger**

**Option 3 — CLI script:**

```bash
# Add SUPABASE_DB_PASSWORD to .env.local first
node scripts/apply-audit-trigger-fix.mjs
node scripts/test-inventory-insert.mjs   # should print INSERT OK
```

### Corrected function (excerpt)

```sql
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id TEXT;
BEGIN
  -- ...
  INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data)
  VALUES ('INSERT', TG_TABLE_NAME, rec_id, NULL, to_jsonb(NEW));
  -- ...
END;
$$;

NOTIFY pgrst, 'reload schema';
```

### Verify live function after fix

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'write_audit_log'
  AND pronamespace = 'public'::regnamespace;
```

Expected: body contains `old_data` and `new_data`, **not** `details`.

---

## Code fixes applied (this session)

| File | Change |
|------|--------|
| `src/lib/supabase/sql/write-audit-log-function.ts` | **NEW** — single source of truth for trigger SQL |
| `src/lib/supabase/audit-db-errors.ts` | **NEW** — maps `details` error to repair instructions |
| `src/app/actions/audit-trigger-repair.ts` | **NEW** — repair / verify / inspect actions |
| `src/app/actions/schema-repair.ts` | Uses shared SQL module (no duplicate) |
| `src/app/actions/brd/inventory.ts` | Friendly error when stale trigger detected |
| `src/app/actions/crud.ts` | Same error mapping for asset/vendor/category/request creates |
| `src/app/dashboard/settings/page.tsx` | **Fix Audit Log Trigger** UI + Verify button |
| `scripts/apply-audit-trigger-fix.mjs` | **NEW** — apply migration 009 via `pg` |
| `scripts/test-inventory-insert.mjs` | **NEW** — smoke test |
| `scripts/inspect-audit-function.mjs` | **NEW** — `pg_get_functiondef` inspector |
| `.env.example` | Documents `SUPABASE_DB_PASSWORD` |

**No application code referenced `details` — no app logic change required beyond error messages and repair tooling.**

---

## Verification checklist

| Step | Before fix | After fix (you run SQL) |
|------|------------|-------------------------|
| `node scripts/test-inventory-insert.mjs` | **FAIL** (`details`) | Should **PASS** |
| Settings → Verify | FAIL | OK |
| Create inventory in UI | FAIL | Should **PASS** |
| `grep -r "audit_logs.*details" src/` | 0 matches | 0 matches |

---

## Action required

The live database function **must be redeployed once**. Application code cannot override a PostgreSQL trigger body.

**Fastest path:** Open [Supabase SQL Editor](https://supabase.com/dashboard/project/cvfprrtxeihcwlilxjlp/sql/new), paste `009_audit_logs_old_new_data.sql`, click **Run**, then retry inventory create.
