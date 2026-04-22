import { CalendarDays, Clock, Loader2, Lock, Mail, Save, Shield } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileForm } from '../hooks/useProfileForm';
import { ROLE_LABELS } from '../utils/passwordPolicy';

export function MeuPerfilSection() {
  const { user, roles } = useAuth();
  const { nome, setNome, cargo, setCargo, saving, savedAt, dirty, save } = useProfileForm();

  const initials = nome.trim()
    ? nome.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">{nome || 'Usuário'}</h3>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {cargo && <Badge variant="secondary">{cargo}</Badge>}
                {roles.map((role) => (
                  <Badge key={role} variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                ))}
                {user?.email_confirmed_at && (
                  <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                    Ativo
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>
                Membro desde{' '}
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
            {user?.last_sign_in_at && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  Último acesso{' '}
                  {new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais editáveis</CardTitle>
          <CardDescription>
            Atualize como você é identificado internamente no sistema. Dados de conta e permissões ficam em blocos separados para evitar confusão.
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {savedAt
                ? `Último salvamento: ${savedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                : 'Sem alterações salvas nesta sessão.'}
            </p>
            <Button onClick={save} disabled={saving || !dirty} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {dirty ? 'Salvar perfil' : 'Perfil atualizado'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Dados corporativos e de acesso
          </CardTitle>
          <CardDescription>
            Esses dados são globais ou administrativos. Você visualiza aqui, mas a alteração não ocorre na tela pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              E-mail de acesso
            </Label>
            <div className="relative">
              <Input value={user?.email || ''} disabled className="bg-muted pr-9" />
              <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Este é o e-mail de acesso da sua conta. Não pode ser alterado por aqui.
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
    </div>
  );
}