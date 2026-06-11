# BRD Modules — Implementation Plan

**Goal:** Increase BRD completion from **49% → 75%+**  
**Scope:** 6 new modules only (no changes to existing working modules)

---

## Priority Order

| Priority | Module | Routes | Est. BRD Impact |
|----------|--------|--------|-----------------|
| 1 | Asset Allocation | `/dashboard/allocations/*` | +8% |
| 2 | Request Approvals | `/dashboard/approvals/*` | +7% |
| 3 | Procurement | `/dashboard/procurement/*` | +6% |
| 4 | Purchase Orders | `/dashboard/purchase-orders/*` | +5% |
| 5 | Inventory | `/dashboard/inventory/*` | +5% |
| 6 | Asset Disposal | `/dashboard/disposals/*` | +5% |

**Projected BRD completion after implementation: ~75–78%**

---

## 1. Database Schema Changes

**Migration file:** `supabase/migrations/007_brd_modules.sql`

| Table | Action | Key Columns |
|-------|--------|-------------|
| `asset_allocations` | EXTEND | `status`, `acknowledged_at`, `acknowledged_by` |
| `request_approvals` | CREATE | `request_id`, `approval_stage`, `status`, `approver_id`, `comments` |
| `procurements` | CREATE | `request_id`, `title`, `status`, `vendor_id`, `estimated_cost` |
| `purchase_orders` | CREATE | `procurement_id`, `po_number`, `vendor_id`, `total_amount`, `status` |
| `inventory` | CREATE | `name`, `sku`, `quantity_on_hand`, `reorder_level`, `location` |
| `asset_disposals` | CREATE | `asset_id`, `reason`, `disposal_method`, `status`, `salvage_value` |

Also includes: indexes, `updated_at` triggers, audit triggers, demo RLS, PostgREST reload.

**Run in Supabase SQL Editor after migrations 001–006.**

---

## 2. Folder Structure

```
src/
├── app/
│   ├── actions/brd/
│   │   ├── allocations.ts
│   │   ├── approvals.ts
│   │   ├── procurement.ts
│   │   ├── purchase-orders.ts
│   │   ├── inventory.ts
│   │   └── disposals.ts
│   └── dashboard/
│       ├── allocations/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── approvals/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── procurement/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── purchase-orders/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── inventory/
│       │   ├── page.tsx
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       └── disposals/
│           ├── page.tsx
│           ├── new/page.tsx
│           └── [id]/page.tsx
├── lib/
│   ├── brd/
│   │   ├── types.ts
│   │   └── notify.ts
│   └── supabase/brd/
│       ├── allocations.ts
│       ├── approvals.ts
│       ├── procurement.ts
│       ├── purchase-orders.ts
│       ├── inventory.ts
│       └── disposals.ts
└── components/brd/
    └── role-gate.tsx
```

---

## 3. Route Structure

| Route | Method | Purpose | Role Gate |
|-------|--------|---------|-----------|
| `/dashboard/allocations` | List | Active/historical allocations | All |
| `/dashboard/allocations/new` | Create | Assign asset to employee | Manager, Admin |
| `/dashboard/allocations/[id]` | Detail | Acknowledge, return | All / Employee own |
| `/dashboard/approvals` | List | Approval queue | Manager+ |
| `/dashboard/approvals/new` | Create | Submit approval step | Manager+ |
| `/dashboard/approvals/[id]` | Detail | Approve/reject | Manager+ |
| `/dashboard/procurement` | List | Procurement cases | Manager, Admin |
| `/dashboard/procurement/new` | Create | New procurement | Manager, Admin |
| `/dashboard/procurement/[id]` | Detail/Edit | Update status | Manager, Admin |
| `/dashboard/purchase-orders` | List | PO registry | Manager, Admin |
| `/dashboard/purchase-orders/new` | Create | New PO | Manager, Admin |
| `/dashboard/purchase-orders/[id]` | Detail | Update PO status | Manager, Admin |
| `/dashboard/inventory` | List | Stock items | All (write: Manager+) |
| `/dashboard/inventory/new` | Create | Add stock item | Manager, Admin |
| `/dashboard/inventory/[id]` | Detail/Edit | Adjust quantity | Manager, Admin |
| `/dashboard/disposals` | List | Disposal requests | All |
| `/dashboard/disposals/new` | Create | Request disposal | All |
| `/dashboard/disposals/[id]` | Detail | Approve/complete | Manager, Admin |

---

## 4. UI Components Required

| Component | Path | Used By |
|-----------|------|---------|
| `BrdRoleGate` | `components/brd/role-gate.tsx` | All write pages |
| `PageHeader` | existing enterprise | All list pages |
| `EnterpriseTable` | existing | All lists |
| `EmptyState` | existing | All lists |
| `ErrorAlert` | existing | All forms |
| `SuccessToast` | existing | Create flows |
| `StatusBadge` | existing | Status columns |
| `SearchInput` | existing | Lists |
| `PaginationControls` | existing | Lists |

No new design system — reuse existing enterprise components.

---

## 5. Step-by-Step Implementation Plan

### Phase 1 — Foundation (Day 1)
1. ✅ Run `007_brd_modules.sql` on Supabase
2. ✅ Add `src/lib/brd/types.ts` — shared TypeScript types
3. ✅ Add `src/lib/brd/notify.ts` — server notification helper
4. ✅ Extend `src/lib/auth/roles.ts` — BRD role helpers (additive only)
5. ✅ Add `src/app/actions/brd/*.ts` — server mutations + RBAC checks
6. ✅ Add `src/lib/supabase/brd/*.ts` — client read queries with joins

### Phase 2 — Asset Allocation (Day 1–2)
7. List page with status filter (Active / Returned)
8. New allocation form (asset + employee dropdowns)
9. Detail page: acknowledge + return actions
10. Notifications on allocate/acknowledge/return

### Phase 3 — Request Approvals (Day 2)
11. List page with stage filter (Manager / Procurement / Finance)
12. New approval linked to request
13. Detail page: approve/reject with comments
14. Auto-notification to requester

### Phase 4 — Procurement + PO (Day 3)
15. Procurement CRUD pages
16. Link procurement to request (optional FK)
17. Purchase order CRUD linked to procurement
18. Status workflow: Draft → Submitted → Approved → Ordered → Closed

### Phase 5 — Inventory + Disposal (Day 3–4)
19. Inventory CRUD with low-stock highlight
20. Disposal request + approval workflow
21. On disposal complete → set asset status Retired (server action)

### Phase 6 — Navigation & QA (Day 4)
22. Add sidebar + mobile nav entries (additive)
23. Add command palette links
24. Run `npm run build`
25. Update `BRD_IMPLEMENTATION_STATUS.md` to v2.0

---

## Cross-Cutting Concerns

| Concern | Implementation |
|---------|----------------|
| **Audit logging** | DB triggers on all 6 tables (migration 007) |
| **Notifications** | `createBrdNotification()` called from each server action |
| **Role protection** | Server actions check role via `getSessionUser()` + `roles.ts` |
| **Validation** | Server-side required field checks in actions |
| **Loading/Error/Empty** | Same pattern as maintenance/vendors pages |

---

## Files NOT Modified (Existing Working Modules)

- `src/app/actions/crud.ts`
- `src/app/dashboard/assets/*`
- `src/app/dashboard/requests/*` (read-only integration via FK)
- `src/app/dashboard/maintenance/*`
- `src/app/dashboard/categories/*`
- `src/app/dashboard/vendors/*`
- Dashboard page, reports, settings core logic

**Only additive changes:** `sidebar.tsx`, `mobile-nav.tsx`, `roles.ts`, `command-palette.tsx` (nav links only)

---

## Deployment Checklist

- [ ] Run migrations 001–007 in Supabase SQL Editor
- [ ] Seed demo data (Settings)
- [ ] Verify each new sidebar link loads
- [ ] Test allocation acknowledge flow
- [ ] Test approval approve/reject
- [ ] Test procurement → PO link
- [ ] Test inventory low-stock display
- [ ] Test disposal approve → asset retired
