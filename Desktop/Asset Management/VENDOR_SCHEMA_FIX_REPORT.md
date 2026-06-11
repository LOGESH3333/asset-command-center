# Vendor Schema Alignment Report

**Date:** 2026-06-09  
**Issue:** Vendor module failing due to schema mismatch with live `vendors` table  
**Resolution:** Updated application code to match the existing database schema (no migrations applied).

---

## Target Schema (unchanged)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `name` | TEXT | Vendor / supplier name |
| `contact_person` | TEXT | Primary contact name |
| `email` | TEXT | Primary email |
| `phone` | TEXT | Primary phone |
| `address` | TEXT | Mailing / office address |
| `contact_email` | TEXT | Legacy duplicate of email (kept in sync on write) |
| `contact_phone` | TEXT | Legacy duplicate of phone (kept in sync on write) |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

---

## Schema Mismatches Found & Fixed

| Incorrect / missing in code | Correct DB column | Fix applied |
|------------------------------|-------------------|-------------|
| Used `contact_email` as **only** write field | `email` + `contact_email` | Writes set both from form `email` |
| Used `contact_phone` as **only** write field | `phone` + `contact_phone` | Writes set both from form `phone` |
| No `contact_person` field | `contact_person` | Added to types, forms, seed, detail |
| Type omitted `email`, `phone`, `contact_person` | All exist in DB | Full `Vendor` type updated |
| `vendor-db.ts` schema fallback stripped columns | N/A — caused failed/partial inserts | Removed fallback; direct insert/update |
| Insert `.select('id, name')` only | Full row needed for UI | Changed to `.select('*')` |
| Asset detail join `contact_email, contact_phone` | `contact_person, email, phone` | Updated Supabase select |
| Seed used `contact_email` / `contact_phone` only | Canonical + legacy columns | Seed uses `contact_person`, `email`, `phone` |

**Not found in codebase (no changes needed):** `vendor_name`, `contact_name`, `vendor_email`, `vendor_phone`

---

## Field Mapping (application layer)

| UI / action field | DB column(s) written |
|-------------------|----------------------|
| Vendor Name | `name` |
| Contact Person | `contact_person` |
| Email | `email`, `contact_email` (mirrored) |
| Phone | `phone`, `contact_phone` (mirrored) |
| Address | `address` |

**Read helpers:** `getVendorEmail()` and `getVendorPhone()` prefer `email` / `phone`, falling back to `contact_email` / `contact_phone` for existing rows.

---

## Files Changed (10)

### Core types & data layer

| File | Changes |
|------|---------|
| `src/lib/supabase/vendors.ts` | Full `Vendor` type; `VendorInsert` / `VendorUpdate`; `getVendorEmail()` / `getVendorPhone()` helpers |
| `src/lib/supabase/vendor-db.ts` | Direct insert/update with canonical columns; mirrors email/phone to legacy columns; removed schema-cache fallback |
| `src/app/actions/crud.ts` | `createVendorAction` / `updateVendorAction` parameter types updated |

### Vendor UI

| File | Changes |
|------|---------|
| `src/app/dashboard/vendors/new/page.tsx` | Form: name, contact person, email, phone, address |
| `src/app/dashboard/vendors/[id]/edit/page.tsx` | Load/save via canonical fields + read helpers |
| `src/app/dashboard/vendors/[id]/page.tsx` | Detail shows contact person, email, phone |
| `src/app/dashboard/vendors/page.tsx` | List columns use `getVendorEmail()` / `getVendorPhone()` |

### Seed & cross-module

| File | Changes |
|------|---------|
| `src/app/actions/seed.ts` | Demo vendors use `contact_person`, `email`, `phone`, `address` |
| `src/app/dashboard/assets/[id]/page.tsx` | Vendor join selects `contact_person, email, phone` |

---

## Dropdown loaders verified (no changes required)

These already query `vendors(id, name)` only — compatible with schema:

| Module | File |
|--------|------|
| Assets create/edit | `src/app/actions/crud.ts`, `assets/new`, `assets/[id]/edit` |
| Maintenance | `src/lib/supabase/maintenance-db.ts`, maintenance new/edit pages |
| Procurement | `src/app/actions/brd/lookups.ts`, procurement new page |
| Purchase orders | `src/app/actions/brd/lookups.ts`, PO new page |
| Inventory | `src/app/actions/brd/lookups.ts`, inventory new/edit |
| Lookup helper | `src/lib/supabase/lookup.ts` |

---

## Verification Checklist

- [ ] Create vendor at `/dashboard/vendors/new` — succeeds without schema cache error
- [ ] List page shows email and phone for new and existing vendors
- [ ] Edit vendor — fields load and save correctly
- [ ] Delete vendor — works without error
- [ ] Asset / Maintenance / Procurement dropdowns populate vendor names
- [ ] Seed demo data — vendors insert successfully

---

## Not Modified (intentionally)

- **Database schema / migrations**
- **`schema-repair.ts`** — optional admin repair tool (legacy references to adding `contact_email` columns)
- **BRD procurement/inventory types** — nested `vendors(id, name)` joins unchanged

---

## Example create payload

```json
{
  "name": "Dell Technologies",
  "contact_person": "B2B Support",
  "email": "b2b@dell.com",
  "phone": "+1-800-999-3355",
  "address": "Round Rock, TX",
  "contact_email": "b2b@dell.com",
  "contact_phone": "+1-800-999-3355"
}
```

(`contact_email` / `contact_phone` are set automatically by the server layer.)
