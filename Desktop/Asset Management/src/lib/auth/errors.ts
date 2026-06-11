/** Map Supabase auth errors to user-friendly messages (no technical details). */

export function mapLoginError(message: string, code?: string): string {
  const msg = message.toLowerCase();

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email_not_confirmed')
  ) {
    return 'Login failed. Please try again or contact your administrator.';
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password') ||
    msg.includes('invalid credentials')
  ) {
    return 'Invalid email or password.';
  }

  return 'Login failed. Please check your credentials and try again.';
}

export function mapSignupError(message: string): string {
  const msg = message.toLowerCase();

  if (
    msg.includes('user already registered') ||
    msg.includes('already been registered') ||
    msg.includes('already exists')
  ) {
    return 'An account with this email already exists.';
  }

  if (msg.includes('password') && (msg.includes('short') || msg.includes('least'))) {
    return 'Password must be at least 8 characters.';
  }

  if (msg.includes('valid email') || msg.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  return 'Unable to create account. Please try again.';
}

export function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  const first_name = parts[0] ?? '';
  const last_name = parts.slice(1).join(' ') || first_name;
  return { first_name, last_name };
}
