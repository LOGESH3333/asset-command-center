# Asset Request Requester UUID Fix Report

**Date:** 2026-06-09

## Root Cause

Asset request creation was failing with:

```text
invalid input syntax for type uuid: "demo-user"
```

The request form used the client demo auth profile directly:

```text
profile.id -> "demo-user" -> asset_requests.requester_id
```

`asset_requests.requester_id` is a UUID foreign key to `public.users(id)`, so the literal string `"demo-user"` cannot be inserted.

## Fix Applied

- Moved requester resolution to the server-side `createRequestAction`.
- The request form no longer sends `requester_id`.
- `getSessionUser()` now resolves demo sessions to a real `public.users` record:
  - First by matching demo email.
  - Then by matching demo role.
  - Then by falling back to the first available user.
- If no valid user row exists, request creation returns a clear error instead of sending `"demo-user"` to Supabase.
- The request category select trigger now displays the selected category name instead of the selected UUID value.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/auth/session.ts` | Demo sessions now resolve to a real `public.users.id` for server actions. |
| `src/app/actions/crud.ts` | `createRequestAction` ignores client requester IDs and uses the resolved server profile UUID. |
| `src/app/dashboard/requests/new/page.tsx` | Removed client `requester_id` submission and displays selected category name in the trigger. |
| `src/app/actions/users.ts` | Added type-safe guard for Supabase Auth metadata when demo auth returns a simplified user object. |

## Verification Results

| Check | Result |
|-------|--------|
| `demo-user` no longer submitted by request form | Pass |
| Server action resolves requester from `public.users` | Pass |
| Category dropdown option labels use category names | Pass |
| Selected category trigger displays category name | Pass |
| Linter diagnostics on changed files | Pass |
| `npx tsc --noEmit` | Pass |

## Notes

The client demo auth provider still uses `"demo-user"` for display-only client state. That value is no longer trusted for UUID database writes.

If request creation returns `Unable to resolve a valid requester`, seed or create at least one row in `public.users`.
