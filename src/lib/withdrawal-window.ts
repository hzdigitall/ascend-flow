/**
 * Janelas de saque (mesmas regras para PIX e USDT), no horário de Brasília:
 * - Rendimentos: segundas-feiras, das 10h às 17h.
 * - Bônus de indicação: todos os dias, das 09h às 17h.
 */
export type WithdrawWallet = "earnings" | "referral";

export interface WindowStatus {
  isOpen: boolean;
  message?: string;
}

export function checkWithdrawalWindow(wallet: WithdrawWallet): WindowStatus {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const day = now.getDay();
  const hour = now.getHours();

  if (wallet === "earnings") {
    if (day !== 1) {
      return {
        isOpen: false,
        message: "Saques de rendimentos são permitidos apenas às segundas-feiras.",
      };
    }
    if (hour < 10 || hour >= 17) {
      return {
        isOpen: false,
        message: "Saques de rendimentos são permitidos apenas entre 10h e 17h.",
      };
    }
  } else if (hour < 9 || hour >= 17) {
    return { isOpen: false, message: "Saques de bônus são permitidos apenas entre 09h e 17h." };
  }
  return { isOpen: true };
}

export const WITHDRAW_WINDOW_TEXT =
  "Rendimentos: segundas-feiras, 10h às 17h · Bônus: todos os dias, 09h às 17h (horário de Brasília).";
