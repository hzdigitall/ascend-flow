import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook PIX cash-in da ConnectPay.
 * Endpoint público (chamado pelo provedor). Nunca confia apenas no payload:
 * o status é reconsultado em GET /v1/transactions/{transaction_id}.
 */
export const Route = createFileRoute("/api/public/webhooks/connectpay/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return Response.json({ received: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { recordWebhookEvent, finishWebhookEvent, settlePixDeposit } = await import(
          "@/lib/connectpay-settle.server"
        );
        const cp = await import("@/lib/connectpay.server");

        const data = (payload["data"] ?? payload) as Record<string, unknown>;
        const providerTxId = String(data["id"] ?? data["transaction_id"] ?? "") || null;
        const externalId = String(data["external_id"] ?? "") || null;
        const status = String(data["status"] ?? payload["status"] ?? "") || null;

        const eventId = await recordWebhookEvent(supabaseAdmin, {
          eventType: "pix_cashin",
          status,
          providerTransactionId: providerTxId,
          externalId,
          payload,
        });

        try {
          let deposit: { id: string; provider_transaction_id: string | null } | null = null;
          if (externalId) {
            const { data: row } = await supabaseAdmin
              .from("deposits")
              .select("id, provider_transaction_id")
              .eq("external_id", externalId)
              .maybeSingle();
            deposit = row ?? null;
          }
          if (!deposit && providerTxId) {
            const { data: row } = await supabaseAdmin
              .from("deposits")
              .select("id, provider_transaction_id")
              .eq("provider_transaction_id", providerTxId)
              .maybeSingle();
            deposit = row ?? null;
          }
          if (!deposit) {
            await finishWebhookEvent(supabaseAdmin, eventId, "ignored", "deposit_not_found");
            return Response.json({ received: true });
          }

          // Reconsulta obrigatória na ConnectPay antes de qualquer crédito.
          const gateway = await cp.loadGateway(supabaseAdmin);
          const secret = await cp.loadSecret(supabaseAdmin);
          const txId = providerTxId ?? deposit.provider_transaction_id;
          if (!txId) {
            await finishWebhookEvent(supabaseAdmin, eventId, "ignored", "missing_transaction_id");
            return Response.json({ received: true });
          }
          const tx = await cp.getPixTransaction(secret, gateway?.base_url, txId);
          const result = await settlePixDeposit(supabaseAdmin, deposit.id, tx, "webhook");
          await finishWebhookEvent(supabaseAdmin, eventId, result.credited ? "credited" : "skipped", result.reason);
        } catch (err) {
          await finishWebhookEvent(
            supabaseAdmin,
            eventId,
            "error",
            err instanceof Error ? err.message.slice(0, 400) : "unknown_error",
          );
        }

        return Response.json({ received: true });
      },
    },
  },
});
