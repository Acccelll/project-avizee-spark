import { Moon, Search, Settings, Sun, User, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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

const OPEN_SECTION_STORAGE_KEY = 'erp:mobile-menu:open-section';
/** Itens admin "avançados" — só aparecem em "Mais opções" (mobile). */
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

/** Filtra leafs admin avançados em mobile. */
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
  const { signOut } = useAuth();
  const visibleSections = useVisibleNavSections();
  const { moduleBadges } = useSidebarBadges();
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos();
  const { profile, setProfile } = useNavProfile();
  const { recents } = useRecentRoutes();
  const { visible: visibleQuickActions, allowed: allowedQuickActions, saveSelection, max } = useMobileQuickActions();

  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(OPEN_SECTION_STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [showAdvancedAdmin, setShowAdvancedAdmin] = useState(false);

  // Persiste seção aberta
  useEffect(() => {
    try {
      if (openSection) localStorage.setItem(OPEN_SECTION_STORAGE_KEY, openSection);
      else localStorage.removeItem(OPEN_SECTION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [openSection]);

  const sectionsForMobile = useMemo(
    () => (showAdvancedAdmin ? visibleSections : withoutAdvancedAdmin(visibleSections)),
    [visibleSections, showAdvancedAdmin],
  );

  const { primary, others } = useMemo(
    () => partitionSections(sectionsForMobile, PROFILE_SECTION_KEYS[profile]),
    [sectionsForMobile, profile],
  );

  const isItemActive = (path: string) => {
    const clean = path.split('?')[0];
    return location.pathname === clean;
  };

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
    />
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="flex w-[86vw] max-w-[380px] flex-col p-0 md:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Navegue pelos módulos e atalhos do ERP AviZee.</SheetDescription>
          </SheetHeader>

          <MobileMenuHeader
            profile={profile}
            onOpenProfilePicker={() => setProfilePickerOpen(true)}
            onOpenNotifications={() => onOpenChange(false)}
          />

          <div className="flex-1 overflow-y-auto pb-4">
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
                <span>Buscar módulos, cadastros e páginas…</span>
              </button>
            </div>

            {/* Atalhos rápidos */}
            <MobileQuickActionsGrid
              actions={visibleQuickActions}
              onAction={handleNavigate}
              onEdit={() => setEditorOpen(true)}
            />

            {/* Favoritos */}
            <MobileMenuFavorites paths={favoritos} onNavigate={handleNavigate} />

            {/* Recentes */}
            <MobileMenuRecents items={recents} onNavigate={handleNavigate} />

            {/* Módulos */}
            <section className="px-3 pt-3">
              <h3 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                {isPriorityProfile(profile) ? 'Módulos prioritários' : 'Módulos'}
              </h3>
              <Accordion
                type="single"
                collapsible
                value={openSection}
                onValueChange={(v) => setOpenSection(v || undefined)}
                className="space-y-0.5"
              >
                {primary.map(renderSection)}
              </Accordion>
            </section>

            {/* Outros módulos (perfis não-completo) */}
            {others.length > 0 && (
              <section className="px-3 pt-3">
                <Collapsible>
                  <CollapsibleTrigger
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-accent',
                      'group',
                    )}
                  >
                    <span>Outros módulos ({others.length})</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Accordion
                      type="single"
                      collapsible
                      className="mt-1 space-y-0.5"
                    >
                      {others.map(renderSection)}
                    </Accordion>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}

            {/* Mais opções (admin avançado) */}
            {visibleSections.some((s) => s.key === 'administracao') && (
              <div className="px-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedAdmin((v) => !v)}
                  className="rounded px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
                >
                  {showAdvancedAdmin ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas'}
                </button>
              </div>
            )}

            <Separator className="my-3" />

            {/* Conta + tema + sair */}
            <div className="space-y-0.5 px-3">
              <button
                type="button"
                onClick={() => handleNavigate('/configuracoes')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" /> Minha conta
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('/configuracoes?tab=aparencia')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Aparência
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent"
              >
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Tema {theme === 'dark' ? 'claro' : 'escuro'}
              </button>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-start rounded-lg text-destructive hover:text-destructive"
                onClick={async () => {
                  onOpenChange(false);
                  await signOut();
                }}
              >
                Sair
              </Button>
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
