import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Only guard on the client: during SSR/prerender there is no session in
    // localStorage, which would wrongly bounce a logged-in user on refresh.
    if (typeof window === "undefined") return;

    let { data } = await supabase.auth.getSession();

    // On a hard refresh the session may still be restoring from storage.
    if (!data.session) {
      await new Promise((r) => setTimeout(r, 250));
      data = (await supabase.auth.getSession()).data;
    }

    if (!data.session) throw redirect({ to: "/login" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
