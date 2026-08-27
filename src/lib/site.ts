/**
 * Domínio oficial da plataforma.
 * Usado para montar links públicos (indicação, cadastro, webhooks)
 * independente do ambiente em que o app estiver rodando (preview/dev).
 */
export const SITE_URL = "https://www.arenasuplementos.com";

/** Link público de cadastro com código de indicação. */
export function referralLink(referralCode: string): string {
  return `${SITE_URL}/cadastro?ref=${encodeURIComponent(referralCode)}`;
}
