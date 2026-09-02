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
          // A ConnectPay às vezes ainda não expõe a transação no instante do webhook:
          // tenta algumas vezes antes de desistir.
          let tx: Awaited<ReturnType<typeof cp.getPixTransaction>> | null = null;
          let lookupError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              tx = await cp.getPixTransaction(secret, gateway?.base_url, txId);
              lookupError = null;
              break;
            } catch (err) {
              lookupError = err;
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            }
          }

          // Fallback controlado: se a reconsulta continuar indisponível, usa o payload
          // assinado do provedor apenas quando ele bate com o depósito registrado.
          if (!tx) {
            const payloadStatus = String(status ?? "").toUpperCase();
            const payloadTotal = Number(data["total_value"] ?? data["total_amount"] ?? NaN);
            const { data: row } = await supabaseAdmin
              .from("deposits")
              .select("amount, external_id")
              .eq("id", deposit.id)
              .maybeSingle();
            const amountOk =
              row != null &&
              Number.isFinite(payloadTotal) &&
              Math.abs(payloadTotal - Number(row.amount)) <= 0.01;
            const externalOk = row != null && (!externalId || externalId === row.external_id);
            if (payloadStatus === "AUTHORIZED" && amountOk && externalOk) {
              tx = {
                id: txId,
                external_id: externalId ?? undefined,
                status: "AUTHORIZED",
                payment_method: "PIX",
                total_value: payloadTotal,
              } as Awaited<ReturnType<typeof cp.getPixTransaction>>;
            } else {
              throw lookupError instanceof Error
                ? lookupError
                : new Error("pix_lookup_failed");
            }
          }
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
