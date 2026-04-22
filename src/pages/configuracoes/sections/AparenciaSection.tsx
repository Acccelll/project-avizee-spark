import { ArrowUpRight, Moon, RotateCcw, Settings, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { SidebarMode } from '@/contexts/AppConfigContext';
import { useBrandingPreview } from '@/hooks/useBrandingPreview';
import { cn } from '@/lib/utils';
import { useAppearancePreferences } from '../hooks/useAppearancePreferences';
import { getFontLabel } from '../utils/passwordPolicy';

interface Props {
  isAdmin: boolean;
}

export function AparenciaSection({ isAdmin }: Props) {
  const ap = useAppearancePreferences();
  const { branding } = useBrandingPreview();
  const corPrimaria = branding.corPrimaria || '#6b0d0d';
  const corSecundaria = branding.corSecundaria || '#b85b2d';

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
            {ap.savedAt
              ? ` Último ajuste salvo em ${ap.savedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
              : ' Nenhum ajuste salvo nesta sessão.'}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Aparência geral</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tema de cores e espaçamento da interface.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select value={ap.theme || 'system'} onValueChange={async (v) => {
                ap.setTheme(v);
                await ap.saveThemePref(v);
                ap.markSaved();
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Claro</span></SelectItem>
                  <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Escuro</span></SelectItem>
                  <SelectItem value="system"><span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Sistema</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Densidade</Label>
              <Select value={ap.densidade} onValueChange={async (v) => {
                ap.setDensidade(v);
                await ap.saveDensidadePref(v);
                document.documentElement.dataset.density = v === 'compacta' ? 'compact' : 'comfortable';
                ap.markSaved();
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
              <Badge variant="outline">Tema: {ap.theme === 'dark' ? 'Escuro' : ap.theme === 'light' ? 'Claro' : 'Sistema'}</Badge>
              <Badge variant="outline">Densidade: {ap.densidade === 'compacta' ? 'Compacta' : 'Confortável'}</Badge>
              <Badge variant="outline">Fonte: {ap.fontScale}px</Badge>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Leitura e navegação</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Legibilidade do texto e comportamento do menu lateral.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tamanho da fonte</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {getFontLabel(ap.fontScale)} ({ap.fontScale}px)
              </span>
            </div>
            <Input
              type="range"
              min={16}
              max={22}
              step={1}
              value={ap.fontScale}
              aria-label={`Tamanho da fonte: ${getFontLabel(ap.fontScale)} (${ap.fontScale}px)`}
              onChange={async (e) => {
                const value = Number(e.target.value);
                await ap.saveFontScale(value);
                document.documentElement.style.setProperty('--base-font-size', `${value}px`);
                ap.markSaved();
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Padrão</span><span>Médio</span><span>Grande</span><span>Máximo</span>
            </div>
          </div>
        </div>

        <Separator />

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
              checked={ap.reduceMotion}
              onCheckedChange={async (checked) => {
                await ap.saveReduceMotion(checked);
                document.documentElement.classList.toggle('reduce-motion', checked);
                ap.markSaved();
              }}
            />
          </div>
        </div>

        <Separator />

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
              checked={ap.sessionKeepalive ?? false}
              onCheckedChange={(c) => ap.saveSessionKeepalive(c)}
            />
          </div>
          <div className="space-y-2">
            <Label>Avisar antes de expirar</Label>
            <Select value={String(ap.sessionWarnMinutes ?? 5)} onValueChange={(v) => ap.saveSessionWarnMinutes(Number(v))}>
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
              const active = ap.sidebarMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={async () => {
                    await ap.saveSidebarMode(opt.mode);
                    await ap.saveMenuCompacto(opt.mode !== 'fixed-expanded');
                    ap.markSaved();
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

        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-foreground font-medium">Cores institucionais (branding global)</p>
              <p className="text-xs">
                Definidas pelo administrador em <strong>Administração → Empresa</strong>. Refletem em todos os usuários.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-7 w-7 rounded-md border"
                  style={{ backgroundColor: corPrimaria }}
                  aria-label={`Cor primária atual: ${corPrimaria}`}
                />
                <span className="font-mono text-[11px] text-muted-foreground">{corPrimaria}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-7 w-7 rounded-md border"
                  style={{ backgroundColor: corSecundaria }}
                  aria-label={`Cor secundária atual: ${corSecundaria}`}
                />
                <span className="font-mono text-[11px] text-muted-foreground">{corSecundaria}</span>
              </div>
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
                <AlertDialogAction onClick={ap.reset}>Restaurar padrão</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}