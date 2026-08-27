/**
 * Automação de mensagens WhatsApp via PlugSend (server-only).
 *
 * Endpoint: POST https://plugsend.uazapi.com/send/text
 * Header: token (armazenado cifrado em public.whatsapp_settings)
 *
 * Nunca é chamado a partir do frontend: o token jamais é exposto ao navegador.
 */
import { decryptSecret } from "./gateway-vault.server";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export const PLUGSEND_URL = "https://plugsend.uazapi.com/send/text";

export type WhatsappEvent = "deposit" | "withdrawal" | "referral" | "commission";

export type WhatsappConfig = {
  enabled: boolean;
  notify_deposit: boolean;
  notify_withdrawal: boolean;
  notify_referral: boolean;
  notify_commission: boolean;
  token_ciphertext: string | null;
  token_iv: string | null;
  token_last_four: string | null;
};

export async function loadWhatsappConfig(admin: AdminClient): Promise<WhatsappConfig | null> {
  const { data } = await admin
    .from("whatsapp_settings")
    .select(
      "enabled, notify_deposit, notify_withdrawal, notify_referral, notify_commission, token_ciphertext, token_iv, token_last_four",
    )
    .eq("id", true)
    .maybeSingle();
  return (data as WhatsappConfig | null) ?? null;
}

export async function loadWhatsappToken(admin: AdminClient): Promise<string | null> {
  const config = await loadWhatsappConfig(admin);
  if (!config?.token_ciphertext || !config.token_iv) return null;
  return decryptSecret(config.token_ciphertext, config.token_iv);
}

/** Normaliza para o formato internacional exigido pela PlugSend (somente dígitos). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return withCountry.length >= 12 && withCountry.length <= 15 ? withCountry : null;
}

export async function sendWhatsappText(
  token: string,
  phone: string,
  text: string,
): Promise<{ success: boolean; status: number; body: unknown }> {
  const response = await fetch(PLUGSEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: phone.replace(/\D/g, ""), text, linkPreview: true }),
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { success: response.ok, status: response.status, body };
}

const flagKey: Record<WhatsappEvent, keyof WhatsappConfig> = {
  deposit: "notify_deposit",
  withdrawal: "notify_withdrawal",
  referral: "notify_referral",
  commission: "notify_commission",
};

/**
 * Envia a mensagem para um usuário respeitando os interruptores do admin
 * e a preferência individual (profiles.notify_whatsapp). Nunca lança erro:
 * a automação jamais pode quebrar um fluxo financeiro.
 */
export async function notifyUserWhatsapp(
  admin: AdminClient,
  userId: string,
  event: WhatsappEvent,
  text: string,
): Promise<void> {
  try {
    const config = await loadWhatsappConfig(admin);
    if (!config?.enabled) return;
    if (config[flagKey[event]] !== true) return;
    if (!config.token_ciphertext || !config.token_iv) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, notify_whatsapp")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.notify_whatsapp === false) return;

    const phone = normalizePhone(profile.phone);
    if (!phone) return;

    const token = await decryptSecret(config.token_ciphertext, config.token_iv);
    await sendWhatsappText(token, phone, text.replace("{nome}", firstName(profile.full_name)));
  } catch {
    // silencioso por design
  }
}

export function firstName(fullName: string | null | undefined): string {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "cliente";
}

function money(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ */
/* Eventos do sistema                                                  */
/* ------------------------------------------------------------------ */

/** Depósito confirmado (PIX ou USDT BEP20) + comissões geradas por ele. */
export async function notifyDepositCredited(admin: AdminClient, depositId: string): Promise<void> {
  try {
    const { data: deposit } = await admin
      .from("deposits")
      .select("user_id, currency, amount, brl_amount, method, payment_id")
      .eq("id", depositId)
      .maybeSingle();
    if (!deposit) return;

    const detail =
      deposit.currency === "USDT"
        ? `${money(deposit.amount)} USDT (BEP20) — R$ ${money(deposit.brl_amount)}`
        : `R$ ${money(deposit.brl_amount ?? deposit.amount)} via PIX`;

    await notifyUserWhatsapp(
      admin,
      deposit.user_id,
      "deposit",
      `✅ *Depósito confirmado!*\n\nOlá {nome}, recebemos seu depósito de ${detail}.\nO valor já está disponível na sua conta Arena Saúde.`,
    );

    if (deposit.payment_id) await notifyCommissionsForPayment(admin, deposit.payment_id);
  } catch {
    /* silencioso */
  }
}

/** Comissões de indicação geradas por um pagamento confirmado. */
export async function notifyCommissionsForPayment(
  admin: AdminClient,
  paymentId: string,
): Promise<void> {
  try {
    const { data: rows } = await admin
      .from("commissions")
      .select("sponsor_id, referred_id, level, amount")
      .eq("payment_id", paymentId);
    if (!rows?.length) return;

    for (const row of rows) {
      const { data: referred } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", row.referred_id)
        .maybeSingle();
      await notifyUserWhatsapp(
        admin,
        row.sponsor_id,
        "commission",
        `💰 *Nova comissão recebida!*\n\nOlá {nome}, você recebeu R$ ${money(row.amount)} de comissão (nível ${row.level}) referente a ${firstName(referred?.full_name)} da sua rede.`,
      );
    }
  } catch {
    /* silencioso */
  }
}

/** Atualização de status de saque (PIX ou USDT). */
export async function notifyWithdrawalStatus(
  admin: AdminClient,
  withdrawalId: string,
): Promise<void> {
  try {
    const { data: w } = await admin
      .from("withdrawals")
      .select("user_id, status, amount, net_amount, currency, method, network, reject_reason, failure_reason")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (!w) return;

    const value =
      w.currency === "USDT"
        ? `${money(w.net_amount ?? w.amount)} USDT (${w.network ?? "BEP20"})`
        : `R$ ${money(w.net_amount ?? w.amount)}`;

    let text: string | null = null;
    switch (w.status) {
      case "pending":
      case "reviewing":
        text = `📨 *Saque solicitado*\n\nOlá {nome}, recebemos sua solicitação de saque de ${value}. Você será avisado assim que for processado.`;
        break;
      case "processing":
      case "submitting":
        text = `⏳ *Saque em processamento*\n\nOlá {nome}, seu saque de ${value} está sendo processado.`;
        break;
      case "paid":
        text = `✅ *Saque pago!*\n\nOlá {nome}, seu saque de ${value} foi enviado com sucesso.`;
        break;
      case "rejected":
        text = `❌ *Saque recusado*\n\nOlá {nome}, seu saque de ${value} foi recusado.${w.reject_reason ? `\nMotivo: ${w.reject_reason}` : ""}\nO valor foi devolvido ao seu saldo.`;
        break;
      case "failed":
      case "cancelled":
        text = `⚠️ *Saque não concluído*\n\nOlá {nome}, seu saque de ${value} não pôde ser concluído.${w.failure_reason ? `\nMotivo: ${w.failure_reason}` : ""}\nO valor foi devolvido ao seu saldo.`;
        break;
      default:
        text = null;
    }
    if (!text) return;
    await notifyUserWhatsapp(admin, w.user_id, "withdrawal", text);
  } catch {
    /* silencioso */
  }
}

/** Nova indicação direta cadastrada — avisa o patrocinador de nível 1. */
export async function notifyReferralRegistered(
  admin: AdminClient,
  newUserId: string,
): Promise<void> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, sponsor_id")
      .eq("id", newUserId)
      .maybeSingle();
    if (!profile?.sponsor_id) return;

    await notifyUserWhatsapp(
      admin,
      profile.sponsor_id,
      "referral",
      `🎉 *Nova indicação na sua rede!*\n\nOlá {nome}, ${firstName(profile.full_name)} acabou de se cadastrar usando o seu link de indicação.`,
    );
  } catch {
    /* silencioso */
  }
}
