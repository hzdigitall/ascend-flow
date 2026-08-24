import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook PIX cash-out da ConnectPay.
 * Status tratados: pending, processing, approved, failed, rejected.
 * Antes de concluir, o status é reconferido em GET /v1/cashout/{cashoutId}.
 */
export const Route = createFileRoute("/api/public/webhooks/connectpay/cashout")({
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
        const { recordWebhookEvent, finishWebhookEvent } = await import(
          "@/lib/connectpay-settle.server"
        );
        const cp = await import("@/lib/connectpay.server");

        const data = (payload["data"] ?? payload) as Record<string, unknown>;
        const providerTxId =
          String(data["id"] ?? data["cashout_id"] ?? data["cashoutId"] ?? "") || null;
        const externalId = String(data["external_id"] ?? "") || null;
        let status = String(data["status"] ?? payload["status"] ?? "").toLowerCase() || null;

        const eventId = await recordWebhookEvent(supabaseAdmin, {
          eventType: "pix_cashout",
          status,
          providerTransactionId: providerTxId,
          externalId,
          payload,
        });

        try {
          let query = supabaseAdmin.from("withdrawals").select("id, provider_transaction_id, status");
          query = externalId
            ? query.eq("external_id", externalId)
            : query.eq("provider_transaction_id", providerTxId ?? "");
          const { data: w } = await query.maybeSingle();
          if (!w) {
            await finishWebhookEvent(supabaseAdmin, eventId, "ignored", "withdrawal_not_found");
            return Response.json({ received: true });
          }

          const txId = providerTxId ?? w.provider_transaction_id;

          // Reconferência do status real na ConnectPay para ações financeiras.
          if (txId) {
            try {
              const gateway = await cp.loadGateway(supabaseAdmin);
              const secret = await cp.loadSecret(supabaseAdmin);
              const remote = await cp.getPixCashout(secret, gateway?.base_url, txId);
              if (remote.status) status = String(remote.status).toLowerCase();
            } catch {
              // mantém o status do webhook se a consulta falhar
            }
          }

          if (status === "approved") {
            await supabaseAdmin.rpc("withdrawal_complete", {
              _wid: w.id,
              _provider_tx: txId ?? "",
              _tx_hash: null as unknown as string,
              _payload: { provider_status: status, source: "webhook" } as never,
            });
          } else if (status === "failed" || status === "rejected") {
            await supabaseAdmin.rpc("withdrawal_release", {
              _wid: w.id,
              _status: status === "rejected" ? "rejected" : "failed",
              _reason: `ConnectPay retornou status ${status}.`,
              _payload: { source: "webhook" } as never,
            });
          } else {
            await supabaseAdmin.rpc("withdrawal_mark_processing", {
              _wid: w.id,
              _provider_tx: txId ?? "",
              _payload: { provider_status: status, source: "webhook" } as never,
            });
          }

          await finishWebhookEvent(supabaseAdmin, eventId, "processed", status ?? undefined);
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
