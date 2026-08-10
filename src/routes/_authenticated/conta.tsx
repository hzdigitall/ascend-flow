import { createFileRoute } from "@tanstack/react-router";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { maskCPF, maskPhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Nexora" },
      { name: "description", content: "Seus dados cadastrais, código de indicação e preferências de contato." },
      { property: "og:title", content: "Minha conta — Nexora" },
      { property: "og:description", content: "Seus dados cadastrais, código de indicação e preferências de contato." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
  const rows = [
    { label: "Nome completo", value: profile?.full_name },
    { label: "E-mail", value: profile?.email },
    { label: "WhatsApp", value: profile?.phone ? maskPhone(profile.phone) : "—" },
    { label: "CPF", value: profile?.cpf ? maskCPF(profile.cpf) : "—" },
    { label: "Código de indicação", value: profile?.referral_code },
  ];

  return (
    <UserShell>
      <PageHeader title="Minha conta" description="Seus dados cadastrais na plataforma." />
      <Card className="shadow-card">
        <CardContent className="divide-y p-0">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-4"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="truncate text-sm font-medium">{row.value ?? "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </UserShell>
  );
}
