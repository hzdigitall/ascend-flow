import { createFileRoute } from "@tanstack/react-router";

/**
 * IPN de pagamentos NOWPayments (depósitos USDT BEP20 / USDTBSC).
 * Assinatura obrigatória em x-nowpayments-sig (HMAC-SHA512, chaves ordenadas).
 * Crédito definitivo apenas em payment_status = finished.
 */
export const Route = createFileRoute("/api/public/webhooks/nowpayments/payment")({
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

        const paymentId =
          payload["payment_id"] === undefined ? null : String(payload["payment_id"]);
        const status = payload["payment_status"] ? String(payload["payment_status"]) : null;

        const eventId = await settle.recordNowWebhookEvent(supabaseAdmin, {
          eventType: `payment_${(status ?? "unknown").toLowerCase()}`,
          status,
          providerTransactionId: paymentId,
          externalId: payload["order_id"] ? String(payload["order_id"]) : null,
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
          const result = await settle.settleNowPayment(
            supabaseAdmin,
            payload as never,
            "webhook",
          );
          await settle.finishNowWebhookEvent(
            supabaseAdmin,
            eventId,
            result.credited ? "credited" : "skipped",
            result.reason,
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
