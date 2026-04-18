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
  const { profile, signOut } = useAuth();

  const initials = (profile?.nome || 'Admin')
    .split(' ')
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

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
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onOpenSearch} aria-label="Abrir busca global" title="Buscar">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onOpenShortcuts} aria-label="Abrir atalhos">
                <Keyboard className="h-4 w-4" />
              </Button>

              <NotificationsPanel />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-primary/20 focus-visible:ring-primary/40 transition" aria-label="Abrir menu da conta">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/perfil')}>
                    <User className="mr-2 h-4 w-4" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                    <Settings className="mr-2 h-4 w-4" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    Tema {theme === 'dark' ? 'claro' : 'escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      await signOut();
                    }}
                  >
                    Sair
                  </DropdownMenuItem>
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
                {quickActions.map((action) => (
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

            <NotificationsPanel />

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-primary/20 focus-visible:ring-primary/40 transition" aria-label="Abrir menu da conta">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{profile?.nome || 'Admin'}</p>
                  <p className="text-xs text-muted-foreground font-normal">{profile?.cargo || 'Administrador'}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <User className="mr-2 h-4 w-4" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  Tema {theme === 'dark' ? 'claro' : 'escuro'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    await signOut();
                  }}
                >
                  Sair
                </DropdownMenuItem>
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
