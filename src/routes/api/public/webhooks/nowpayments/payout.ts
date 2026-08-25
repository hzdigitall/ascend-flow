import { createFileRoute } from "@tanstack/react-router";

/**
 * IPN de payouts NOWPayments (saques USDT BEP20).
 * Assinatura obrigatória em x-nowpayments-sig.
 * Reserva só é liberada em estado definitivo (rejected); failed vai para revisão.
 */
export const Route = createFileRoute("/api/public/webhooks/nowpayments/payout")({
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
        const np = await import("@/lib/nowpayments.server");
        const settle = await import("@/lib/nowpayments-settle.server");

        const signature = request.headers.get("x-nowpayments-sig");
        const valid = await np.verifyIpnSignature(supabaseAdmin, payload, signature);

        const status = payload["status"] ? String(payload["status"]) : null;
        const providerTx =
          payload["id"] === undefined ? null : String(payload["id"]);

        const eventId = await settle.recordNowWebhookEvent(supabaseAdmin, {
          eventType: `payout_${(status ?? "unknown").toLowerCase()}`,
          status,
          providerTransactionId: providerTx,
          externalId: payload["unique_external_id"]
            ? String(payload["unique_external_id"])
            : null,
          payload,
          signatureValid: valid,
        });

        if (!valid) {
          await settle.finishNowWebhookEvent(
            supabaseAdmin,
            eventId,
            "rejected",
            "invalid_signature",
          );
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const items = settle.extractPayoutItems(payload as never);
          const reasons: string[] = [];
          for (const item of items) {
            const r = await settle.applyPayoutStatus(supabaseAdmin, item, "webhook");
            reasons.push(r.reason);
          }
          await settle.finishNowWebhookEvent(
            supabaseAdmin,
            eventId,
            "processed",
            reasons.join(",").slice(0, 400),
          );
        } catch (err) {
          await settle.finishNowWebhookEvent(
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
