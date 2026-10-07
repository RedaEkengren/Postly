import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "./api";

type User = { id: string; email: string };
type Tenant = { id: string; name: string; plan: string };

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: User; tenant: Tenant; role: string };

const AuthContext = React.createContext<AuthState>({ status: "loading" });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => auth.session(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const state: AuthState = isLoading
    ? { status: "loading" }
    : data?.authenticated && data.user && data.tenant
      ? { status: "authenticated", user: data.user, tenant: data.tenant, role: data.role ?? "member" }
      : { status: "unauthenticated" };

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}

export function useRequireAuth() {
  const state = useAuth();
  if (state.status !== "authenticated") {
    throw new Error("Not authenticated");
  }
  return state;
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await auth.logout();
    qc.invalidateQueries({ queryKey: ["auth"] });
  };
}
