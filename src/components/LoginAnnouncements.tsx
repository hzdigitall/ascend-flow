import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import blaAnuncio from "@/assets/bla-anuncio.png.asset.json";

const KEY = "arena:login-notices";

/**
 * Ao entrar (uma vez por sessão do navegador):
 * - gera as notificações fixas na aba de Notificações;
 * - mostra o anúncio do BLA em um modal com botão de fechar.
 */
export function LoginAnnouncements() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    if (typeof window === "undefined") return;
    const flag = `${KEY}:${profile.id}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");

    void (async () => {
      await supabase.rpc("push_login_notices");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(true);
    })();
  }, [profile?.id, qc]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anúncio do Bônus de Liderança Ativa"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[420px] overflow-hidden rounded-2xl border border-primary/40 shadow-card animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar anúncio"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/30 bg-black/60 text-primary-foreground backdrop-blur transition hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          src={blaAnuncio.url}
          alt="BLA — Bônus de Liderança Ativa da Arena, em breve"
          className="block h-auto max-h-[92vh] w-full object-contain"
        />
      </div>
    </div>
  );
}
