import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Arena Suplementos" },
      { name: "description", content: "Receba um link seguro para redefinir a senha da sua conta." },
      { property: "og:title", content: "Recuperar senha — Arena Suplementos" },
      { property: "og:description", content: "Redefina o acesso à sua conta Arena Suplementos." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${SITE_URL}/redefinir-senha`,
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Logo />
        <Card className="mt-6 shadow-card">
          <CardContent className="p-6">
            {sent ? (
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <MailCheck className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-lg font-bold">Verifique seu e-mail</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Se existir uma conta para <strong>{email}</strong>, enviamos um link para redefinir
                  a senha.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-lg font-bold">Recuperar senha</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Informe o e-mail da sua conta para receber o link de redefinição.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar link
                </Button>
              </form>
            )}

            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para o login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
