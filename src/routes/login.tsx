import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInSchema } from "@/lib/validators";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import ceoAsset from "@/assets/arena-ceo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Arena Suplementos" },
      { name: "description", content: "Acesse sua conta Arena Suplementos para ver planos, pontos e indicações." },
      { property: "og:title", content: "Entrar — Arena Suplementos" },
      { property: "og:description", content: "Acesse sua conta Arena Suplementos." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? t("login.error.invalid")
          : t("login.error.generic"),
      );
      return;
    }
    toast.success(t("login.success"));
    navigate({ to: "/dashboard", replace: true });
  };

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

      <div className="flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between gap-2">
            <div className="lg:hidden">
              <Logo />
            </div>
            <LanguageSwitcher className="ml-auto" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link to="/cadastro" className="font-medium text-primary hover:underline">
              {t("common.signup")}
            </Link>
          </p>

          <Card className="mt-6 shadow-card">
            <CardContent className="p-6">
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                  {errors["email"] ? (
                    <p className="text-xs text-destructive">{errors["email"]}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("login.password")}</Label>
                    <Link
                      to="/recuperar-senha"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("login.forgot")}
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
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

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("login.submit")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("login.agree")}{" "}
            <Link to="/termos" className="underline underline-offset-2">
              {t("common.terms")}
            </Link>{" "}
            {t("login.and")}{" "}
            <Link to="/privacidade" className="underline underline-offset-2">
              {t("login.privacyPolicy")}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
