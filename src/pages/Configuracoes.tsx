import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { AlertCircle, ArrowUpRight, Building2, CalendarDays, Check, CheckCircle2, Clock, Eye, EyeOff, Info, Loader2, Lock, Mail, Moon, Palette, RotateCcw, Save, Settings, Shield, ShieldCheck, Sun, User } from 'lucide-react';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import type { SidebarMode } from '@/contexts/AppConfigContext';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getUserFriendlyError } from '@/utils/errorMessages';

interface TabNavItem {
  key: string;
  label: string;
  icon: typeof User;
}

const tabNavItems: TabNavItem[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User },
  { key: 'aparencia', label: 'Aparência', icon: Palette },
  { key: 'seguranca', label: 'Segurança', icon: Lock },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  estoquista: 'Estoquista',
};

const APPEARANCE_DEFAULTS: {
  theme: string;
  densidade: string;
  fontScale: number;
  menuCompacto: boolean;
  reduceMotion: boolean;
  corPrimaria: string;
  corSecundaria: string;
} = {
  theme: 'system',
  densidade: 'confortavel',
  fontScale: 16,
  menuCompacto: true,
  reduceMotion: false,
  corPrimaria: '#6b0d0d',
  corSecundaria: '#b85b2d',
};

function getFontLabel(scale: number): string {
  if (scale <= 16) return 'Padrão';
  if (scale <= 18) return 'Médio';
  if (scale <= 20) return 'Grande';
  return 'Máximo';
}

function getPasswordStrength(pwd: string): { label: string; level: 0 | 1 | 2 | 3; bar: string } {
  if (!pwd) return { label: '', level: 0, bar: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { label: 'Fraca', level: 1, bar: 'bg-destructive' };
  if (score <= 3) return { label: 'Média', level: 2, bar: 'bg-yellow-500' };
  return { label: 'Forte', level: 3, bar: 'bg-emerald-500' };
}

function getPasswordCriteria(pwd: string, confirm: string) {
  return [
    { key: 'length', label: 'Mínimo 8 caracteres', met: pwd.length >= 8 },
    { key: 'case', label: 'Letras maiúsculas e minúsculas', met: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) },
    { key: 'digit', label: 'Ao menos um número', met: /\d/.test(pwd) },
    { key: 'match', label: 'Confirmação idêntica', met: !!confirm && confirm === pwd },
  ] as const;
}

export default function Configuracoes() {
  const { user, profile, roles, hasRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const isValidTab = (key: string | null): key is string =>
    !!key && tabNavItems.some((t) => t.key === key);
  const activeSection = isValidTab(tabFromUrl) ? tabFromUrl : 'perfil';
  const setActiveSection = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'perfil') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const [nome, setNome] = useState(profile?.nome || '');
  const [cargo, setCargo] = useState(profile?.cargo || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<Date | null>(null);

  // Track whether the profile has been applied to the form at least once so we
  // don't overwrite intentional user edits on subsequent profile re-renders.
  const profileAppliedRef = useRef(false);

  // Synchronize form fields when profile loads asynchronously (first load only).
  useEffect(() => {
    if (profile && !profileAppliedRef.current) {
      profileAppliedRef.current = true;
      setNome(profile.nome || '');
      setCargo(profile.cargo || '');
    }
  }, [profile]);

  const isAdmin = hasRole('admin');

  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [passwordChangedAt, setPasswordChangedAt] = useState<Date | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [densidade, setDensidade] = useState('confortavel');
  const [corPrimaria, setCorPrimaria] = useState('#6b0d0d');
  const [corSecundaria, setCorSecundaria] = useState('#b85b2d');
  const [appearanceSavedAt, setAppearanceSavedAt] = useState<Date | null>(null);
  const {
    saveSidebarCollapsed: saveMenuCompacto,
  } = useAppConfigContext();
  const { value: themePref, save: saveThemePref } = useUserPreference<string>(user?.id, 'ui_theme', 'system');
  const { value: densidadePref, save: saveDensidadePref } = useUserPreference<string>(user?.id, 'ui_density', 'confortavel');
  const { value: fontScale, save: saveFontScale } = useUserPreference<number>(user?.id, 'ui_font_scale', 16);
  const { value: reduceMotion, save: saveReduceMotion } = useUserPreference<boolean>(user?.id, 'ui_reduce_motion', false);
  const { value: sessionKeepalive, save: saveSessionKeepalive } = useUserPreference<boolean>(user?.id, 'session_keepalive', false);
  const { value: sessionWarnMinutes, save: saveSessionWarnMinutes } = useUserPreference<number>(user?.id, 'session_warn_minutes', 5);
  const { sidebarMode, saveSidebarMode } = useAppConfigContext();

  useEffect(() => {
    if (densidadePref) setDensidade(densidadePref);
  }, [densidadePref]);

  useEffect(() => {
    if (themePref && theme !== themePref) setTheme(themePref);
  }, [themePref, theme, setTheme]);

  useEffect(() => {
    // Branding institucional vive em empresa_config (admin-only via Administracao.tsx).
    // Aqui apenas exibimos as cores correntes para contexto visual do usuário.
    supabase
      .from('empresa_config')
      .select('cor_primaria, cor_secundaria')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { cor_primaria?: string | null; cor_secundaria?: string | null } | null;
        if (row?.cor_primaria) setCorPrimaria(row.cor_primaria);
        if (row?.cor_secundaria) setCorSecundaria(row.cor_secundaria);
      });
  }, []);

  const initials = nome.trim()
    ? nome.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email || 'U').substring(0, 2).toUpperCase();

  const profileDirty = nome.trim() !== (profile?.nome || '').trim() || cargo.trim() !== (profile?.cargo || '').trim();

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ nome, cargo }).eq('id', user.id);
      if (error) throw error;
      setProfileSavedAt(new Date());
      toast.success('Dados pessoais salvos com sucesso.');
    } catch (err: unknown) {
      console.error('[perfil] save:', err);
      toast.error(getUserFriendlyError(err));
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    const criteria = getPasswordCriteria(newPassword, confirmPassword);
    const [lengthOk, caseOk, digitOk, matchOk] = criteria.map((c) => c.met);
    const errors: { current?: string; new?: string; confirm?: string } = {};
    if (!currentPassword) errors.current = 'Informe a senha atual';
    if (!newPassword || !lengthOk) errors.new = 'A senha deve ter pelo menos 8 caracteres';
    else if (!caseOk) errors.new = 'Use letras maiúsculas e minúsculas';
    else if (!digitOk) errors.new = 'Inclua ao menos um número';
    if (newPassword && confirmPassword && !matchOk) errors.confirm = 'As senhas não coincidem';
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    setPasswordErrors({});
    setChangingPassword(true);
    try {
      // Supabase doesn't expose a verify-only endpoint; re-authenticating with the
      // current password is the standard pattern to confirm the user knows their
      // existing credentials before allowing a password update.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordErrors({ current: 'Senha atual incorreta' });
        setChangingPassword(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangedAt(new Date());
    } catch (err: unknown) {
      console.error('[perfil] password:', err);
      toast.error(getUserFriendlyError(err));
    }
    setChangingPassword(false);
  };

  const handleResetAppearance = async () => {
    setTheme(APPEARANCE_DEFAULTS.theme);
    setDensidade(APPEARANCE_DEFAULTS.densidade);
    const results = await Promise.allSettled([
      saveThemePref(APPEARANCE_DEFAULTS.theme),
      saveDensidadePref(APPEARANCE_DEFAULTS.densidade),
      saveFontScale(APPEARANCE_DEFAULTS.fontScale),
      saveReduceMotion(APPEARANCE_DEFAULTS.reduceMotion),
      saveSidebarMode('dynamic'),
      // Mantém retrocompatibilidade: o boolean derivado do modo padrão.
      saveMenuCompacto(true),
    ]);
    document.documentElement.dataset.density = APPEARANCE_DEFAULTS.densidade === 'compacta' ? 'compact' : 'comfortable';
    document.documentElement.style.setProperty('--base-font-size', `${APPEARANCE_DEFAULTS.fontScale}px`);
    document.documentElement.classList.remove('reduce-motion');
    setAppearanceSavedAt(new Date());
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning(`Algumas preferências (${failed}) não puderam ser salvas. Tente novamente.`);
    } else {
      toast.success('Preferências de aparência restauradas ao padrão.');
    }
  };

  const markAppearanceSaved = () => {
    setAppearanceSavedAt(new Date());
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'perfil':
        return (
          <div className="space-y-6">
            {/* Account summary */}
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
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
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
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Editable personal info */}
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
                    {profileSavedAt
                      ? `Último salvamento: ${profileSavedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                      : 'Sem alterações salvas nesta sessão.'}
                  </p>
                  <Button onClick={handleSaveProfile} disabled={savingProfile || !profileDirty} className="gap-2">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {profileDirty ? 'Salvar perfil' : 'Perfil atualizado'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Read-only account data */}
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

      case 'aparencia':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Ajuste suas preferências pessoais de leitura e navegação. Tema, densidade, fonte, menu e animações afetam apenas o seu usuário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">Aplicação imediata no seu perfil</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mudanças de aparência são aplicadas em tempo real e salvas automaticamente para sua conta.
                  {appearanceSavedAt
                    ? ` Último ajuste salvo em ${appearanceSavedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
                    : ' Nenhum ajuste salvo nesta sessão.'}
                </p>
              </div>

              {/* ── Bloco 1: Aparência geral ─────────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Aparência geral</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Tema de cores e espaçamento da interface.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select value={theme || 'system'} onValueChange={async (value) => {
                      setTheme(value);
                      await saveThemePref(value);
                      markAppearanceSaved();
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Claro</span>
                        </SelectItem>
                        <SelectItem value="dark">
                          <span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Escuro</span>
                        </SelectItem>
                        <SelectItem value="system">
                          <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Sistema</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Densidade</Label>
                    <Select value={densidade} onValueChange={async (value) => {
                      setDensidade(value);
                      await saveDensidadePref(value);
                      document.documentElement.dataset.density = value === 'compacta' ? 'compact' : 'comfortable';
                      markAppearanceSaved();
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confortavel">Confortável — mais respiro visual</SelectItem>
                        <SelectItem value="compacta">Compacta — mais informação por tela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg border bg-card px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prévia rápida</p>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">Tema: {theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema'}</Badge>
                    <Badge variant="outline">Densidade: {densidade === 'compacta' ? 'Compacta' : 'Confortável'}</Badge>
                    <Badge variant="outline">Fonte: {fontScale}px</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Bloco 2: Leitura e navegação ─────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Leitura e navegação</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Legibilidade do texto e comportamento do menu lateral.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tamanho da fonte</Label>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {getFontLabel(fontScale)} ({fontScale}px)
                    </span>
                  </div>
                  <Input
                    type="range"
                    min={16}
                    max={22}
                    step={1}
                    value={fontScale}
                    aria-label={`Tamanho da fonte: ${getFontLabel(fontScale)} (${fontScale}px)`}
                    onChange={async (e) => {
                      const value = Number(e.target.value);
                      await saveFontScale(value);
                      document.documentElement.style.setProperty('--base-font-size', `${value}px`);
                      markAppearanceSaved();
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Padrão</span>
                    <span>Médio</span>
                    <span>Grande</span>
                    <span>Máximo</span>
                  </div>
                </div>
                {/*
                  O antigo switch "Menu compacto" foi removido nesta fase: a
                  preferência `sidebar_collapsed` agora é derivada
                  automaticamente do modo selecionado abaixo
                  ("Comportamento do menu lateral"), eliminando o conflito
                  entre dois controles que descreviam a mesma intenção.
                */}
              </div>

              <Separator />

              {/* ── Bloco 3: Acessibilidade ──────────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Acessibilidade</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Ajustes para reduzir desconforto visual durante o uso.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Reduzir animações</p>
                    <p className="text-sm text-muted-foreground">Minimiza transições e efeitos de movimento na interface.</p>
                  </div>
                  <Switch
                    checked={reduceMotion}
                    onCheckedChange={async (checked) => {
                      await saveReduceMotion(checked);
                      document.documentElement.classList.toggle('reduce-motion', checked);
                      markAppearanceSaved();
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* ── Sessão ─────────────────────────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Sessão</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Controle quanto tempo sua sessão permanece ativa.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Manter sessão ativa</p>
                    <p className="text-sm text-muted-foreground">Quando ligado, renova automaticamente a sessão a cada 30 min enquanto a aba estiver aberta — você não verá o aviso de expiração. Padrão: <strong>desligado</strong>, para que o aviso apareça cerca de 55 min após o login.</p>
                  </div>
                  <Switch
                    checked={sessionKeepalive ?? false}
                    onCheckedChange={(c) => saveSessionKeepalive(c)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Avisar antes de expirar</Label>
                  <Select value={String(sessionWarnMinutes ?? 5)} onValueChange={(v) => saveSessionWarnMinutes(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutos antes (≈ 55 min após login)</SelectItem>
                      <SelectItem value="15">15 minutos antes (≈ 45 min após login)</SelectItem>
                      <SelectItem value="30">30 minutos antes (≈ 30 min após login)</SelectItem>
                      <SelectItem value="60">1 hora antes (sessão de 1h: aviso imediato)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">A sessão padrão dura 1 hora. O aviso aparece o tempo escolhido antes de expirar.</p>
                </div>
              </div>

              <Separator />

              {/* ── Menu lateral (modo) ────────────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Comportamento do menu lateral</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Escolha como o menu lateral se comporta.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { mode: 'dynamic' as SidebarMode, title: 'Dinâmico', desc: 'Recolhido por padrão; expande no hover.' },
                    { mode: 'fixed-expanded' as SidebarMode, title: 'Sempre expandido', desc: 'Largura fixa de 240px.' },
                    { mode: 'fixed-collapsed' as SidebarMode, title: 'Sempre recolhido', desc: 'Apenas ícones (72px).' },
                  ]).map((opt) => {
                    const active = sidebarMode === opt.mode;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={async () => {
                          await saveSidebarMode(opt.mode);
                          // Mantém o boolean legado em sincronia com o modo
                          // (consumido por AppLayout em fallback e por outras telas).
                          await saveMenuCompacto(opt.mode !== 'fixed-expanded');
                          markAppearanceSaved();
                        }}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          active ? 'border-primary bg-primary/5' : 'hover:bg-accent/30',
                        )}
                      >
                        <p className="text-sm font-medium">{opt.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* ── Bloco 4: Branding institucional (somente leitura) ────────── */}
              {/*
                Branding (cores e logo) pertence a `empresa_config` e é gerenciado
                exclusivamente em Administração → Empresa. Aqui exibimos apenas o
                estado atual para contexto visual.
              */}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-foreground font-medium">Cores institucionais (branding global)</p>
                    <p className="text-xs">
                      Definidas pelo administrador em <strong>Administração → Empresa</strong>. Refletem em todos os usuários.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corPrimaria }} aria-label="Cor primária atual" />
                    <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corSecundaria }} aria-label="Cor secundária atual" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs">Visualização apenas informativa nesta tela pessoal.</p>
                  {isAdmin && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link to="/administracao?tab=empresa">
                        Gerenciar branding global
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Ações ────────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Restaurar padrão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurar aparência padrão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso vai redefinir tema, densidade, tamanho da fonte, menu compacto e animações para os valores originais do sistema. As cores institucionais não são alteradas — pertencem à Administração.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetAppearance}>
                        Restaurar padrão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        );

      case 'seguranca': {
        const pwdStrength = getPasswordStrength(newPassword);
        const pwdCriteria = getPasswordCriteria(newPassword, confirmPassword);
        const allCriteriaMet = pwdCriteria.every((c) => c.met);
        const canSubmit = !!currentPassword && allCriteriaMet;

        return (
          <div className="space-y-6">
            {/* ── Bloco 1: Dados de acesso ─────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Dados de acesso
                </CardTitle>
                <CardDescription>
                  Informações vinculadas à sua conta. O e-mail de acesso não pode ser alterado por aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      E-mail de acesso
                    </Label>
                    <div className="relative">
                      <Input value={user?.email || ''} disabled className="bg-muted pr-9" />
                      <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Identificador único da sua conta no sistema.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Status da conta
                    </Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                      {user?.email_confirmed_at ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Ativa e verificada</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                          <span>Aguardando verificação</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {user?.last_sign_in_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      Último acesso em{' '}
                      {new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {passwordChangedAt && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 pt-1">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Senha alterada em{' '}
                      {passwordChangedAt.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Bloco 2: Alterar senha ────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Alterar senha
                </CardTitle>
                <CardDescription>
                  Proteja sua conta com uma senha forte. A alteração exige confirmação da senha atual e é aplicada imediatamente após validação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  Para sua segurança, nunca exibimos nem armazenamos a senha atual neste formulário.
                </div>
                {/* Current password */}
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordErrors((p) => ({ ...p, current: undefined }));
                      }}
                      placeholder="Sua senha atual"
                      autoComplete="current-password"
                      className={cn('pr-10', passwordErrors.current ? 'border-destructive focus-visible:ring-destructive' : '')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showCurrentPwd ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.current && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {passwordErrors.current}
                    </p>
                  )}
                </div>

                <Separator />

                {/* New password */}
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordErrors((p) => ({ ...p, new: undefined }));
                      }}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      className={cn('pr-10', passwordErrors.new ? 'border-destructive focus-visible:ring-destructive' : '')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showNewPwd ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.new && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {passwordErrors.new}
                    </p>
                  )}

                  {/* Strength bar */}
                  {newPassword && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Força da senha</span>
                        <span className={cn(
                          'text-xs font-medium',
                          pwdStrength.level === 1 && 'text-destructive',
                          pwdStrength.level === 2 && 'text-yellow-600 dark:text-yellow-400',
                          pwdStrength.level === 3 && 'text-emerald-600 dark:text-emerald-400',
                        )}>
                          {pwdStrength.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((seg) => (
                          <div
                            key={seg}
                            className={cn(
                              'h-1.5 flex-1 rounded-full transition-colors',
                              pwdStrength.level >= seg ? pwdStrength.bar : 'bg-muted'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPwd ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordErrors((p) => ({ ...p, confirm: undefined }));
                      }}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      className={cn('pr-10', passwordErrors.confirm ? 'border-destructive focus-visible:ring-destructive' : '')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPwd ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.confirm && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {passwordErrors.confirm}
                    </p>
                  )}
                </div>

                {/* Password criteria checklist */}
                {(newPassword || confirmPassword) && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2 max-w-sm">
                    <p className="text-xs font-medium text-foreground mb-1">Critérios da senha</p>
                    {pwdCriteria.map(({ key, label, met }) => (
                      <div key={key} className={cn('flex items-center gap-2 text-xs', met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        <Check className={cn('h-3.5 w-3.5 shrink-0', met ? 'opacity-100' : 'opacity-30')} />
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !canSubmit}
                      className="gap-2"
                    >
                      {changingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {changingPassword ? 'Alterando...' : 'Alterar senha'}
                    </Button>
                    {!canSubmit && (currentPassword || newPassword || confirmPassword) && (
                      <p className="text-xs text-muted-foreground">
                        {!currentPassword ? 'Informe a senha atual para continuar.' : 'Preencha todos os critérios acima.'}
                      </p>
                    )}
                  </div>
                  {allCriteriaMet && currentPassword && !changingPassword && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Requisitos atendidos. Clique em "Alterar senha" para concluir.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Bloco 3: Orientações de segurança ────────────────── */}
            <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Boas práticas de segurança</p>
                <ul className="space-y-0.5 text-xs">
                  <li>• Use uma senha única, diferente das usadas em outros serviços.</li>
                  <li>• Evite senhas óbvias como datas de nascimento ou sequências simples.</li>
                  <li>• Não compartilhe sua senha com outras pessoas.</li>
                  <li>• Em caso de suspeita de acesso não autorizado, altere a senha imediatamente.</li>
                </ul>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <><ModulePage title="Configurações" subtitle="Preferências pessoais da sua conta.">
        <Card className="mb-6 border-dashed bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Escopo pessoal</p>
                <p className="text-sm text-muted-foreground">
                  Esta página altera apenas dados do seu usuário (perfil, aparência e segurança). Configurações globais da empresa ficam na Administração.
                </p>
              </div>
              {isAdmin ? (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to="/administracao?tab=empresa">
                    <Building2 className="h-4 w-4" />
                    Ir para configurações globais
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <Badge variant="secondary" className="h-fit">Somente administradores alteram configurações globais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Horizontal tab navigation */}
        <div role="tablist" aria-label="Seções de Configurações" className="flex gap-0 border-b overflow-x-auto mb-6 -mt-1">
          {tabNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSection(item.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Section content */}
        <div>{renderContent()}</div>
      </ModulePage>
    </>
  );
}
