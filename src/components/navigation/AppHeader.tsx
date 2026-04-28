import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Keyboard, Moon, Plus, Search, Settings, Sun, User } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { AppBreadcrumbs, resolvePageTitle } from './AppBreadcrumbs';
import { NotificationsPanel } from './NotificationsPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { headerIcons, quickActions } from '@/lib/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCan } from '@/hooks/useCan';
import type { Permission } from '@/utils/permissions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ROLE_LABELS, type AppRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { GlobalPeriodChip } from './GlobalPeriodChip';
import { HelpMenu } from '@/components/help/HelpMenu';

const ROLE_DOT_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive',
  financeiro: 'bg-info',
  vendedor: 'bg-success',
  estoquista: 'bg-warning',
  gestor_compras: 'bg-primary',
  operador_logistico: 'bg-accent',
};

function primaryRole(roles: AppRole[]): AppRole | null {
  if (roles.includes('admin')) return 'admin';
  return roles[0] ?? null;
}

/**
 * Itens compartilhados pelo menu da conta — usado nos contextos mobile e desktop
 * para evitar duplicação visual e funcional.
 */
function AccountMenuItems({
  navigate,
  theme,
  setTheme,
  signOut,
}: {
  navigate: (path: string) => void;
  theme: string | undefined;
  setTheme: (t: string) => void;
  signOut: () => Promise<void>;
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
        <User className="mr-2 h-4 w-4" /> Minha conta
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/configuracoes?tab=aparencia')}>
        <Settings className="mr-2 h-4 w-4" /> Aparência
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
        Tema {theme === 'dark' ? 'claro' : 'escuro'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={async () => { await signOut(); }}
      >
        Sair
      </DropdownMenuItem>
    </>
  );
}

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
}

/**
 * AppHeader — topbar global. Apenas apresentação: hotkeys, busca global e
 * diálogo de atalhos vivem no `AppLayout` para sobreviver à navegação.
 */
export function AppHeader({ onOpenMobileMenu: _onOpenMobileMenu, onOpenSearch, onOpenShortcuts }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const { profile, signOut, roles } = useAuth();
  const { can } = useCan();
  const allowedQuickActions = useMemo(
    () => quickActions.filter((a) => !a.requires || can(a.requires as Permission)),
    [can],
  );

  const initials = (profile?.nome || 'Admin')
    .split(' ')
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  const role = primaryRole(roles);
  const roleLabel = role ? ROLE_LABELS[role] : 'Sem perfil';
  const roleDot = role ? ROLE_DOT_COLORS[role] : 'bg-muted-foreground';

  const pageTitle = useMemo(
    () => resolvePageTitle(location.pathname, searchParams),
    [location.pathname, searchParams],
  );

  const Icon = useMemo(() => {
    const exact = headerIcons[location.pathname];
    if (exact) return exact;
    return Object.entries(headerIcons).find(([path]) => location.pathname.startsWith(path) && path !== '/')?.[1] || headerIcons['/'];
  }, [location.pathname]);

  return (
    <header role="banner" className="sticky top-0 z-40 border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 shadow-[0_1px_0_0_hsl(var(--border)/0.4)]">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 md:px-6">
        {isMobile ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {location.pathname !== '/' && (
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => navigate(-1)} aria-label="Voltar para a tela anterior" title="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-accent p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-none">{pageTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">ERP AviZee</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <GlobalPeriodChip className="hidden xs:inline-flex" />
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onOpenSearch} aria-label="Abrir busca global" title="Buscar">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onOpenShortcuts} aria-label="Abrir atalhos">
                <Keyboard className="h-4 w-4" />
              </Button>

              <HelpMenu onOpenShortcuts={onOpenShortcuts} variant="mobile" />

              <NotificationsPanel />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-primary/20 focus-visible:ring-primary/40 transition relative" aria-label={`Menu da conta — ${roleLabel}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <span
                      aria-hidden="true"
                      className={cn('absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-card', roleDot)}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="space-y-0.5">
                    <p className="text-sm font-medium leading-none">{profile?.nome || 'Admin'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', roleDot)} aria-hidden="true" />
                      <p className="text-xs text-muted-foreground font-normal">{roleLabel}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <AccountMenuItems navigate={navigate} theme={theme} setTheme={setTheme} signOut={signOut} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <AppBreadcrumbs />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-md border-primary/30 text-primary hover:bg-primary/5 hover:text-primary">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allowedQuickActions.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Nenhuma ação rápida disponível para o seu perfil.</p>
                )}
                {allowedQuickActions.map((action) => (
                  <DropdownMenuItem key={action.id} onClick={() => navigate(action.path)} className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    {action.shortcut && <span className="text-[10px] text-muted-foreground">{action.shortcut}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-1 h-6 w-px bg-border/60" aria-hidden />

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground" onClick={onOpenSearch} aria-label="Abrir busca global" title="Buscar (⌘K)">
              <Search className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground" onClick={onOpenShortcuts} aria-label="Abrir atalhos" title="Atalhos (?)">
              <Keyboard className="h-4 w-4" />
            </Button>

            <HelpMenu onOpenShortcuts={onOpenShortcuts} />

            <NotificationsPanel />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-primary/20 focus-visible:ring-primary/40 transition relative"
                  aria-label={`Menu da conta — ${profile?.nome || 'Admin'} · ${roleLabel}`}
                  title={`${profile?.nome || 'Admin'} · ${roleLabel}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <span
                    aria-hidden="true"
                    className={cn('absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-card', roleDot)}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.nome || 'Admin'}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full', roleDot)} aria-hidden="true" />
                    <p className="text-xs text-muted-foreground font-normal">{roleLabel}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <AccountMenuItems navigate={navigate} theme={theme} setTheme={setTheme} signOut={signOut} />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}

// `useEffect` mantido apenas pelo lint pré-existente — sem listeners aqui.
void useEffect;
