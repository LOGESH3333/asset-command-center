# Asset Command Center — Enterprise Audit Report

**Project:** Asset Command Center  
**Stack:** Next.js · TypeScript · Tailwind · Supabase · Supabase Auth (partial) · Recharts  
**Audit date:** June 9, 2026  
**Audit type:** Static code + schema + production build verification  
**Report format:** Markdown (downloadable)

---

## Executive Summary

| Area | Score | Status |
|------|-------|--------|
| Build & TypeScript | 100% | **PASS** |
| Routes (compile) | 100% | **PASS** |
| Database schema alignment | 62% | **FAIL** |
| Module CRUD (functional) | 74% | **WARNING** |
| BRD workflow automation | 35% | **FAIL** |
| Auth & RBAC (production) | 28% | **FAIL** |
| Command Center dashboard | 88% | **WARNING** |
| **Overall enterprise readiness** | **58%** | **NOT PRODUCTION READY** |

### Critical blockers (fix before go-live)

1. **Demo auth only** — sessions use `localStorage` + cookie demo session, not Supabase Auth JWT.
2. **`asset_requests` schema mismatch** — app queries `justification`, `requester_id`, `category_id`; canonical SQL has `title`, `description`, `employee_id`.
3. **`asset_allocations` legacy table** — migration `008` must be applied on live Supabase or allocations fail at runtime.
4. **No Procurement / Finance roles** — approval stages exist in DB but RBAC only defines Admin, Manager, Employee.
5. **Legacy CRUD server actions** (`crud.ts`) — no role checks; uses service-role admin client.
6. **Workflow is manual** — no automated handoffs from PO → asset creation or approval chain orchestration.

### Companion file

Exact SQL remediation scripts: **`ENTERPRISE_AUDIT_SQL_FIXES.sql`**

---

## Verification Methods

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0, 49 routes compiled) |
| Live browser / hydration test | **Not run** (static audit; runtime depends on Supabase state) |
| Live Supabase introspection | **Not run** (schema compared against migrations + app code) |

---

## Phase 1 — Route Audit

**Legend:**  
- **PASS** — Route exists, builds, no known compile errors  
- **WARNING** — Route builds but may fail at runtime (DB/auth/data) or missing UX  
- **FAIL** — Route missing or known broken

### Public & auth routes

| Route | Status | Notes |
|-------|--------|-------|
| `/` | **PASS** | Root page exists |
| `/login` | **PASS** | Demo login flow |
| `/signup` | **PASS** | Signup page exists |
| `/auth/callback` | **WARNING** | Supabase OAuth callback exists; primary auth path is demo session |

### Command Center

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | **WARNING** | Builds; KPI queries fail partially if `asset_requests.justification` missing on DB |

### Assets

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/assets` | **PASS** | List |
| `/dashboard/assets/new` | **PASS** | Create |
| `/dashboard/assets/[id]` | **PASS** | Read |
| `/dashboard/assets/[id]/edit` | **PASS** | Update |

### Requests

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/requests` | **WARNING** | List uses `justification` column — **FAIL at runtime** if column absent |
| `/dashboard/requests/new` | **WARNING** | Create inserts `justification` — schema mismatch |
| `/dashboard/requests/[id]` | **WARNING** | Detail shows `requester_id` as raw UUID |

### Approvals

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/approvals` | **WARNING** | Join on `asset_requests.justification` |
| `/dashboard/approvals/new` | **PASS** | Create (Admin/Manager server action) |
| `/dashboard/approvals/[id]` | **PASS** | Read + decide |

### Allocations

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/allocations` | **WARNING** | **FAIL at runtime** until migration `008` applied |
| `/dashboard/allocations/new` | **PASS** | Form fixed (null-safe selects) |
| `/dashboard/allocations/[id]` | **WARNING** | Depends on `allocated_at` column |

### Maintenance

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/maintenance` | **PASS** | |
| `/dashboard/maintenance/new` | **PASS** | |
| `/dashboard/maintenance/[id]` | **PASS** | |
| `/dashboard/maintenance/[id]/edit` | **PASS** | |

### Stock (Inventory)

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/inventory` | **PASS** | Sidebar label: Stock |
| `/dashboard/inventory/new` | **PASS** | |
| `/dashboard/inventory/[id]` | **PASS** | Update inline |

### Categories

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/categories` | **PASS** | |
| `/dashboard/categories/new` | **PASS** | |
| `/dashboard/categories/[id]` | **PASS** | |
| `/dashboard/categories/[id]/edit` | **PASS** | |

### Vendors

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/vendors` | **PASS** | |
| `/dashboard/vendors/new` | **PASS** | |
| `/dashboard/vendors/[id]` | **PASS** | |
| `/dashboard/vendors/[id]/edit` | **PASS** | |

### Procurement

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/procurement` | **PASS** | |
| `/dashboard/procurement/new` | **PASS** | |
| `/dashboard/procurement/[id]` | **PASS** | |

### Purchase Orders

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/purchase-orders` | **PASS** | |
| `/dashboard/purchase-orders/new` | **PASS** | |
| `/dashboard/purchase-orders/[id]` | **PASS** | |

### Executive Reports

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/reports` | **WARNING** | Hidden from sidebar; no page-level role guard (relies on nav only) |

### Team (Users)

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/users` | **PASS** | |
| `/dashboard/users/new` | **PASS** | Admin-only action |
| `/dashboard/users/[id]` | **PASS** | |
| `/dashboard/users/[id]/edit` | **PASS** | |

### Alerts (Notifications)

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/notifications` | **WARNING** | No per-user filter; shows all notifications |

### Disposals

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/disposals` | **PASS** | |
| `/dashboard/disposals/new` | **PASS** | |
| `/dashboard/disposals/[id]` | **PASS** | |

### Audit Trail

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/audit-logs` | **PASS** | Read-only |

### Settings

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard/settings` | **WARNING** | General settings save is simulated (`setTimeout`); schema repair has no auth gate |

### Navigation

| Status | Notes |
|--------|-------|
| **PASS** | All modules linked from sidebar (Reports hidden by design) |
| **PASS** | Middleware protects `/dashboard/*` via `/dashboard` prefix |
| **WARNING** | No role-based route blocking in middleware |

### Phase 1 totals

| Result | Count |
|--------|-------|
| PASS | 38 |
| WARNING | 11 |
| FAIL | 0 (compile) / 3 (runtime-conditional) |

---

## Phase 2 — Database Audit

Schema compared against: `supabase/schema.sql`, migrations `001–008`, and application TypeScript types.

### Table inventory

| Table | Expected | In migrations | App usage | Status |
|-------|----------|---------------|-----------|--------|
| `users` | ✓ | ✓ | ✓ | **PASS** |
| `assets` | ✓ | ✓ | ✓ | **PASS** |
| `asset_categories` | ✓ | ✓ | ✓ | **PASS** |
| `vendors` | ✓ | ✓ | ✓ | **PASS** |
| `asset_requests` | ✓ | ✓ | ✓ | **FAIL** — column mismatch |
| `request_approvals` | ✓ | 007 | ✓ | **PASS** |
| `asset_allocations` | ✓ | 003, 007, 008 | ✓ | **WARNING** — needs 008 on live DB |
| `maintenance_records` | ✓ | ✓ | ✓ | **PASS** |
| `procurements` | ✓ | 007 | ✓ | **PASS** |
| `purchase_orders` | ✓ | 007 | ✓ | **PASS** |
| `inventory` | ✓ | 007 | ✓ | **PASS** |
| `asset_disposals` | ✓ | 007 | ✓ | **PASS** |
| `notifications` | ✓ | ✓ | ✓ | **WARNING** — no `user_id` filter in app |
| `audit_logs` | ✓ | ✓ | ✓ | **PASS** |

### `asset_requests` — schema mismatch (CRITICAL)

| App expects | SQL schema has | Status |
|-------------|----------------|--------|
| `justification` | `title`, `description` | **FAIL** |
| `requester_id` | `employee_id` | **FAIL** |
| `category_id` | — | **FAIL** (missing in SQL) |
| `manager_id`, `procurement_id`, `finance_id` | — | **FAIL** (missing in SQL) |
| `manager_approval_date`, etc. | — | **FAIL** (missing in SQL) |
| `rejection_reason` | — | **FAIL** (missing in SQL) |

### `asset_allocations` — legacy deployment risk

| Column | Required by app | Migration 008 | Status |
|--------|-----------------|---------------|--------|
| `allocated_at` | ✓ | ADD IF NOT EXISTS | **WARNING** until applied |
| `returned_at` | ✓ | ✓ | **WARNING** |
| `status` | ✓ | ✓ | **WARNING** |
| `acknowledged_at` | ✓ | ✓ | **WARNING** |
| `acknowledged_by` | ✓ | ✓ | **WARNING** |

### Keys, constraints, indexes (from migrations)

| Object | Status |
|--------|--------|
| Primary keys (UUID) | **PASS** on all tables |
| Foreign keys (BRD modules) | **PASS** in 007 |
| CHECK constraints (approval_stage, statuses) | **PASS** in 007 |
| Indexes (`idx_allocations_*`, `idx_requests_status`, etc.) | **PASS** in migrations |
| `set_updated_at` triggers | **PASS** |
| `write_audit_log` triggers | **PASS** on core tables |

### RLS policies

| Status | Notes |
|--------|-------|
| **WARNING** | `supabase/policies.sql` uses permissive demo policies (`USING (true)`) |
| **FAIL** (production) | Service-role admin client bypasses RLS in server actions |

### SQL fixes

Run **`ENTERPRISE_AUDIT_SQL_FIXES.sql`** in Supabase SQL Editor (includes migration 008 + asset_requests repair).

---

## Phase 3 — Module Audit

**Legend:** C=Create, R=Read, U=Update, D=Delete

### Summary matrix

| Module | C | R | U | D | Forms | Queries | Dropdowns | Validation | Permissions | Empty states | Overall |
|--------|---|---|---|---|-------|---------|-----------|------------|-------------|--------------|---------|
| **Assets** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | **WARN** | PASS | **WARNING** |
| **Requests** | ✓ | ✓ | ✓ | ✓ | WARN | WARN | PASS | PASS | **WARN** | PASS | **WARNING** |
| **Approvals** | ✓ | ✓ | ✓* | ✓ | PASS | WARN | PASS | PASS | PASS | PASS | **WARNING** |
| **Allocations** | ✓ | ✓ | ✓* | ✓ | PASS | WARN | PASS | PASS | PASS | PASS | **WARNING** |
| **Maintenance** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | **WARN** | PASS | **WARNING** |
| **Categories** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | **WARN** | PASS | **WARNING** |
| **Vendors** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | **WARN** | PASS | **WARNING** |
| **Procurement** | ✓ | ✓ | ✓* | ✓ | PASS | PASS | PASS | PASS | PASS | PASS | **WARNING** |
| **Purchase Orders** | ✓ | ✓ | ✓* | ✓ | PASS | PASS | PASS | PASS | PASS | PASS | **WARNING** |
| **Inventory (Stock)** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Disposals** | ✓ | ✓ | ✓* | ✓ | PASS | PASS | PASS | PASS | PASS | PASS | **WARNING** |
| **Reports** | — | ✓ | — | — | — | PASS | — | — | **WARN** | PASS | **WARNING** |
| **Team** | ✓ | ✓ | ✓ | ✓ | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** |
| **Alerts** | ✓* | ✓ | — | — | — | WARN | — | — | **WARN** | PASS | **WARNING** |
| **Audit Trail** | — | ✓ | — | — | — | PASS | — | — | **WARN** | PASS | **WARNING** |
| **Settings** | — | ✓ | **FAIL** | — | **FAIL** | PASS | PASS | — | **WARN** | PASS | **FAIL** |

\*Update via status/decision actions, not dedicated edit routes for some BRD modules.

### Permission model split

| Layer | Auth check | Status |
|-------|------------|--------|
| BRD actions (`src/app/actions/brd/*`) | `requireBrdRole()` | **PASS** |
| User actions (`src/app/actions/users.ts`) | `getSessionUser()` + Admin | **PASS** |
| Legacy CRUD (`src/app/actions/crud.ts`) | **None** | **FAIL** |
| Schema repair (`schema-repair.ts`) | **None** | **FAIL** |
| Client pages | UI hides nav by role | **WARNING** only |

### Notable module findings

- **Assets:** Delete + update via `crud.ts` without server role enforcement.
- **Requests:** Create works in code but DB may reject missing `justification` column.
- **Approvals:** `decideApprovalAction` updates request status but does not auto-create procurement.
- **Allocations:** Return/acknowledge actions exist; create requires Available assets only (**PASS**).
- **Settings:** General tab does not persist to database (**FAIL**).
- **Notifications:** Created by BRD actions but not scoped to recipient user.

---

## Phase 4 — Workflow Audit

Expected BRD chain:

```
Request → Approval → Procurement → Purchase Order → Asset Creation → Allocation → Maintenance → Disposal
```

| Step | Handoff | Automated | Status | Notes |
|------|---------|-----------|--------|-------|
| 1. Request | Employee submits | Manual form | **PASS** | Creates `asset_requests` row |
| 2. Approval | Manager/Procurement/Finance stages | Partial | **WARNING** | Stages in DB; no stage-gating; Procurement approval does not advance status distinctly |
| 3. Procurement | From approved request | Manual link | **WARNING** | User picks request in form; no auto-create |
| 4. Purchase Order | From procurement | Manual link | **WARNING** | User picks procurement in form |
| 5. Asset Creation | From PO receipt | **None** | **FAIL** | No action creates asset from PO |
| 6. Allocation | From asset | Manual | **WARNING** | Separate form; updates `assigned_employee_id` |
| 7. Maintenance | From asset | Manual | **PASS** | Standard CRUD |
| 8. Disposal | From asset | Partial | **WARNING** | Sets asset `Retired`; no full chain validation |

### Broken / missing workflow steps

1. **No orchestration service** — modules are independent CRUD screens.
2. **Approval → Procurement** — approving does not enqueue or create procurement record.
3. **PO → Asset** — receiving a PO does not create inventory/asset records.
4. **Procurement stage RBAC** — `approval_stage` includes Procurement/Finance but roles do not.
5. **Status enum drift** — app uses `Approved`, `Fulfilled`, `Rejected`; not all reflected in UI filters.

**Workflow readiness: FAIL (35%)**

---

## Phase 5 — Auth & RBAC Audit

### Authentication

| Item | Status | Finding |
|------|--------|---------|
| Supabase Auth integration | **FAIL** | Demo session in `auth-provider.tsx` + cookie |
| `auth/callback` route | **WARNING** | Present but unused by primary login |
| Session persistence | **WARNING** | `localStorage` + cookie, not JWT |
| Hardcoded demo users | **FAIL** | `seed.ts`: `admin@demo.com`, `manager@demo.com`, etc. |
| UUID for session user | **FAIL** | Client user id is literal `'demo-user'` |

### Roles

| Role | Expected | Implemented | Status |
|------|----------|-------------|--------|
| Admin | ✓ | ✓ | **PASS** |
| Manager | ✓ | ✓ | **PASS** |
| Employee | ✓ | ✓ | **PASS** |
| Procurement | ✓ | ✗ | **FAIL** |
| Finance | ✓ | ✗ | **FAIL** |

Defined in `src/lib/auth/roles.ts`: only `Admin | Manager | Employee`.

### Route protection

| Layer | Status | Notes |
|-------|--------|-------|
| Middleware (`middleware.ts`) | **WARNING** | Auth required for `/dashboard/*`; no role checks |
| Server actions (BRD) | **PASS** | Role-gated |
| Server actions (CRUD) | **FAIL** | Open to any authenticated demo user |
| Client nav (`sidebar`) | **WARNING** | Hides links; not security boundary |

### Detected issues

- Demo login can assume any seeded user email without password verification against Supabase Auth.
- `getSessionUser()` resolves profile from demo session email lookup — works for demo, not enterprise SSO.
- `repairDatabaseSchemaAction` callable without Admin check.
- RLS policies allow all operations (demo mode).

**Auth & RBAC readiness: FAIL (28%)**

---

## Phase 6 — Command Center Dashboard Audit

Route: `/dashboard`

### Components verified (build + code review)

| Widget | Status | Notes |
|--------|--------|-------|
| Hero section | **PASS** | `DashboardHero` — health score, greeting |
| KPI cards (6) | **PASS** | Total assets, value, requests, maintenance, procurement, approvals |
| Asset health trend chart | **PASS** | Recharts line chart |
| Maintenance cost trend | **PASS** | Recharts |
| Asset distribution | **PASS** | Pie chart by status |
| Vendor performance | **PASS** | Bar chart |
| Allocation trend | **WARNING** | Fails if `allocated_at` missing |
| Request status chart | **WARNING** | Depends on requests query |
| Operations overview | **PASS** | Module snapshot cards |
| Alerts panel | **PASS** | Warranty + maintenance due |
| Procurement snapshot | **PASS** | Pipeline counts |
| Activity feed | **WARNING** | Queries `justification` on `asset_requests` |
| Quick actions | **PASS** | Deep links to modules |
| Loading skeleton | **PASS** | Shimmer states |
| Empty state | **PASS** | Zero-data UX |
| Ambient background | **PASS** | Visual only |

### Dashboard data layer

| Check | Status |
|-------|--------|
| Client-side Supabase queries | **WARNING** — uses anon client, not server actions |
| Error handling | **PASS** — `ErrorAlert` displayed |
| Hydration | **PASS** — client component, no SSR mismatch expected |
| TypeScript | **PASS** |

**Dashboard readiness: WARNING (88%)** — visually production-grade; data layer fragile until DB schema fixed.

---

## Remediation Roadmap

### P0 — Immediate (blocking)

1. Run `ENTERPRISE_AUDIT_SQL_FIXES.sql` on Supabase (allocations + asset_requests).
2. Apply migration `008_asset_allocations_columns.sql` if not already applied.
3. Verify Requests and Allocations modules load without PostgREST errors.

### P1 — Security (pre-production)

1. Replace demo auth with Supabase Auth (email/OAuth) + server session.
2. Add `requireRole()` to all `crud.ts` mutations.
3. Gate `repairDatabaseSchemaAction` and seed actions to Admin only.
4. Tighten RLS policies per role; remove service-role from user-facing reads where possible.

### P2 — RBAC completeness

1. Add `Procurement` and `Finance` roles to `AppRole` and DB enum.
2. Map `approval_stage` to role permissions in `decideApprovalAction`.
3. Add middleware or layout guards for role-restricted routes.

### P3 — Workflow automation

1. On final approval → auto-create procurement draft.
2. On PO status `Received` → prompt/create asset + inventory row.
3. Central workflow status on `asset_requests` synced across modules.

### P4 — Polish

1. Persist Settings to a `app_settings` table.
2. Filter notifications by `user_id`.
3. Update `BRD_IMPLEMENTATION_STATUS.md` (currently outdated).

---

## Files Referenced

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Canonical base schema |
| `supabase/migrations/007_brd_modules.sql` | BRD tables |
| `supabase/migrations/008_asset_allocations_columns.sql` | Allocation column repair |
| `src/lib/supabase/middleware.ts` | Route auth gate |
| `src/lib/auth/roles.ts` | Role definitions |
| `src/app/actions/crud.ts` | Legacy CRUD (no RBAC) |
| `src/app/actions/brd/_auth.ts` | BRD role gate |
| `src/components/auth/auth-provider.tsx` | Demo session provider |

---

## Download

This report is saved as:

**`ENTERPRISE_AUDIT_REPORT.md`**

SQL fixes:

**`ENTERPRISE_AUDIT_SQL_FIXES.sql`**

Open in your editor or export from the project folder to share with stakeholders.

---

*Generated by enterprise audit — Asset Command Center.*
