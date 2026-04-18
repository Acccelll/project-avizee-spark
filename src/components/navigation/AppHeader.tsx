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
    <header role="banner" className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 md:px-6">
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

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={onOpenSearch} aria-label="Abrir busca global" title="Buscar">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={onOpenShortcuts} aria-label="Abrir atalhos">
                <Keyboard className="h-4 w-4" />
              </Button>

              <NotificationsPanel />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 w-10 rounded-full p-0" aria-label="Abrir menu da conta">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
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
                      navigate('/login');
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
            <div className="min-w-0 flex-1 space-y-1">
              <AppBreadcrumbs />
            </div>

            <Button variant="outline" className="hidden min-w-[220px] items-center justify-start gap-2 md:flex" onClick={onOpenSearch}>
              <Search className="h-4 w-4" />
              <span className="text-muted-foreground">Buscar módulos...</span>
              <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 rounded-full px-4">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo</span>
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

            <Button variant="outline" size="icon" className="rounded-full" onClick={onOpenShortcuts} aria-label="Abrir atalhos">
              <Keyboard className="h-4 w-4" />
            </Button>

            <NotificationsPanel />

            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-full px-2" aria-label="Abrir menu da conta">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-medium leading-none">{profile?.nome || 'Admin'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.cargo || 'Administrador'}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
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
                    navigate('/login');
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
