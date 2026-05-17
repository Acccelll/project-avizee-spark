import { ArrowUpRight, Check, Moon, RotateCcw, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import type { SidebarMode } from '@/contexts/AppConfigContext';
import { useBrandingPreview } from '@/hooks/useBrandingPreview';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAppearancePreferences } from '../hooks/useAppearancePreferences';
import { getFontLabel } from '../utils/passwordPolicy';
import { useHelpProgress } from '@/hooks/useHelpProgress';
import { toast } from 'sonner';

interface Props {
  isAdmin: boolean;
}

export function AparenciaSection({ isAdmin }: Props) {
  const ap = useAppearancePreferences();
  const { branding } = useBrandingPreview();
  const isMobile = useIsMobile();
  const help = useHelpProgress();
  const corPrimaria = branding.corPrimaria || '#6b0d0d';
  const corSecundaria = branding.corSecundaria || '#b85b2d';
  const [fontPreview, setFontPreview] = useState<number>(ap.fontScale);
  const [previousFontScale, setPreviousFontScale] = useState<number | null>(null);

  // Conteúdo de cada grupo isolado para reuso entre Accordion (mobile) e layout linear (desktop).
  const grupoAparencia = (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tema</Label>
          <Select value={ap.theme || 'system'} onValueChange={async (v) => {
            ap.setTheme(v);
            await ap.saveThemePref(v);
            ap.markSaved();
          }}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
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
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="confortavel">Confortável — mais respiro visual</SelectItem>
              <SelectItem value="compacta">Compacta — mais informação por tela</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prévia de layout</p>
        <div className="space-y-1 rounded-md border bg-background overflow-hidden">
          {['Fornecedor ABC', 'Distribuidora XYZ', 'Empresa Modelo'].map((name, i) => (
            <div
              key={name}
              className={cn(
                'flex items-center justify-between border-b last:border-b-0',
                ap.densidade === 'compacta' ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm',
              )}
            >
              <span className="truncate">{name}</span>
              <span className="tabular-nums text-muted-foreground">
                R$ {(1200 * (i + 1)).toLocaleString('pt-BR')},00
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Espaçamento: {ap.densidade === 'compacta' ? 'Compacto' : 'Confortável'} · Fonte: {ap.fontScale}px
        </p>
      </div>
    </div>
  );

  const grupoLeitura = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Tamanho da fonte</Label>
        <span className="text-sm text-muted-foreground tabular-nums">
          {getFontLabel(fontPreview)} ({fontPreview}px)
        </span>
      </div>
      <Slider
        min={16}
        max={22}
        step={1}
        value={[fontPreview]}
        aria-label={`Tamanho da fonte: ${getFontLabel(fontPreview)} (${fontPreview}px)`}
        onValueChange={([value]) => setFontPreview(value)}
        onValueCommit={async ([value]) => {
          if (value !== ap.fontScale) {
            setPreviousFontScale(ap.fontScale);
            await ap.saveFontScale(value);
            document.documentElement.style.setProperty('--base-font-size', `${value}px`);
            ap.markSaved();
          }
        }}
        className="py-2"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Padrão</span><span>Médio</span><span>Grande</span><span>Máximo</span>
      </div>
      <div
        className="rounded-md border bg-muted/30 px-3 py-2 text-foreground"
        style={{ fontSize: `${fontPreview}px`, lineHeight: 1.4 }}
      >
        Aa — Texto de amostra ({fontPreview}px): "Pedido #1234 — Cliente ABC"
      </div>
      {previousFontScale !== null && previousFontScale !== ap.fontScale && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            await ap.saveFontScale(previousFontScale);
            document.documentElement.style.setProperty('--base-font-size', `${previousFontScale}px`);
            setFontPreview(previousFontScale);
            setPreviousFontScale(null);
            ap.markSaved();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Desfazer (voltar para {previousFontScale}px)
        </Button>
      )}
    </div>
  );

  const grupoAcessibilidade = (
    <button
      type="button"
      onClick={async () => {
        const next = !ap.reduceMotion;
        await ap.saveReduceMotion(next);
        document.documentElement.classList.toggle('reduce-motion', next);
        ap.markSaved();
      }}
      className="flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/30 min-h-11"
      aria-pressed={ap.reduceMotion}
    >
      <div className="min-w-0">
        <p className="font-medium">Reduzir animações</p>
        <p className="text-sm text-muted-foreground">Minimiza transições e efeitos de movimento na interface.</p>
      </div>
      <Switch checked={ap.reduceMotion} className="pointer-events-none" tabIndex={-1} />
    </button>
  );

  const grupoSessao = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => ap.saveSessionKeepalive(!(ap.sessionKeepalive ?? false))}
        className="flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/30 min-h-11"
        aria-pressed={ap.sessionKeepalive ?? false}
      >
        <div className="min-w-0">
          <p className="font-medium">Manter sessão ativa</p>
          <p className="text-sm text-muted-foreground">Quando ligado, renova automaticamente a sessão a cada 30 min enquanto a aba estiver aberta — você não verá o aviso de expiração. Padrão: <strong>desligado</strong>.</p>
        </div>
        <Switch checked={ap.sessionKeepalive ?? false} className="pointer-events-none" tabIndex={-1} />
      </button>
      <div className="space-y-2">
        <Label>Avisar antes de expirar</Label>
        <Select value={String(ap.sessionWarnMinutes ?? 5)} onValueChange={(v) => ap.saveSessionWarnMinutes(Number(v))}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
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
  );

  const SIDEBAR_MODE_OPTIONS: Array<{ mode: SidebarMode; title: string; desc: string; preview: React.ReactNode }> = [
    {
      mode: 'dynamic',
      title: 'Dinâmico',
      desc: 'Recolhido por padrão; expande no hover.',
      preview: (
        <svg viewBox="0 0 120 70" className="w-full h-16" aria-hidden="true">
          <rect x="0" y="0" width="18" height="70" rx="2" className="fill-muted" />
          <rect x="5" y="8" width="8" height="3" className="fill-muted-foreground/60" />
          <rect x="5" y="18" width="8" height="3" className="fill-muted-foreground/60" />
          <rect x="5" y="28" width="8" height="3" className="fill-muted-foreground/60" />
          <rect x="5" y="38" width="8" height="3" className="fill-muted-foreground/60" />
          <rect x="24" y="6" width="60" height="4" rx="1" className="fill-muted-foreground/40" />
          <rect x="24" y="16" width="90" height="3" rx="1" className="fill-muted-foreground/25" />
          <rect x="24" y="24" width="80" height="3" rx="1" className="fill-muted-foreground/25" />
          <path d="M18 35 L24 32 L24 38 Z" className="fill-primary" />
        </svg>
      ),
    },
    {
      mode: 'fixed-expanded',
      title: 'Sempre expandido',
      desc: 'Largura fixa de 240px.',
      preview: (
        <svg viewBox="0 0 120 70" className="w-full h-16" aria-hidden="true">
          <rect x="0" y="0" width="42" height="70" rx="2" className="fill-muted" />
          <rect x="5" y="8" width="3" height="3" className="fill-muted-foreground/60" />
          <rect x="11" y="8" width="26" height="3" className="fill-muted-foreground/60" />
          <rect x="5" y="18" width="3" height="3" className="fill-muted-foreground/60" />
          <rect x="11" y="18" width="26" height="3" className="fill-muted-foreground/60" />
          <rect x="5" y="28" width="3" height="3" className="fill-muted-foreground/60" />
          <rect x="11" y="28" width="26" height="3" className="fill-muted-foreground/60" />
          <rect x="48" y="6" width="50" height="4" rx="1" className="fill-muted-foreground/40" />
          <rect x="48" y="16" width="66" height="3" rx="1" className="fill-muted-foreground/25" />
        </svg>
      ),
    },
    {
      mode: 'fixed-collapsed',
      title: 'Sempre recolhido',
      desc: 'Apenas ícones (72px).',
      preview: (
        <svg viewBox="0 0 120 70" className="w-full h-16" aria-hidden="true">
          <rect x="0" y="0" width="14" height="70" rx="2" className="fill-muted" />
          <rect x="4" y="8" width="6" height="3" className="fill-muted-foreground/60" />
          <rect x="4" y="18" width="6" height="3" className="fill-muted-foreground/60" />
          <rect x="4" y="28" width="6" height="3" className="fill-muted-foreground/60" />
          <rect x="4" y="38" width="6" height="3" className="fill-muted-foreground/60" />
          <rect x="20" y="6" width="80" height="4" rx="1" className="fill-muted-foreground/40" />
          <rect x="20" y="16" width="95" height="3" rx="1" className="fill-muted-foreground/25" />
          <rect x="20" y="24" width="90" height="3" rx="1" className="fill-muted-foreground/25" />
          <rect x="20" y="32" width="92" height="3" rx="1" className="fill-muted-foreground/25" />
        </svg>
      ),
    },
  ];

  const grupoMenuLateral = (
    <div className="grid gap-3 md:grid-cols-3">
      {SIDEBAR_MODE_OPTIONS.map((opt) => {
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
              'rounded-lg border p-3 text-left transition-colors min-h-11 space-y-2',
              active ? 'border-primary bg-primary/5' : 'hover:bg-accent/30',
            )}
          >
            <div className="relative rounded-md border bg-background p-1.5">
              {opt.preview}
              {active && (
                <span className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{opt.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  const grupoMenuLateralMobile = (
    <div className="space-y-2">
      <Label>Comportamento do menu</Label>
      <Select
        value={ap.sidebarMode}
        onValueChange={async (v) => {
          await ap.saveSidebarMode(v as SidebarMode);
          await ap.saveMenuCompacto(v !== 'fixed-expanded');
          ap.markSaved();
        }}
      >
        <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="dynamic">
            <span className="flex flex-col items-start">
              <span className="text-sm font-medium">Dinâmico</span>
              <span className="text-xs text-muted-foreground">Recolhido por padrão; expande no hover</span>
            </span>
          </SelectItem>
          <SelectItem value="fixed-expanded">
            <span className="flex flex-col items-start">
              <span className="text-sm font-medium">Sempre expandido</span>
              <span className="text-xs text-muted-foreground">Largura fixa de 240px</span>
            </span>
          </SelectItem>
          <SelectItem value="fixed-collapsed">
            <span className="flex flex-col items-start">
              <span className="text-sm font-medium">Sempre recolhido</span>
              <span className="text-xs text-muted-foreground">Apenas ícones (72px)</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Esta configuração afeta a navegação lateral em telas maiores.
      </p>
    </div>
  );

  const grupoBranding = (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-3">
      {/* Mobile: linha compacta. Desktop: layout original. */}
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corPrimaria }} aria-label={`Cor primária ${corPrimaria}`} />
          <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corSecundaria }} aria-label={`Cor secundária ${corSecundaria}`} />
          <span className="text-xs ml-1">Cores institucionais</span>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm" className="gap-1 h-9 text-xs">
            <Link to="/administracao?tab=empresa">Editar<ArrowUpRight className="h-3 w-3" /></Link>
          </Button>
        )}
      </div>
      <div className="hidden sm:block space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-foreground font-medium">Cores institucionais (branding global)</p>
            <p className="text-xs">
              Definidas pelo administrador em <strong>Administração → Empresa</strong>. Refletem em todos os usuários.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corPrimaria }} />
              <span className="font-mono text-xs text-muted-foreground">{corPrimaria}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-7 rounded-md border" style={{ backgroundColor: corSecundaria }} />
              <span className="font-mono text-xs text-muted-foreground">{corSecundaria}</span>
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
    </div>
  );

  // Botão de restaurar — Drawer no mobile, AlertDialog no desktop.
  const restaurarLabel = 'Restaurar padrão';
  const restaurarTitle = 'Restaurar aparência padrão?';
  const restaurarDesc = 'Isso vai redefinir tema, densidade, tamanho da fonte, menu compacto e animações para os valores originais do sistema. As cores institucionais não são alteradas.';

  const restaurar = isMobile ? (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2 w-full sm:w-auto min-h-11">
          <RotateCcw className="h-4 w-4" />
          {restaurarLabel}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{restaurarTitle}</DrawerTitle>
          <DrawerDescription>{restaurarDesc}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button onClick={ap.reset} className="min-h-11">{restaurarLabel}</Button>
          <DrawerClose asChild>
            <Button variant="outline" className="min-h-11">Cancelar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ) : (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {restaurarLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{restaurarTitle}</AlertDialogTitle>
          <AlertDialogDescription>{restaurarDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={ap.reset}>{restaurarLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ─────────── Mobile: Accordion ───────────
  if (isMobile) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            Mudanças são aplicadas e salvas automaticamente.
            {ap.savedAt && ` Último ajuste: ${ap.savedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-3">
          <Accordion type="multiple" defaultValue={['aparencia', 'leitura']} className="w-full">
            <AccordionItem value="aparencia">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Aparência geral</AccordionTrigger>
              <AccordionContent>{grupoAparencia}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="leitura">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Leitura</AccordionTrigger>
              <AccordionContent>{grupoLeitura}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="acessibilidade">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Acessibilidade</AccordionTrigger>
              <AccordionContent>{grupoAcessibilidade}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="sessao">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Sessão</AccordionTrigger>
              <AccordionContent>{grupoSessao}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="menu-lateral">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Comportamento do menu lateral</AccordionTrigger>
              <AccordionContent>{grupoMenuLateralMobile}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="branding">
              <AccordionTrigger className="min-h-11 text-sm font-semibold">Branding global</AccordionTrigger>
              <AccordionContent>{grupoBranding}</AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="pt-2">{restaurar}</div>
        </CardContent>
      </Card>
    );
  }

  // ─────────── Desktop: layout linear original ───────────
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
          {grupoAparencia}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Leitura e navegação</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Legibilidade do texto e comportamento do menu lateral.</p>
          </div>
          {grupoLeitura}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Acessibilidade</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ajustes para reduzir desconforto visual durante o uso.</p>
          </div>
          {grupoAcessibilidade}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sessão</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Controle quanto tempo sua sessão permanece ativa.</p>
          </div>
          {grupoSessao}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Comportamento do menu lateral</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha como o menu lateral se comporta.</p>
          </div>
          {grupoMenuLateral}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ajuda e tours guiados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controle se telas novas oferecem automaticamente um tour guiado no primeiro acesso.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sugerir tour em telas novas</p>
              <p className="text-xs text-muted-foreground">
                Aparece um aviso discreto na primeira vez que você entra em uma tela com tour disponível.
              </p>
            </div>
            <Switch
              checked={!help.state.disabledFirstVisit}
              onCheckedChange={(checked) => help.setDisabledFirstVisit(!checked)}
              aria-label="Sugerir tour em telas novas"
            />
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                help.resetAll();
                toast.success('Tours reiniciados — eles voltarão a aparecer ao entrar em cada tela.');
              }}
            >
              Reiniciar todos os tours
            </Button>
          </div>
        </div>

        <Separator />

        {grupoBranding}

        <Separator />

        <div className="flex items-center justify-between gap-3 pt-2">
          {restaurar}
        </div>
      </CardContent>
    </Card>
  );
}
