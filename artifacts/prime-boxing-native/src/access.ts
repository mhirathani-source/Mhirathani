import { useGetClubSession } from '@workspace/api-client-react';

export function useClubAccess(enabled = true) {
  const query = useGetClubSession({ query: { enabled } });
  const session = query.data;
  const isOwner = session?.status === 'active' && session.isOwner;
  const can = (...permissions: string[]) =>
    !!session &&
    session.status === 'active' &&
    (!!isOwner || permissions.every((permission) => session.permissions.includes(permission)));

  return { ...query, session, isOwner, can };
}
