import { cookies } from 'next/headers';
import {
  DEMO_SESSION_COOKIE,
  verifyDemoSessionToken,
  getDemoPersonaCatalog,
} from '@/src/lib/auth/request-auth';
import { DemoRoleSwitcherClient } from './DemoRoleSwitcherClient';

export async function DemoRoleSwitcher() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyDemoSessionToken(token);
  if (!session?.persona) return null;

  return (
    <DemoRoleSwitcherClient
      currentPersona={session.persona}
      personas={getDemoPersonaCatalog()}
    />
  );
}
