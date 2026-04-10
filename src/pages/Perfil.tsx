import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Clock, Lock, Loader2, Mail, Save, Shield } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  estoquista: "Estoquista",
};

export default function Perfil() {
  const { user, profile, roles } = useAuth();
  const [nome, setNome] = useState(profile?.nome || "");
  const [cargo, setCargo] = useState(profile?.cargo || "");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const initials = nome.trim()
    ? nome.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : (user?.email || "U").substring(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ nome, cargo }).eq("id", user.id);
      if (error) throw error;
      toast.success("Dados pessoais salvos com sucesso.");
    } catch (err: any) {
      console.error("[perfil] save:", err);
      toast.error("Erro ao salvar perfil.");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
    } catch (err: any) {
      console.error("[perfil] password:", err);
      toast.error("Erro ao alterar senha.");
    }
    setChangingPassword(false);
  };

  return (
    <AppLayout>
      <ModulePage title="Meu Perfil" subtitle="Identidade pessoal e dados da sua conta no sistema">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Account summary card */}
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{nome || "Usuário"}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {cargo && <Badge variant="secondary">{cargo}</Badge>}
                  {roles.map((role) => (
                    <Badge key={role} variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  ))}
                  {user?.email_confirmed_at && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
                      Ativo
                    </Badge>
                  )}
                </div>
              </div>
              <Separator />
              <div className="w-full space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Membro desde{" "}
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                      : "—"}
                  </span>
                </div>
                {user?.last_sign_in_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      Último acesso{" "}
                      {new Date(user.last_sign_in_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Editable personal info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  Atualize as informações pessoais exibidas no sistema. Alguns dados da conta são controlados pelo sistema e não podem ser alterados por aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Gerente Comercial" />
                    <p className="text-xs text-muted-foreground">Exibido no sistema em contextos internos, quando aplicável.</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Read-only account data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Dados da Conta
                </CardTitle>
                <CardDescription>
                  Informações controladas pelo sistema. Não podem ser alteradas por aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail de acesso
                  </Label>
                  <div className="relative">
                    <Input value={user?.email || ""} disabled className="bg-muted pr-9" />
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este é o e-mail de acesso da sua conta. Para alterá-lo, utilize Configurações {">"} Segurança.
                  </p>
                </div>
                {roles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Perfil de acesso
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {ROLE_LABELS[role] ?? role}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seu perfil de acesso é gerenciado pelo administrador do sistema.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Altere sua senha de acesso ao sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-sm">
                  <Label>Nova senha</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleChangePassword} disabled={changingPassword || !newPassword} className="gap-2">
                    {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Alterar Senha
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ModulePage>
    </AppLayout>
  );
}
