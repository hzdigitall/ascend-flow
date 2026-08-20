import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signUpSchema } from "@/lib/validators";
import { maskCPF, maskPhone, onlyDigits } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/cadastro")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Criar conta — Arena Saúde" },
      {
        name: "description",
        content: "Crie sua conta na Arena Saúde e comece a acumular pontos, indicar amigos e resgatar prêmios.",
      },
      { property: "og:title", content: "Criar conta — Arena Saúde" },
      { property: "og:description", content: "Cadastre-se na Arena Saúde em menos de um minuto." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    cpf: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
    terms: false,
  });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (search.ref) setForm((f) => ({ ...f, referralCode: search.ref!.toUpperCase() }));
  }, [search.ref]);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.fullName,
          phone: onlyDigits(parsed.data.phone),
          cpf: onlyDigits(parsed.data.cpf),
          referral_code: parsed.data.referralCode?.trim().toUpperCase() || null,
        },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Este e-mail já está cadastrado."
          : "Não foi possível criar sua conta. Tente novamente.",
      );
      return;
    }

    if (data.user || data.session) {
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="p-8 text-center">
            <Logo className="justify-center" />
            <h1 className="mt-6 text-xl font-bold">Confirmação enviada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos um link de acesso para <strong>{form.email}</strong>. Por favor, verifique sua caixa de entrada para continuar.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Criar sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>

        <Card className="mt-6 shadow-card">
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Maria da Silva"
                />
                {errors["fullName"] ? (
                  <p className="text-xs text-destructive">{errors["fullName"]}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="voce@email.com"
                />
                {errors["email"] ? (
                  <p className="text-xs text-destructive">{errors["email"]}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => set("phone", maskPhone(e.target.value))}
                    placeholder="(11) 90000-0000"
                  />
                  {errors["phone"] ? (
                    <p className="text-xs text-destructive">{errors["phone"]}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    value={form.cpf}
                    onChange={(e) => set("cpf", maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                  {errors["cpf"] ? <p className="text-xs text-destructive">{errors["cpf"]}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      className="pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors["password"] ? (
                    <p className="text-xs text-destructive">{errors["password"]}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type={show ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    placeholder="••••••••"
                  />
                  {errors["confirmPassword"] ? (
                    <p className="text-xs text-destructive">{errors["confirmPassword"]}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="referralCode">Código de indicação (opcional)</Label>
                <Input
                  id="referralCode"
                  value={form.referralCode}
                  onChange={(e) => set("referralCode", e.target.value.toUpperCase())}
                  placeholder="EX: ABC12345"
                />
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white border border-[var(--color-border)] p-3">
                <Checkbox
                  id="terms"
                  checked={form.terms}
                  onCheckedChange={(v) => set("terms", v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-xs font-normal leading-relaxed">
                  Li e aceito os{" "}
                  <Link to="/termos" className="font-medium text-primary hover:underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" className="font-medium text-primary hover:underline">
                    Política de Privacidade
                  </Link>
                  .
                </Label>
              </div>
              {errors["terms"] ? <p className="text-xs text-destructive">{errors["terms"]}</p> : null}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
