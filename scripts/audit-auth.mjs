/**
 * Auth audit — compare auth.users vs public.users and test sign-in.
 * Run: node scripts/audit-auth.mjs [email] [password]
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(root, file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* ignore */
    }
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const testEmail = process.argv[2]?.trim().toLowerCase();
const testPassword = process.argv[3];

const { data: authList, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listError) {
  console.error('listUsers failed', listError);
  process.exit(1);
}

const { data: profiles, error: profileError } = await admin.from('users').select('id, email, auth_id, role, status');
if (profileError) {
  console.error('profiles query failed', profileError);
  process.exit(1);
}

const profileByEmail = new Map((profiles ?? []).map((p) => [p.email?.toLowerCase(), p]));
const profileByAuthId = new Map((profiles ?? []).map((p) => [p.auth_id, p]));

const issues = [];

for (const authUser of authList.users) {
  const email = authUser.email?.toLowerCase() ?? '';
  const profile = profileByEmail.get(email) ?? profileByAuthId.get(authUser.id);
  const row = {
    email,
    authId: authUser.id,
    emailConfirmed: Boolean(authUser.email_confirmed_at),
    authCreated: authUser.created_at,
    profileId: profile?.id ?? null,
    profileRole: profile?.role ?? null,
    profileStatus: profile?.status ?? null,
    authIdLinked: profile?.auth_id === authUser.id,
    profileAuthId: profile?.auth_id ?? null,
  };

  if (!profile) {
    issues.push({ type: 'auth_without_profile', ...row });
  } else if (!profile.auth_id) {
    issues.push({ type: 'profile_missing_auth_id', ...row });
  } else if (profile.auth_id !== authUser.id) {
    issues.push({ type: 'auth_id_mismatch', ...row });
  } else if (profile.status === 'Invited') {
    issues.push({ type: 'invited_status', ...row });
  } else if (profile.status === 'Pending' || profile.status === 'Suspended') {
    issues.push({ type: 'blocked_status', ...row });
  }

  console.log(JSON.stringify({ kind: 'paired_user', ...row }));
}

for (const profile of profiles ?? []) {
  if (!profile.auth_id) {
    issues.push({
      type: 'orphan_profile_no_auth',
      email: profile.email,
      profileId: profile.id,
      role: profile.role,
      status: profile.status,
    });
  } else if (!authList.users.some((u) => u.id === profile.auth_id)) {
    issues.push({
      type: 'orphan_profile_bad_auth_id',
      email: profile.email,
      profileId: profile.id,
      auth_id: profile.auth_id,
      role: profile.role,
      status: profile.status,
    });
  }
}

console.log('\n=== ISSUES ===');
console.log(JSON.stringify(issues, null, 2));
console.log(`\nTotal auth.users: ${authList.users.length}`);
console.log(`Total public.users: ${profiles?.length ?? 0}`);
console.log(`Issue count: ${issues.length}`);

console.log('\n=== ENV ===');
console.log(
  JSON.stringify(
    {
      NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL ?? null,
      NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL ?? null,
      NEXT_PUBLIC_DEMO_AUTH: env.NEXT_PUBLIC_DEMO_AUTH ?? null,
      SUPER_ADMIN_EMAIL: env.SUPER_ADMIN_EMAIL ?? null,
    },
    null,
    2
  )
);

if (testEmail && testPassword) {
  console.log(`\n=== SIGN-IN TEST: ${testEmail} ===`);
  const { data, error } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  console.log(
    JSON.stringify(
      {
        success: !error && Boolean(data.session),
        userId: data.user?.id ?? null,
        error: error ? { message: error.message, code: error.code, status: error.status } : null,
      },
      null,
      2
    )
  );
}
