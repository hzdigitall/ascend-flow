import { createFileRoute } from "@tanstack/react-router";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { maskCPF, maskPhone } from "@/lib/format";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/app.functions";
import { toast } from "sonner";
import { Loader2, User, Phone, CreditCard, Mail, Key, Camera, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Arena Saúde" },
      { name: "description", content: "Seus dados cadastrais, código de indicação e preferências de contato na Arena Saúde." },
      { property: "og:title", content: "Minha conta — Arena Saúde" },
      { property: "og:description", content: "Seus dados cadastrais, código de indicação e preferências de contato na Arena Saúde." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile, refresh } = useAuth();
  const updateProfileFn = useServerFn(updateProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    cpf: profile?.cpf || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProfileFn({ data: formData });
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
      refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar perfil.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 11) {
      setFormData({ ...formData, phone: val });
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 11) {
      setFormData({ ...formData, cpf: val });
    }
  };

  return (
    <UserShell>
      <PageHeader 
        title="Minha conta" 
        description="Gerencie seus dados cadastrais e informações de contato." 
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Informações Pessoais</CardTitle>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input
                    id="phone"
                    value={maskPhone(formData.phone)}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={maskCPF(formData.cpf)}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar alterações
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        full_name: profile?.full_name || "",
                        phone: profile?.phone || "",
                        cpf: profile?.cpf || "",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Nome</p>
                    <p className="text-sm font-medium">{profile?.full_name || "—"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">E-mail</p>
                    <p className="text-sm font-medium">{profile?.email || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">WhatsApp</p>
                    <p className="text-sm font-medium">{profile?.phone ? maskPhone(profile.phone) : "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">CPF</p>
                    <p className="text-sm font-medium">{profile?.cpf ? maskCPF(profile.cpf) : "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="border-b bg-muted/30 px-6 py-4">
            <CardTitle className="text-base font-bold">Segurança e Indicação</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary/10 text-secondary">
                <Key className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Código de indicação</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold tracking-widest text-primary">{profile?.referral_code || "—"}</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(profile?.referral_code || "");
                      toast.success("Código copiado!");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold mb-2">Redefinir senha</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Por motivos de segurança, a alteração de senha deve ser feita através do processo de recuperação.
              </p>
              <Button 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => toast.info("Funcionalidade em desenvolvimento.")}
              >
                Solicitar redefinição
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </UserShell>
  );
}
