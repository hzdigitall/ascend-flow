import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  referral_code: string;
  sponsor_id: string | null;
  blocked: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
};

type Wallet = {
  main_balance: number;
  earnings_balance: number;
  referral_balance: number;
  points_balance: number;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  wallet: Wallet | null;
  isAdmin: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setLoading(false);
      // Só reconsulta em transições reais de identidade — evita refetch a cada
      // TOKEN_REFRESHED (~1x/hora e a cada foco de aba) ou INITIAL_SESSION.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["account"] });
      } else if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: ["account"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession((current) => current ?? data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);


  const userId = session?.user.id ?? null;

  const { data } = useQuery({
    queryKey: ["account", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profileRes, walletRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        profile: (profileRes.data as Profile | null) ?? null,
        wallet: walletRes.data
          ? {
              main_balance: Number(walletRes.data.main_balance),
              earnings_balance: Number(walletRes.data.earnings_balance),
              referral_balance: Number(walletRes.data.referral_balance),
              points_balance: Number(walletRes.data.points_balance),
            }
          : null,
        isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      profile: data?.profile ?? null,
      wallet: data?.wallet ?? null,
      isAdmin: data?.isAdmin ?? false,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["account"] }),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    }),
    [session, loading, data, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
