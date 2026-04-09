import { Moon, Search, Settings, Sun, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { mobileMenuSections, quickActions } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSearch: () => void;
}

export function MobileMenu({ open, onOpenChange, onOpenSearch }: MobileMenuProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  const filteredSections = isAdmin ?
  mobileMenuSections :
  mobileMenuSections.filter((s) => s.key !== 'administracao');

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] rounded-t-[20px] px-0 md:hidden">
        <DrawerHeader className="px-4 pb-2 text-left">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>
          <DrawerDescription>Navegue pelos módulos e atalhos do ERP AviZee.</DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-28">
          <Button
            variant="outline"
            className="mb-4 h-12 w-full justify-start gap-2 rounded-xl"
            onClick={() => {
              onOpenChange(false);
              onOpenSearch();
            }}>
            
            <Search className="h-4 w-4" /> Buscar módulos, cadastros e páginas
          </Button>

          <section className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Atalhos rápidos</p>
            <div className="grid gap-2">
              {quickActions.slice(0, 3).map((action) =>
              <Button
                key={action.id}
                variant="secondary"
                className="h-auto justify-start rounded-xl px-4 py-3 text-left"
                onClick={() => handleNavigate(action.path)}>
                
                  <div>
                    <p className="text-sm font-bold text-destructive-foreground">{action.title}</p>
                    <p className="text-xs text-accent-foreground">{action.description}</p>
                  </div>
                </Button>
              )}
            </div>
          </section>

          {filteredSections.map((section) =>
          <section key={section.key} className="mb-5 rounded-2xl border bg-card/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <section.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{section.title}</p>
              </div>
              <div className="space-y-3">
                {section.items.map((group) =>
              <div key={group.title}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) =>
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition hover:bg-accent">
                    
                          <span>{item.title}</span>
                          <span className="text-muted-foreground">→</span>
                        </button>
                  )}
                    </div>
                  </div>
              )}
              </div>
            </section>
          )}

          <section className="rounded-2xl border bg-card/70 p-4">
            <p className="mb-3 text-sm font-semibold">Perfil</p>
            <div className="space-y-2">
              <div className="rounded-xl bg-accent/60 px-3 py-3">
                <p className="text-sm font-semibold">{profile?.nome || 'Admin'}</p>
                <p className="text-xs text-muted-foreground">{profile?.cargo || 'Administrador'}</p>
              </div>
              <Button variant="ghost" className="h-11 w-full justify-start rounded-xl" onClick={() => handleNavigate('/perfil')}>
                <User className="mr-2 h-4 w-4" /> Meu perfil
              </Button>
              <Button variant="ghost" className="h-11 w-full justify-start rounded-xl" onClick={() => handleNavigate('/configuracoes')}>
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </Button>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start rounded-xl"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                
                {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Tema {theme === 'dark' ? 'claro' : 'escuro'}
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="h-11 w-full justify-start rounded-xl text-destructive hover:text-destructive"
                onClick={async () => {
                  onOpenChange(false);
                  await signOut();
                  navigate('/login');
                }}>
                
                Sair
              </Button>
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>);

}