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
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";
import { EmailChangeDialog } from "@/components/profile/EmailChangeDialog";


export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Arena Suplementos" },
      { name: "description", content: "Seus dados cadastrais, código de indicação e preferências de contato na Arena Suplementos." },
      { property: "og:title", content: "Minha conta — Arena Suplementos" },
      { property: "og:description", content: "Seus dados cadastrais, código de indicação e preferências de contato na Arena Suplementos." },
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

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    // Validação de tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida (JPG, PNG).");
      return;
    }

    // Validação de tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    if (!profile?.id) {
      toast.error("Erro: sessão não encontrada. Faça login novamente.");
      return;
    }

    setPendingFile(file);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!profile?.id) return;

    setIsUploading(true);
    try {
      const fileName = `${profile.id}/${Date.now()}.jpg`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      // Gera uma URL assinada de longa duração (bucket privado)
      const { data, error: signError } = await supabase.storage
        .from("avatars")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 5);
      const publicUrl = data?.signedUrl;

      if (signError || !publicUrl) {
        throw new Error("Não foi possível obter a URL da imagem.");
      }

      // Atualiza o perfil com a nova URL
      await updateProfileFn({ data: { avatar_url: publicUrl } });
      toast.success("Foto de perfil atualizada!");
      setPendingFile(null);
      await refresh();
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error(error.message || "Erro ao fazer upload da imagem.");
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
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover foto.");
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
      await refresh();
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

  // Determina a URL da foto com fallbacks
  const avatarSrc = profile?.avatar_url || null;
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || "U")}&background=random&color=fff&size=128`;

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
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={profile?.full_name || "Foto de perfil"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== avatarFallback) {
                        img.src = avatarFallback;
                      }
                    }}
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
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/gif,image/webp"
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

            <p className="text-xs text-muted-foreground text-center">
              Formatos: JPG, PNG, GIF, WebP · Máx 2MB
            </p>
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
        </div>

        <Card className="md:col-span-3 shadow-card">
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
              <h3 className="text-sm font-bold mb-2">E-mail de acesso</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Para trocar o e-mail, enviaremos um código de confirmação para o novo endereço.
              </p>
              <EmailChangeDialog currentEmail={profile?.email} onChanged={refresh} />
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

      <AvatarCropDialog
        open={!!pendingFile}
        file={pendingFile}
        isSaving={isUploading}
        onCancel={() => setPendingFile(null)}
        onConfirm={handleCroppedUpload}
      />
    </UserShell>

  );
}
