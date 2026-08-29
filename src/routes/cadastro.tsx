import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { notifyMySignup } from "@/lib/whatsapp.functions";
import { makeSignUpSchema } from "@/lib/validators";
import { useI18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { maskCPF, maskPhone, onlyDigits } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import ceoAsset from "@/assets/arena-ceo.png.asset.json";
import signupSound from "@/assets/toque-demo-1.mp3.asset.json";

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
  const { t, lang } = useI18n();
  const requireCpf = lang === "pt";
  const schema = useMemo(() => makeSignUpSchema(requireCpf), [requireCpf]);
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
    const parsed = schema.safeParse(requireCpf ? form : { ...form, cpf: "" });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
setErrors({});
    setLoading(true);
    // Pré-carrega o som dentro do gesto do usuário para liberar o autoplay
    const sound = new Audio(signupSound.url);
    const cpfDigits = requireCpf ? onlyDigits(parsed.data.cpf ?? "") : null;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: SITE_URL,
        data: {
          full_name: parsed.data.fullName,
          phone: onlyDigits(parsed.data.phone),
          cpf: cpfDigits,
          referral_code: parsed.data.referralCode?.trim().toUpperCase() || null,
        },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? t("signup.error.exists")
          : t("signup.error.generic"),
      );
      return;
    }

if (data.user || data.session) {
      try {
        await sound.play();
      } catch {
        // autoplay bloqueado: nunca bloqueia o cadastro
      }
      if (data.session) {
        try {
          await notifyMySignup({ data: undefined });
        } catch {
          // notificação opcional: nunca bloqueia o cadastro
        }
      }
      toast.success(t("signup.success"));
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
            <h1 className="mt-6 text-xl font-bold">{t("signup.sent.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("signup.sent.text", { email: form.email })}
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/login">{t("signup.sent.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-secondary lg:block">
        <img
          src={ceoAsset.url}
          alt={t("auth.hero.alt")}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center text-white">
          <h2 className="text-3xl font-extrabold leading-tight drop-shadow-md sm:text-4xl lg:text-5xl">
            {t("auth.hero.title")}
          </h2>
          <p className="mt-4 text-base text-white/90 drop-shadow sm:text-lg">
            {t("auth.hero.subtitle")}
          </p>
        </div>
        <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-sm text-white/80">
          © {new Date().getFullYear()} Arena Saúde
        </p>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="lg:hidden">
            <Logo />
          </div>
          <LanguageSwitcher className="ml-auto" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight lg:mt-0">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("signup.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("common.login")}
          </Link>
        </p>


        <Card className="mt-6 shadow-card">
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">{t("signup.fullName")}</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder={t("signup.fullNamePlaceholder")}
                />
                {errors["fullName"] ? (
                  <p className="text-xs text-destructive">{errors["fullName"]}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">{t("signup.email")}</Label>
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
                  <Label htmlFor="phone">{t("signup.phone")}</Label>
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
                {requireCpf ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf">{t("signup.cpf")}</Label>
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      value={form.cpf}
                      onChange={(e) => set("cpf", maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                    {errors["cpf"] ? <p className="text-xs text-destructive">{errors["cpf"]}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("signup.password")}</Label>
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
                      aria-label={show ? t("login.hidePassword") : t("login.showPassword")}
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
                  <Label htmlFor="confirmPassword">{t("signup.confirmPassword")}</Label>
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
                <Label htmlFor="referralCode">{t("signup.referral")}</Label>
                <Input
                  id="referralCode"
                  value={form.referralCode}
                  onChange={(e) => set("referralCode", e.target.value.toUpperCase())}
                  placeholder={t("signup.referralPlaceholder")}
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
                  {t("signup.termsPrefix")}{" "}
                  <Link to="/termos" className="font-medium text-primary hover:underline">
                    {t("signup.termsLink")}
                  </Link>{" "}
                  {t("signup.termsMiddle")}{" "}
                  <Link to="/privacidade" className="font-medium text-primary hover:underline">
                    {t("signup.privacyLink")}
                  </Link>
                  .
                </Label>
              </div>
              {errors["terms"] ? <p className="text-xs text-destructive">{errors["terms"]}</p> : null}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("signup.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
