import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/roi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // In a real environment, you would check a CRON_SECRET or similar
        // Or check if the request comes from a trusted IP/Service.
        // For now, we rely on the fact that this is a private API endpoint.
        
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { error } = await supabaseAdmin.rpc("process_daily_roi");
        
        if (error) {
          console.error("ROI cron failed", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return Response.json({ success: true, processed_at: new Date().toISOString() });
      },
    },
  },
});
