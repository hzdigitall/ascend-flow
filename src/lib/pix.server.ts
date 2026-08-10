/**
 * Adaptador de gateway PIX.
 *
 * As credenciais ficam exclusivamente em variáveis de ambiente do servidor:
 *   PIX_GATEWAY_URL    -> endpoint de criação de cobrança do provedor
 *   PIX_GATEWAY_TOKEN  -> token/secret key do provedor
 *   PIX_WEBHOOK_SECRET -> segredo compartilhado para validar o webhook
 *
 * Enquanto o gateway não estiver configurado, a criação de cobrança falha de
 * forma explícita (nenhum QR Code falso é gerado).
 */
export type PixCharge = {
  externalId: string;
  copyPaste: string;
  qrCodeImage: string | null;
  expiresAt: string;
};

export function isPixGatewayConfigured(): boolean {
  return Boolean(process.env["PIX_GATEWAY_URL"] && process.env["PIX_GATEWAY_TOKEN"]);
}

export async function createPixCharge(input: {
  paymentId: string;
  amount: number;
  description: string;
  payerName: string;
  payerEmail: string;
  payerDocument: string | null;
  expiresInMinutes: number;
  webhookUrl: string;
}): Promise<PixCharge> {
  const url = process.env["PIX_GATEWAY_URL"];
  const token = process.env["PIX_GATEWAY_TOKEN"];

  if (!url || !token) {
    throw new Error(
      "Gateway PIX não configurado. Cadastre PIX_GATEWAY_URL e PIX_GATEWAY_TOKEN nos secrets do projeto.",
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reference: input.paymentId,
      amount: Number(input.amount.toFixed(2)),
      description: input.description,
      expires_in: input.expiresInMinutes * 60,
      notification_url: input.webhookUrl,
      payer: {
        name: input.payerName,
        email: input.payerEmail,
        document: input.payerDocument,
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`PIX gateway error [${response.status}]: ${raw}`);
    throw new Error(`Falha ao gerar cobrança PIX [${response.status}]`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Resposta inválida do gateway PIX");
  }

  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = key.split(".").reduce<unknown>((acc, part) => {
        if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
        return undefined;
      }, data);
      if (typeof value === "string" && value.length > 0) return value;
    }
    return null;
  };

  const copyPaste = pick("qr_code", "pix_copy_paste", "emv", "point_of_interaction.transaction_data.qr_code");
  const externalId = pick("id", "transaction_id", "charge_id") ?? input.paymentId;

  if (!copyPaste) {
    throw new Error("O gateway PIX não retornou o código copia e cola");
  }

  return {
    externalId,
    copyPaste,
    qrCodeImage: pick(
      "qr_code_base64",
      "qr_code_image",
      "point_of_interaction.transaction_data.qr_code_base64",
    ),
    expiresAt:
      pick("expires_at", "expiration_date") ??
      new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
  };
}
