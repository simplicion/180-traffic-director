/**
 * Resolves the JWT signing secret strictly from the environment.
 * Throws instead of falling back to a built-in value, so a missing secret can never
 * result in tokens signed with a key that is public in source control.
 */
export function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment');
  }
  return secret;
}
