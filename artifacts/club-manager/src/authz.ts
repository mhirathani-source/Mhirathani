import { useGetClubSession } from "@workspace/api-client-react";

export function useAccess() {
  const { data } = useGetClubSession();
  const active = data?.status === "active";
  const can = (...permissions: string[]) => !!active && (!!data?.isOwner || permissions.every(name => data?.permissions.includes(name)));
  return { can, isOwner: !!active && !!data?.isOwner, session: data };
}
