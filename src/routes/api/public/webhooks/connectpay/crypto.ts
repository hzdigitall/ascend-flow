import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook crypto da ConnectPay (USDT BEP20) — depósitos e saques.
 * type: DEPOSIT | WITHDRAW | SWAP
 * status: PENDING_CONFIRMATION | PROCESSING | CONFIRMED | FAILED | CANCELED
 */
export const Route = createFileRoute("/api/public/webhooks/connectpay/crypto")({
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
        const { recordWebhookEvent, finishWebhookEvent, settleCryptoDeposit } = await import(
          "@/lib/connectpay-settle.server"
        );

        const data = (payload["data"] ?? payload) as Record<string, unknown>;
        const type = String(data["type"] ?? payload["type"] ?? "").toUpperCase();
        const status = String(data["status"] ?? payload["status"] ?? "").toUpperCase();
        const providerTxId = String(data["transaction_id"] ?? data["id"] ?? "") || null;
        const externalId = String(data["external_id"] ?? "") || null;
        const asset = String(data["asset"] ?? "USDT");
        const chain = String(data["chain"] ?? "BEP20");
        const txHash = (data["tx_hash"] ?? data["hash"] ?? null) as string | null;
        const depositAddress =
          String(data["deposit_address"] ?? data["address"] ?? "") || null;

        const amountRaw = data["amount"];
        const amount =
          amountRaw === undefined || amountRaw === null ? null : Number(amountRaw as string);

        const eventId = await recordWebhookEvent(supabaseAdmin, {
          eventType: `crypto_${type.toLowerCase() || "unknown"}`,
          status,
          providerTransactionId: providerTxId,
          externalId,
          payload,
        });

        try {
          if (type === "DEPOSIT") {
            const result = await settleCryptoDeposit(
              supabaseAdmin,
              {
                transaction_id: providerTxId ?? "",
                status,
                asset,
                chain,
                amount: amount !== null && Number.isFinite(amount) ? amount : null,
                tx_hash: txHash,
                external_id: externalId,
              },
              "webhook",
            );
            await finishWebhookEvent(
              supabaseAdmin,
              eventId,
              result.credited ? "credited" : "skipped",
              result.reason,
            );
            return Response.json({ received: true });
          }

          if (type === "WITHDRAW") {
            let query = supabaseAdmin.from("withdrawals").select("id, provider_transaction_id");
            query = externalId
              ? query.eq("external_id", externalId)
              : query.eq("provider_transaction_id", providerTxId ?? "");
            const { data: w } = await query.maybeSingle();
            if (!w) {
              await finishWebhookEvent(supabaseAdmin, eventId, "ignored", "withdrawal_not_found");
              return Response.json({ received: true });
            }
            const txId = providerTxId ?? w.provider_transaction_id ?? "";

            if (status === "CONFIRMED") {
              await supabaseAdmin.rpc("withdrawal_complete", {
                _wid: w.id,
                _provider_tx: txId,
                _tx_hash: txHash ?? (null as unknown as string),
                _payload: { provider_status: status, source: "webhook" } as never,
              });
            } else if (status === "FAILED" || status === "CANCELED") {
              await supabaseAdmin.rpc("withdrawal_release", {
                _wid: w.id,
                _status: status === "CANCELED" ? "cancelled" : "failed",
                _reason: `ConnectPay retornou status ${status}.`,
                _payload: { source: "webhook" } as never,
              });
            } else {
              await supabaseAdmin.rpc("withdrawal_mark_processing", {
                _wid: w.id,
                _provider_tx: txId,
                _payload: { provider_status: status, source: "webhook" } as never,
              });
            }
            const { notifyWithdrawalStatus } = await import("@/lib/whatsapp.server");
            await notifyWithdrawalStatus(supabaseAdmin, w.id);
            await finishWebhookEvent(supabaseAdmin, eventId, "processed", status);
            return Response.json({ received: true });
          }

          await finishWebhookEvent(supabaseAdmin, eventId, "ignored", `unsupported_type:${type}`);
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
