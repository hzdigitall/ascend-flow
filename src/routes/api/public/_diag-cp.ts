import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/_diag-cp")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cp = await import("@/lib/connectpay.server");
        const gateway = await cp.loadGateway(supabaseAdmin);
        const secret = await cp.loadSecret(supabaseAdmin);
        const base = (gateway?.base_url || "").replace(/\/+$/, "");
        const body = {
          external_id: crypto.randomUUID(),
          total_amount: 50,
          payment_method: "PIX",
          webhook_url: cp.webhookUrls(gateway).pixCashIn,
          items: [
            { id: crypto.randomUUID(), title: "Teste", price: 50, quantity: 1, is_physical: false },
          ],
          customer: {
            name: "Teste Silva",
            email: "teste@teste.com",
            phone: "11999999999",
            document_type: "CPF",
            document: "12345678909",
          },
        };
        const r = await fetch(`${base}/v1/transactions`, {
          method: "POST",
          headers: {
            "api-secret": secret,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        return Response.json({ base, status: r.status, body: (await r.text()).slice(0, 2000) });
      },
    },
  },
});
