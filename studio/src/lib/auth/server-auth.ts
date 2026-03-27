import { cookies, headers } from 'next/headers';
import { resolveAuthIdentityFromStores, type ResolvedAuthIdentity } from './request-auth';

export async function resolveServerAuthIdentity(): Promise<ResolvedAuthIdentity | null> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  return resolveAuthIdentityFromStores(headerStore, cookieStore);
}
