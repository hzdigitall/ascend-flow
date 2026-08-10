import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import type { Json } from "@/integrations/supabase/types";

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "").trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PIX_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response(JSON.stringify({ error: "webhook not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("x-hub-signature-256");

        if (!verifySignature(rawBody, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const reference = String(payload["reference"] ?? payload["external_reference"] ?? "");
        const externalId = String(payload["id"] ?? payload["transaction_id"] ?? "");
        const status = String(payload["status"] ?? payload["event"] ?? "").toLowerCase();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let paymentId: string | null = null;
        if (reference) {
          const { data } = await supabaseAdmin
            .from("payments")
            .select("id")
            .eq("id", reference)
            .maybeSingle();
          paymentId = data?.id ?? null;
        }
        if (!paymentId && externalId) {
          const { data } = await supabaseAdmin
            .from("payments")
            .select("id")
            .eq("external_id", externalId)
            .maybeSingle();
          paymentId = data?.id ?? null;
        }
        if (!paymentId) return new Response("Payment not found", { status: 404 });

        await supabaseAdmin
          .from("payment_events")
          .insert({ payment_id: paymentId, event_type: `webhook:${status || "unknown"}`, payload: payload as unknown as Json });

        if (["paid", "approved", "completed", "confirmed", "payment.approved"].includes(status)) {
          const { error } = await supabaseAdmin.rpc("confirm_payment", {
            _payment: paymentId,
            _payload: payload as unknown as Json,
          });
          if (error) {
            console.error("confirm_payment failed", error.message);
            return new Response("Processing error", { status: 500 });
          }
        } else if (["expired", "cancelled", "canceled", "refused"].includes(status)) {
          await supabaseAdmin
            .from("payments")
            .update({ status: status === "expired" ? "expired" : "cancelled" })
            .eq("id", paymentId)
            .eq("status", "pending");
        }

        return Response.json({ received: true });
      },
    },
  },
});
