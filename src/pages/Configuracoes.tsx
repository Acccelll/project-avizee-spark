import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { AlertCircle, Building2, CalendarDays, Check, CheckCircle2, Clock, Eye, EyeOff, Info, Loader2, Lock, Mail, MapPin, Moon, Palette, RotateCcw, Save, Settings, Shield, ShieldCheck, Sun, Truck, User } from 'lucide-react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserPreference } from '@/hooks/useUserPreference';
import { AppLayout } from '@/components/AppLayout';
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

interface TabNavItem {
  key: string;
  label: string;
  icon: typeof User;
}

const tabNavItems: TabNavItem[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User },
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'aparencia', label: 'Aparência', icon: Palette },
  { key: 'seguranca', label: 'Segurança', icon: Lock },
];

function hexToHslString(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  estoquista: 'Estoquista',
};

const APPEARANCE_DEFAULTS = {
  theme: 'system',
  densidade: 'confortavel',
  fontScale: 16,
  menuCompacto: true,
  reduceMotion: false,
  corPrimaria: '#6b0d0d',
  corSecundaria: '#b85b2d',
} as const;

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
  const { user, profile, roles } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('perfil');

  const [nome, setNome] = useState(profile?.nome || '');
  const [cargo, setCargo] = useState(profile?.cargo || '');
  const [savingProfile, setSavingProfile] = useState(false);

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
  const {
    value: menuCompacto,
    save: saveMenuCompacto,
    loading: loadingMenuCompacto,
  } = useUserPreference<boolean>(user?.id, 'sidebar_collapsed', true);
  const { value: densidadePref, save: saveDensidadePref } = useUserPreference<string>(user?.id, 'ui_density', 'confortavel');
  const { value: fontScale, save: saveFontScale } = useUserPreference<number>(user?.id, 'ui_font_scale', 16);
  const { value: reduceMotion, save: saveReduceMotion } = useUserPreference<boolean>(user?.id, 'ui_reduce_motion', false);

  const { value: cepEmpresa, loading: loadingCep, save: saveCepEmpresa } = useAppConfig<string>('cep_empresa', '');
  const [cepEmpresaLocal, setCepEmpresaLocal] = useState('');
  const [savingCep, setSavingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Sync local CEP state when the Supabase value loads.
  useEffect(() => {
    if (cepEmpresa) setCepEmpresaLocal(cepEmpresa);
  }, [cepEmpresa]);

  useEffect(() => {
    if (densidadePref) setDensidade(densidadePref);
  }, [densidadePref]);

  useEffect(() => {
    supabase
      .from('app_configuracoes')
      .select('chave, valor')
      .in('chave', ['theme_primary_color', 'theme_secondary_color'])
      .then(({ data }) => {
        const primary = data?.find((d) => d.chave === 'theme_primary_color')?.valor as string | undefined;
        const secondary = data?.find((d) => d.chave === 'theme_secondary_color')?.valor as string | undefined;
        if (primary) setCorPrimaria(primary);
        if (secondary) setCorSecundaria(secondary);
      });
  }, []);

  const initials = nome.trim()
    ? nome.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email || 'U').substring(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ nome, cargo }).eq('id', user.id);
      if (error) throw error;
      toast.success('Dados pessoais salvos com sucesso.');
    } catch (err: unknown) {
      console.error('[perfil] save:', err);
      toast.error('Erro ao salvar perfil.');
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
      toast.error('Erro ao alterar senha. Tente novamente.');
    }
    setChangingPassword(false);
  };

  const handleSaveCep = async () => {
    const raw = cepEmpresaLocal.replace(/\D/g, '');
    if (raw.length !== 8) {
      setCepError('O CEP deve conter exatamente 8 dígitos numéricos.');
      return;
    }
    setSavingCep(true);
    const ok = await saveCepEmpresa(raw);
    if (ok) {
      toast.success('CEP de origem padrão salvo. Será aplicado nas próximas cotações de frete.');
    } else {
      toast.error('Erro ao salvar parâmetro. Tente novamente.');
    }
    setSavingCep(false);
  };

  const handleResetAppearance = async () => {
    setTheme(APPEARANCE_DEFAULTS.theme);
    setDensidade(APPEARANCE_DEFAULTS.densidade);
    setCorPrimaria(APPEARANCE_DEFAULTS.corPrimaria);
    setCorSecundaria(APPEARANCE_DEFAULTS.corSecundaria);
    await saveDensidadePref(APPEARANCE_DEFAULTS.densidade);
    await saveFontScale(APPEARANCE_DEFAULTS.fontScale);
    await saveMenuCompacto(APPEARANCE_DEFAULTS.menuCompacto);
    await saveReduceMotion(APPEARANCE_DEFAULTS.reduceMotion);
    document.documentElement.dataset.density = APPEARANCE_DEFAULTS.densidade === 'compacta' ? 'compact' : 'comfortable';
    document.documentElement.style.setProperty('--base-font-size', `${APPEARANCE_DEFAULTS.fontScale}px`);
    document.documentElement.classList.remove('reduce-motion');
    const primaryHsl = hexToHslString(APPEARANCE_DEFAULTS.corPrimaria);
    const secondaryHsl = hexToHslString(APPEARANCE_DEFAULTS.corSecundaria);
    if (primaryHsl) document.documentElement.style.setProperty('--primary', primaryHsl);
    if (secondaryHsl) document.documentElement.style.setProperty('--secondary', secondaryHsl);
    await supabase.from('app_configuracoes').upsert(
      [
        { chave: 'theme_primary_color', valor: APPEARANCE_DEFAULTS.corPrimaria, updated_at: new Date().toISOString() },
        { chave: 'theme_secondary_color', valor: APPEARANCE_DEFAULTS.corSecundaria, updated_at: new Date().toISOString() },
      ] as any,
      { onConflict: 'chave' }
    );
    toast.success('Aparência restaurada ao padrão.');
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
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                    <Input value={user?.email || ''} disabled className="bg-muted pr-9" />
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este é o e-mail de acesso da sua conta. Para alterá-lo, utilize a seção{' '}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => setActiveSection('seguranca')}
                    >
                      Segurança
                    </button>
                    .
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

      case 'empresa':
        return (
          <div className="space-y-6">
            {/* Distinction note: operational params vs institutional data */}
            <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Esta seção gerencia <strong className="text-foreground">parâmetros operacionais</strong> usados pelo sistema em cotações, frete e integrações — não dados institucionais da empresa. Para razão social, CNPJ e endereço fiscal, acesse{' '}
                <strong className="text-foreground">Administração &gt; Empresa</strong>.
              </p>
            </div>

            {/* Operational parameters card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Parâmetros Operacionais da Empresa
                </CardTitle>
                <CardDescription>
                  Valores padrão usados pelo sistema em cotações automáticas, integrações logísticas e simulações de frete. Atuam como parâmetro inicial e podem ser sobrescritos no fluxo de cada documento, quando aplicável.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Origin ZIP group — prepared to receive future params (city/UF, logistics mode, carrier) */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Origem padrão para frete
                  </h4>
                  <div className="space-y-2 max-w-sm">
                    <Label htmlFor="cep-origem">CEP de origem padrão para cotações</Label>
                    <Input
                      id="cep-origem"
                      value={cepEmpresaLocal}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setCepEmpresaLocal(raw);
                        if (cepError && raw.length === 8) setCepError(null);
                      }}
                      placeholder="Ex: 01001000"
                      maxLength={8}
                      inputMode="numeric"
                      aria-describedby={cepError ? 'cep-error' : 'cep-help'}
                      className={cepError ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {cepError ? (
                      <p id="cep-error" className="text-xs text-destructive">{cepError}</p>
                    ) : (
                      <p id="cep-help" className="text-xs text-muted-foreground">
                        Aplicado como CEP padrão de origem nas cotações automáticas de frete e integrações logísticas.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  {cepEmpresa && (
                    <p className="text-xs text-muted-foreground">
                      Parâmetro ativo:{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{cepEmpresa}</code>
                    </p>
                  )}
                  <Button
                    onClick={handleSaveCep}
                    disabled={savingCep || loadingCep}
                    className="gap-2"
                  >
                    {savingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar parâmetro
                  </Button>
                </div>
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
                Ajuste as preferências visuais da sua conta. Essas configurações afetam apenas a interface para o seu usuário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

              {/* ── Bloco 1: Aparência geral ─────────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Aparência geral</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Tema de cores e espaçamento da interface.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select value={theme || 'system'} onValueChange={(value) => setTheme(value)}>
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
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confortavel">Confortável — mais respiro visual</SelectItem>
                        <SelectItem value="compacta">Compacta — mais informação por tela</SelectItem>
                      </SelectContent>
                    </Select>
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
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Padrão</span>
                    <span>Médio</span>
                    <span>Grande</span>
                    <span>Máximo</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Menu compacto</p>
                    <p className="text-sm text-muted-foreground">
                      Reduz a largura da barra lateral, exibindo apenas ícones. Aumenta a área útil de trabalho e a navegação permanece acessível.
                    </p>
                  </div>
                  <Switch
                    checked={menuCompacto}
                    disabled={loadingMenuCompacto}
                    onCheckedChange={async (checked) => {
                      const ok = await saveMenuCompacto(checked);
                      if (!ok) toast.error('Não foi possível salvar a preferência do menu.');
                    }}
                  />
                </div>
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
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* ── Bloco 4: Cores da interface ──────────────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Cores da interface</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cor de destaque aplicada na interface desta conta. Não altera a identidade visual corporativa global.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cor primária da interface</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={corPrimaria}
                        onChange={(e) => setCorPrimaria(e.target.value)}
                        className="h-10 w-16 p-1 cursor-pointer"
                        aria-label="Selecionar cor primária da interface"
                      />
                      <span className="text-sm text-muted-foreground font-mono">{corPrimaria}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor secundária da interface</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={corSecundaria}
                        onChange={(e) => setCorSecundaria(e.target.value)}
                        className="h-10 w-16 p-1 cursor-pointer"
                        aria-label="Selecionar cor secundária da interface"
                      />
                      <span className="text-sm text-muted-foreground font-mono">{corSecundaria}</span>
                    </div>
                  </div>
                </div>
                {/* Preview */}
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Pré-visualização</p>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md border" style={{ backgroundColor: corPrimaria }} />
                    <div className="h-8 w-8 rounded-md border" style={{ backgroundColor: corSecundaria }} />
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: corPrimaria, opacity: 0.85 }} />
                      <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: corSecundaria, opacity: 0.65 }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Primária · Secundária</span>
                  </div>
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
                        Isso vai redefinir tema, densidade, tamanho da fonte, menu compacto, animações e cores da interface para os valores originais do sistema. A alteração afeta apenas a sua conta.
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
                <Button
                  className="gap-2"
                  onClick={async () => {
                    await supabase.from('app_configuracoes').upsert(
                      [
                        { chave: 'theme_primary_color', valor: corPrimaria, updated_at: new Date().toISOString() },
                        { chave: 'theme_secondary_color', valor: corSecundaria, updated_at: new Date().toISOString() },
                      ] as any,
                      { onConflict: 'chave' }
                    );
                    const primary = hexToHslString(corPrimaria);
                    const secondary = hexToHslString(corSecundaria);
                    if (primary) document.documentElement.style.setProperty('--primary', primary);
                    if (secondary) document.documentElement.style.setProperty('--secondary', secondary);
                    toast.success('Preferências de aparência salvas.');
                  }}
                >
                  <Save className="h-4 w-4" />
                  Salvar aparência
                </Button>
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
                  Proteja sua conta com uma senha segura. Você precisará informar a senha atual para confirmar a alteração.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
    <AppLayout>
      <ModulePage title="Configurações" subtitle="Preferências pessoais da sua conta.">
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
    </AppLayout>
  );
}
