import { LogOut, Moon, Search, Settings, Sun, Compass, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useVisibleNavSections } from '@/hooks/useVisibleNavSections';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useNavProfile } from '@/hooks/useNavProfile';
import { useRecentRoutes } from '@/hooks/useRecentRoutes';
import { useMobileQuickActions } from '@/hooks/useMobileQuickActions';
import { PROFILE_SECTION_KEYS, isPriorityProfile } from '@/lib/navigation/profiles';
import type { NavSection, NavSectionKey } from '@/lib/navigation';
import { mobileBottomTabKeys } from '@/lib/navigation';
import { MobileMenuHeader } from './mobile/MobileMenuHeader';
import { MobileMenuSection } from './mobile/MobileMenuSection';
import { MobileMenuRecents } from './mobile/MobileMenuRecents';
import { MobileMenuFavorites } from './mobile/MobileMenuFavorites';
import { MobileQuickActionsGrid } from './mobile/MobileQuickActionsGrid';
import { MobileQuickActionsEditor } from './mobile/MobileQuickActionsEditor';
import { MobileNavProfilePicker } from './mobile/MobileNavProfilePicker';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSearch: () => void;
}

const OPEN_SECTION_STORAGE_KEY = 'avizee_menu_section_state';
const ADMIN_ADVANCED_PATHS = new Set([
  '/admin/migracao',
  '/admin/auditoria',
  '/admin/audit-duplicidades',
]);

function partitionSections(
  sections: NavSection[],
  priorityKeys: NavSectionKey[],
): { primary: NavSection[]; others: NavSection[] } {
  if (priorityKeys.length === 0) return { primary: sections, others: [] };
  const set = new Set<NavSectionKey>(priorityKeys);
  const order = new Map(priorityKeys.map((k, i) => [k, i] as const));
  const primary = sections
    .filter((s) => set.has(s.key))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  const others = sections.filter((s) => !set.has(s.key));
  return { primary, others };
}

function withoutAdvancedAdmin(sections: NavSection[]): NavSection[] {
  return sections.map((s) => {
    if (s.key !== 'administracao') return s;
    return {
      ...s,
      items: s.items
        .map((g) => ({ ...g, items: g.items.filter((i) => !ADMIN_ADVANCED_PATHS.has(i.path)) }))
        .filter((g) => g.items.length > 0),
    };
  });
}

export function MobileMenu({ open, onOpenChange, onOpenSearch }: MobileMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { profile: userProfile, signOut } = useAuth();
  const visibleSections = useVisibleNavSections();
  const { moduleBadges } = useSidebarBadges();
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();
  const { profile, setProfile } = useNavProfile();
  const { recents } = useRecentRoutes();
  const { visible: visibleQuickActions, allowed: allowedQuickActions, saveSelection, max } = useMobileQuickActions();

  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(OPEN_SECTION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showAdvancedAdmin, setShowAdvancedAdmin] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_SECTION_STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // ignore
    }
  }, [openSections]);

  const isItemActiveBase = (path: string) => location.pathname === path.split('?')[0];

  // Garante que a seção que contém a rota ativa abra ao montar/abrir o menu.
  useEffect(() => {
    if (!open) return;
    const activeKey = visibleSections.find((s) => {
      if (s.directPath) return isItemActiveBase(s.directPath);
      return s.items.some((g) => g.items.some((i) => isItemActiveBase(i.path)));
    })?.key;
    if (activeKey && !openSections.includes(activeKey)) {
      setOpenSections((prev) => [...prev, activeKey]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  const sectionsForMobile = useMemo(
    () => (showAdvancedAdmin ? visibleSections : withoutAdvancedAdmin(visibleSections)),
    [visibleSections, showAdvancedAdmin],
  );

  const { primary, others } = useMemo(
    () => partitionSections(sectionsForMobile, PROFILE_SECTION_KEYS[profile]),
    [sectionsForMobile, profile],
  );

  const isItemActive = isItemActiveBase;

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const renderSection = (section: NavSection) => (
    <MobileMenuSection
      key={section.key}
      section={section}
      badge={moduleBadges[section.key]}
      isItemActive={isItemActive}
      isFavorite={isFavorito}
      onNavigate={handleNavigate}
      onToggleFavorite={toggleFavorito}
      onDirectNavigate={section.directPath ? handleNavigate : undefined}
      anchorId={`menu-section-${section.key}`}
    />
  );

  const initials = (userProfile?.nome ?? 'AD')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasMaisContent = favoritos.length > 0 || recents.length > 0;

  // Chips de salto: módulos que não estão no bottom nav (mais difíceis de
  // alcançar via scroll). Scroll suave dentro do container do drawer.
  const jumpSections = useMemo(
    () => sectionsForMobile.filter((s) => !mobileBottomTabKeys.has(s.key)),
    [sectionsForMobile],
  );

  const handleJumpTo = (key: NavSectionKey) => {
    const el = document.getElementById(`menu-section-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="flex w-[86vw] max-w-[380px] flex-col p-0 md:hidden [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Navegue pelos módulos e atalhos do ERP AviZee.</SheetDescription>
          </SheetHeader>

          <MobileMenuHeader />

          <div className="flex-1 overflow-y-auto pb-3">
            {/* Busca */}
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenSearch();
                }}
                className="flex h-10 w-full items-center gap-2 rounded-lg bg-muted/50 px-3 text-xs text-muted-foreground transition hover:bg-muted"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar módulos…</span>
              </button>
            </div>

            {jumpSections.length > 0 && (
              <div
                className="mt-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="navigation"
                aria-label="Saltar para módulo"
              >
                {jumpSections.map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => handleJumpTo(section.key)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <SectionIcon className="h-3 w-3" />
                      {section.title}
                    </button>
                  );
                })}
              </div>
            )}

            <MobileQuickActionsGrid
              actions={visibleQuickActions}
              onAction={handleNavigate}
              onEdit={() => setEditorOpen(true)}
            />

            {/* Módulos prioritários */}
            <section className="px-3 pt-4">
              <Accordion
                type="multiple"
                value={openSections}
                onValueChange={(v) => setOpenSections(v)}
                className="space-y-0.5"
              >
                {primary.map(renderSection)}
              </Accordion>
            </section>

            {/* Outros módulos (perfil ≠ completo) */}
            {others.length > 0 && (
              <section className="px-3 pt-2">
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:bg-accent">
                    <span>Outros módulos ({others.length})</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Accordion
                      type="multiple"
                      value={openSections}
                      onValueChange={(v) => setOpenSections(v)}
                      className="mt-1 space-y-0.5"
                    >
                      {others.map(renderSection)}
                    </Accordion>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}

            {/* Mais: Favoritos + Recentes (oculto por padrão) */}
            {hasMaisContent && (
              <section className="px-3 pt-2">
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:bg-accent">
                    <span>Mais</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="-mx-3">
                      <MobileMenuFavorites paths={favoritos} onNavigate={handleNavigate} />
                      <MobileMenuRecents items={recents} onNavigate={handleNavigate} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}

            {/* Mostrar opções avançadas (admin) */}
            {visibleSections.some((s) => s.key === 'administracao') && (
              <div className="px-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedAdmin((v) => !v)}
                  className="rounded px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
                >
                  {showAdvancedAdmin ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas'}
                </button>
              </div>
            )}
          </div>

          {/* Footer sticky */}
          <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{userProfile?.nome ?? 'Administrador'}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {userProfile?.cargo ?? 'Admin'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <FooterIconButton
                label={`Modo: ${profile}`}
                onClick={() => setProfilePickerOpen(true)}
                active={isPriorityProfile(profile)}
              >
                <Compass className="h-4 w-4" />
              </FooterIconButton>
              <FooterIconButton
                label={`Tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </FooterIconButton>
              <FooterIconButton label="Configurações" onClick={() => handleNavigate('/configuracoes')}>
                <Settings className="h-4 w-4" />
              </FooterIconButton>
              <FooterIconButton
                label="Sair"
                onClick={async () => {
                  onOpenChange(false);
                  await signOut();
                }}
                tone="destructive"
              >
                <LogOut className="h-4 w-4" />
              </FooterIconButton>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MobileNavProfilePicker
        open={profilePickerOpen}
        onOpenChange={setProfilePickerOpen}
        value={profile}
        onChange={setProfile}
      />

      <MobileQuickActionsEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        allowed={allowedQuickActions}
        selectedIds={visibleQuickActions.map((a) => a.id)}
        max={max}
        onSave={saveSelection}
      />
    </>
  );
}

interface FooterIconButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'destructive';
  active?: boolean;
}

function FooterIconButton({ label, onClick, children, tone = 'default', active }: FooterIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md transition',
        tone === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : active
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
