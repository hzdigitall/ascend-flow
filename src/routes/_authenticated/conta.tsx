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
import { Loader2, User, Phone, CreditCard, Mail, Key, Camera, Trash2, AlertCircle } from "lucide-react";
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    cpf: profile?.cpf || "",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem válida.");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await updateProfileFn({ data: { avatar_url: publicUrl } });
      toast.success("Foto de perfil atualizada!");
      refresh();
    } catch (error: any) {
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.id) return;
    
    setIsUploading(true);
    try {
      await updateProfileFn({ data: { avatar_url: null } });
      toast.success("Foto removida com sucesso!");
      refresh();
    } catch (error: any) {
      toast.error("Erro ao remover foto: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

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
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 shadow-card h-fit">
          <CardHeader className="border-b bg-muted/30 px-6 py-4">
            <CardTitle className="text-base font-bold">Foto de Perfil</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center space-y-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 bg-muted flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.full_name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-muted-foreground" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Alterar foto"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-col w-full gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {profile?.avatar_url ? "Trocar foto" : "Adicionar foto"}
              </Button>
              
              {profile?.avatar_url && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleRemovePhoto}
                  disabled={isUploading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover foto
                </Button>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-[10px] text-muted-foreground text-center">
                Formatos aceitos: JPG, PNG. Tamanho máx: 2MB.
              </p>
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-start gap-1 p-2 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <p className="text-[9px] leading-tight">
                    Implementar validação de tipo e tamanho do arquivo da foto de perfil antes do upload e exibir mensagens de erro claras quando houver problemas.
                  </p>
                </div>
                <div className="flex items-start gap-1 p-2 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <p className="text-[9px] leading-tight">
                    Configure no meu Supabase Storage e nas policies RLS para garantir que cada usuário só possa ler e atualizar a própria foto de perfil.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
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
      </div>
    </UserShell>
  );
}
