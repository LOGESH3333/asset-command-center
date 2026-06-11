# Procurement Authorization Fix Report

**Date:** 2026-06-09

## Error

```text
You do not have permission to perform this action.
```

## Exact Authorization Check

The procurement create action calls:

```ts
const auth = await requireBrdRole(['Admin', 'Manager']);
if (auth.error) return { error: auth.error };
```

File:

```text
src/app/actions/brd/procurement.ts
```

The error string is returned here:

```ts
if (!profile || !allowed.includes(profile.role)) {
  return { error: 'You do not have permission to perform this action.', profile: null };
}
```

File:

```text
src/app/actions/brd/_auth.ts
```

## Roles Allowed To Create Procurements

Current BRD workflow allows:

```text
Admin
Manager
```

There is no `Procurement` role in the current app role model:

```ts
export type AppRole = 'Admin' | 'Manager' | 'Employee';
```

File:

```text
src/lib/auth/roles.ts
```

If a dedicated `Procurement` role is required later, it must be added in:

- `src/lib/auth/roles.ts`
- database role constraints / seed data
- user management role dropdowns
- `canManageProcurement()`
- all BRD role gates and server actions

## Current Logged-In User Role

The UI shows the logged-in demo user as:

```text
Admin
```

However, the server-side demo resolver previously looked up `public.users` by email and returned the database row role. In the current Supabase data, the matching user row had a non-admin role, so the server saw the user as not allowed even though the UI showed Admin.

## Auth Mode In Use

The app is using **demo auth** for this flow:

- Client session comes from `localStorage` / `demo_session` cookie.
- Server session comes from the `demo_session` cookie.
- Supabase Auth is only used when no demo session exists.

Relevant files:

```text
src/lib/auth/demo-session.ts
src/lib/auth/demo-session-server.ts
src/lib/auth/session.ts
src/components/auth/auth-provider.tsx
```

## Root Cause

Demo auth had two identities:

| Layer | Role source | Result |
|-------|-------------|--------|
| Client UI | demo session cookie/localStorage | `Admin` |
| Server actions | `public.users` row matched by email | non-admin role |

The create action was correct to allow Admin, but server authorization used the database role instead of the demo-selected role. That mismatch caused `requireBrdRole(['Admin', 'Manager'])` to reject the action.

## Fix Applied

`src/lib/auth/session.ts` now resolves demo sessions as follows:

- Use a real `public.users.id` so UUID foreign keys remain valid.
- Preserve the demo session role (`Admin`, `Manager`, or `Employee`) for server-side authorization.

This makes server actions match the role shown in the UI while still using valid UUIDs for database writes.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/auth/session.ts` | Demo resolver now returns real user UUIDs with the demo-selected role for authorization. |
| `PROCUREMENT_AUTH_FIX_REPORT.md` | Added this audit report. |

## Verification Result

| Check | Result |
|-------|--------|
| Admin is in procurement create allowed roles | Pass |
| Exact denial source identified | Pass |
| Demo auth vs Supabase Auth path audited | Pass |
| Linter diagnostics on changed files | Pass |
| `npx tsc --noEmit` | Pass |

## Manual Verification Steps

1. Stay logged in as demo `Admin`.
2. Go to `/dashboard/procurement/new`.
3. Fill required fields.
4. Submit.
5. Expected result: no permission error; procurement is created as `Draft`.

If the app should enforce database roles instead of demo-selected roles, update the matching row in `public.users` to `Admin` or `Manager`.
