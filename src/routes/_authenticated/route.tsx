import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LoginAnnouncements } from "@/components/LoginAnnouncements";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Only guard on the client: during SSR/prerender there is no session in
    // localStorage, which would wrongly bounce a logged-in user on refresh.
    if (typeof window === "undefined") return;

    let { data } = await supabase.auth.getSession();

    // Em hard refresh a sessão ainda pode estar sendo restaurada do storage.
    // Poll curto (até ~300ms) em vez de espera fixa: entra mais rápido.
    for (let i = 0; i < 6 && !data.session; i++) {
      await new Promise((r) => setTimeout(r, 50));
      data = (await supabase.auth.getSession()).data;
    }

    if (!data.session) throw redirect({ to: "/login" });

    return { user: data.session.user };
  },
  component: () => (
    <>
      <LoginAnnouncements />
      <Outlet />
    </>
  ),
});
