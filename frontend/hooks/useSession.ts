'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, type Role, type SessionUser } from '@/lib/auth';

/**
 * Client-side route guard. Reads the stored session and, if the user
 * is missing or has the wrong role, redirects to the given login page.
 * Returns null while resolving so pages can render a loading state.
 */
export function useSession(allowed: Role[], loginPath: string): SessionUser | null {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !allowed.includes(u.role)) {
      router.replace(loginPath);
      return;
    }
    setUser(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return user;
}
