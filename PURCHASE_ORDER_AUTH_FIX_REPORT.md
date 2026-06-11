# Purchase Order Authorization Fix Report

**Date:** 2026-06-09

## Error

```text
You do not have permission to perform this action.
```

## Exact Authorization Check

Purchase order creation calls:

```ts
const auth = await requireBrdRole(['Admin', 'Manager']);
if (auth.error) return { error: auth.error };
```

File:

```text
src/app/actions/brd/purchase-orders.ts
```

The error is produced by:

```ts
if (!profile || !allowed.includes(profile.role)) {
  return { error: 'You do not have permission to perform this action.', profile: null };
}
```

File:

```text
src/app/actions/brd/_auth.ts
```

## Allowed Roles

Purchase Order create/update currently allows:

```text
Admin
Manager
```

Delete allows:

```text
Admin
```

There is no separate `Procurement` role in the current role model.

## Root Cause

The app uses demo auth for this session. The client UI reads demo auth from `localStorage`, while server actions read demo auth from the `demo_session` cookie.

The sidebar showed `Admin`, but the server action could still read a stale cookie or a server-resolved profile that did not match the visible client role. That caused `requireBrdRole(['Admin', 'Manager'])` to reject the create request.

## Fix Applied

`src/components/auth/auth-provider.tsx` now rewrites the `demo_session` cookie from the current localStorage demo session whenever the auth provider loads.

This keeps:

- client UI role
- middleware session
- server action authorization

aligned.

## Files Changed

| File | Change |
|------|--------|
| `src/components/auth/auth-provider.tsx` | Sync demo session cookie from localStorage on load. |
| `src/lib/auth/session.ts` | Existing fix: preserve demo-selected role while resolving a real `users.id`. |
| `PURCHASE_ORDER_AUTH_FIX_REPORT.md` | Added this report. |

## Verification Result

| Check | Result |
|-------|--------|
| Purchase Order create allowed roles include Admin | Pass |
| Exact error source identified | Pass |
| Demo auth cookie/localStorage mismatch addressed | Pass |
| Linter diagnostics | Pass |
| `npx tsc --noEmit` | Pass |

## Manual Verification Steps

1. Hard refresh the app once so `AuthProvider` rewrites the cookie.
2. Confirm the sidebar badge shows `Admin`.
3. Go to `/dashboard/purchase-orders/new`.
4. Submit a purchase order.
5. Expected result: no permission error; purchase order is created as `Draft`.
