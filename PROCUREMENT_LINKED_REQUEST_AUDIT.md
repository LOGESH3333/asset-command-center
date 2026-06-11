# Procurement Linked Request Dropdown Audit

**Date:** 2026-06-09

## Query Executed

The procurement form loads linked requests through:

```ts
supabaseAdmin
  .from('asset_requests')
  .select('id, justification, status')
  .order('created_at', { ascending: false })
```

File:

```text
src/app/actions/brd/lookups.ts
```

## Live Supabase Results

Direct service-role diagnostic query returned:

| Check | Result |
|------|--------|
| `users` count | `2` |
| `asset_requests` count | `0` |
| `asset_requests` rows returned by procurement lookup | `0` |
| `asset_requests` lookup error | `null` |
| `asset_categories` rows returned | `1` (`Laptops`) |
| `procurements` count | `0` |

## Is The Query Filtered By Status?

No.

The procurement lookup does **not** filter by `status`. It returns any request status as long as the row exists.

## Are Approved Requests Required?

No.

The current procurement form does not require requests to be approved before displaying them. It loads:

```text
id, justification, status
```

for every row in `asset_requests`.

## Why The Dropdown Only Shows None

The dropdown only shows `None` because the live `asset_requests` table currently has **0 records**.

The table is empty because request creation previously failed with:

```text
invalid input syntax for type uuid: "demo-user"
```

That happened because the browser demo auth profile had:

```text
profile.id = "demo-user"
```

and the request form sent it directly to:

```text
asset_requests.requester_id
```

which is a UUID foreign key to:

```text
public.users(id)
```

## Fixes Applied

| File | Fix |
|------|-----|
| `src/lib/auth/session.ts` | Demo sessions now resolve to a real `public.users.id` server-side. |
| `src/app/actions/crud.ts` | `createRequestAction` ignores browser-supplied requester IDs and uses the server-resolved UUID. |
| `src/app/dashboard/requests/new/page.tsx` | Request form no longer sends `requester_id`; category trigger displays category name. |
| `src/app/actions/users.ts` | Type-safe Supabase Auth metadata guard for demo user compatibility. |
| `src/app/actions/brd/lookups.ts` | Lookup errors now include `categories`, `requests`, and `procurements`, not just assets/users/vendors. |
| `src/app/dashboard/procurement/new/page.tsx` | Selected linked request trigger now displays the request justification instead of a UUID. |

## Verification Results

| Verification | Result |
|-------------|--------|
| Procurement request loader query audited | Pass |
| Request loader status filter checked | Pass — no status filter |
| Approved-only requirement checked | Pass — not required |
| Live `asset_requests` count checked | Pass — `0` records |
| Linter diagnostics on changed files | Pass |
| `npx tsc --noEmit` | Pass |

## Manual Verification Steps

1. Go to `/dashboard/requests/new`.
2. Submit an asset request.
3. Confirm it redirects to `/dashboard/requests` without the `demo-user` UUID error.
4. Go to `/dashboard/procurement/new`.
5. Open **Linked Request**.
6. The newly created request should appear by justification text.
7. Select it and confirm the select trigger displays the justification, not the UUID.

## Notes

I did not insert a verification row directly into Supabase because that would mutate shared database data. The code path is fixed and type-checked; once a request is created through the app, the procurement dropdown query will return it.
