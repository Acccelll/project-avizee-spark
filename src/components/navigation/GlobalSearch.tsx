import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Sparkles, Terminal } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Command,
} from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { flatNavItems, quickActions, navSections } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useCan } from '@/hooks/useCan';
import { useVisibleNavSections } from '@/hooks/useVisibleNavSections';
import { toast } from 'sonner';
import { useRelationalNavigation, type EntityType } from '@/contexts/RelationalNavigationContext';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EntityCategory = 'Clientes' | 'Produtos' | 'Orçamentos' | 'Notas';
interface EntityResult {
  id: string;
  entityId: string;
  entityType: EntityType;
  title: string;
  subtitle: string;
  category: EntityCategory;
}

const CATEGORY_LABEL: Record<string, EntityCategory> = {
  cliente: 'Clientes',
  produto: 'Produtos',
  orcamento: 'Orçamentos',
  nota_fiscal: 'Notas',
};

const CATEGORY_PERMISSION: Record<string, string> = {
  cliente: 'clientes:visualizar',
  produto: 'produtos:visualizar',
  orcamento: 'orcamentos:visualizar',
  nota_fiscal: 'faturamento_fiscal:visualizar',
};

const RECENT_KEY = 'erp:global-search:recent';

/**
 * Comandos por prefixo. Acionados quando o input começa com `/`.
 * Ex.: `/orc novo` → Novo Orçamento; `/cli` → Clientes.
 */
interface SearchCommand {
  /** Prefixos aceitos (sem barra). O primeiro é o canônico exibido. */
  keywords: string[];
  /** Sub-token opcional (ex.: "novo"). */
  arg?: 'novo';
  title: string;
  description: string;
  path: string;
  requires?: string;
}

const SEARCH_COMMANDS: SearchCommand[] = [
  { keywords: ['orc', 'orcamento'], arg: 'novo', title: 'Novo orçamento', description: '/orc novo', path: '/orcamentos/novo', requires: 'orcamentos:editar' },
  { keywords: ['orc', 'orcamento'], title: 'Abrir orçamentos', description: '/orc', path: '/orcamentos', requires: 'orcamentos:visualizar' },
  { keywords: ['cli', 'cliente'], arg: 'novo', title: 'Novo cliente', description: '/cli novo', path: '/clientes?new=1', requires: 'clientes:editar' },
  { keywords: ['cli', 'cliente'], title: 'Abrir clientes', description: '/cli', path: '/clientes', requires: 'clientes:visualizar' },
  { keywords: ['prod', 'produto'], arg: 'novo', title: 'Novo produto', description: '/prod novo', path: '/produtos?new=1', requires: 'produtos:editar' },
  { keywords: ['prod', 'produto'], title: 'Abrir produtos', description: '/prod', path: '/produtos', requires: 'produtos:visualizar' },
  { keywords: ['nf', 'nota'], arg: 'novo', title: 'Nova nota fiscal de saída', description: '/nf novo', path: '/fiscal?tipo=saida&new=1', requires: 'faturamento_fiscal:editar' },
  { keywords: ['nf', 'nota', 'fiscal'], title: 'Abrir Fiscal', description: '/nf', path: '/fiscal', requires: 'faturamento_fiscal:visualizar' },
  { keywords: ['ped', 'pedido'], title: 'Abrir pedidos', description: '/ped', path: '/pedidos', requires: 'pedidos:visualizar' },
  { keywords: ['fin', 'financeiro'], title: 'Abrir financeiro', description: '/fin', path: '/financeiro', requires: 'financeiro:visualizar' },
  { keywords: ['baixa', 'pag'], title: 'Baixa financeira em lote', description: '/baixa', path: '/financeiro?baixa=lote', requires: 'financeiro:baixar' },
  { keywords: ['est', 'estoque'], title: 'Abrir estoque', description: '/est', path: '/estoque', requires: 'estoque:visualizar' },
  { keywords: ['log', 'logistica'], title: 'Abrir logística', description: '/log', path: '/logistica', requires: 'logistica:visualizar' },
  { keywords: ['rel', 'relatorio'], title: 'Abrir relatórios', description: '/rel', path: '/relatorios', requires: 'relatorios:visualizar' },
  { keywords: ['cfg', 'config'], title: 'Configurações', description: '/cfg', path: '/configuracoes' },
];

function parseCommand(input: string): { keyword: string; arg?: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const [head, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!head) return null;
  return { keyword: head.toLowerCase(), arg: rest.join(' ').toLowerCase() || undefined };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function highlight(text: string, term: string) {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === term.toLowerCase() ? <mark key={`${part}-${idx}`} className="rounded bg-warning/35 px-0.5">{part}</mark> : part
      )}
    </>
  );
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { can } = useCan();
  const isMobile = useIsMobile();
  const visibleSections = useVisibleNavSections();
  const visibleSectionKeys = useMemo(() => new Set(visibleSections.map((s) => s.key)), [visibleSections]);
  // Mapa path-base → leaf, para checar `disabled` rapidamente sem percorrer árvore.
  const disabledPaths = useMemo(() => {
    const set = new Set<string>();
    for (const sec of navSections) {
      if (sec.disabled && sec.directPath) set.add(sec.directPath.split('?')[0]);
      for (const grp of sec.items) {
        for (const it of grp.items) {
          if (it.disabled) set.add(it.path.split('?')[0]);
        }
      }
    }
    return set;
  }, []);
  const isPathDisabled = (path: string) => {
    const base = path.split('?')[0];
    if (disabledPaths.has(base)) return true;
    // Marca também sub-rotas de path desabilitado (ex.: /faturamento/cadastros).
    for (const d of disabledPaths) {
      if (base === d || base.startsWith(`${d}/`)) return true;
    }
    return false;
  };
  const { pushView } = useRelationalNavigation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [entityResults, setEntityResults] = useState<EntityResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setEntityResults([]);
      return;
    }

    const term = debouncedSearch.trim();
    let active = true;

    // RPC unificada que respeita RLS — uma chamada em vez de 4 selects.
    supabase
      .rpc('global_search', { search_term: term, max_per_category: 4 })
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const merged: EntityResult[] = (data as Array<{ category: string; entity_id: string; title: string; subtitle: string }>)
          .filter((row) => {
            // Filtra por permissão no front, mesmo que a RLS já barrasse —
            // evita mostrar resultados que abririam um drawer com erro.
            const perm = CATEGORY_PERMISSION[row.category];
            return perm ? can(perm as never) : true;
          })
          .map((row) => ({
            id: `${row.category}-${row.entity_id}`,
            entityId: row.entity_id,
            entityType: row.category as EntityType,
            title: row.title,
            subtitle: row.subtitle,
            category: CATEGORY_LABEL[row.category] ?? 'Clientes',
          }));
        setEntityResults(merged);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, can]);

  const navigationResults = useMemo(
    () =>
      flatNavItems
        .filter((item) => !item.sectionKey || visibleSectionKeys.has(item.sectionKey))
        .map((item) => ({
        id: item.path,
        title: item.title,
        category: 'Navegação',
        subtitle: item.section ? `${item.section} · ${item.subgroup}` : 'Navegação',
        path: item.path,
        disabled: isPathDisabled(item.path),
      })),
    [visibleSectionKeys, disabledPaths],
  );

  const filteredNavigation = useMemo(() => {
    if (!search.trim()) return navigationResults;
    const term = search.toLowerCase();
    return navigationResults.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(term));
  }, [navigationResults, search]);

  const filteredActions = useMemo(() => {
    const enriched = [
      ...quickActions,
      { id: 'nova-venda', title: 'Novo Pedido', description: 'Ver pedidos e faturamento', path: '/pedidos', shortcut: '⌃⇧N' },
      { id: 'nova-nota', title: 'Nova Nota Fiscal', description: 'Abrir emissão fiscal', path: '/fiscal?tipo=saida', shortcut: '⌃⇧N', requires: 'faturamento_fiscal:editar' as const },
      { id: 'novo-produto-atalho', title: 'Novo Produto', description: 'Ir para cadastro de produto', path: '/produtos', shortcut: '⌃⇧P' },
    ] as Array<typeof quickActions[number] & { requires?: string }>;
    if (!search.trim()) return enriched;
    const term = search.toLowerCase();
    return enriched.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(term));
  }, [search]);

  // Aplica filtro de permissão (`requires`) e oculta ações apontando para módulos "Em breve".
  const allowedActions = useMemo(
    () =>
      filteredActions.filter((item) => {
        if (item.requires && !can(item.requires as never)) return false;
        if (isPathDisabled(item.path)) return false;
        return true;
      }),
    [filteredActions, can, disabledPaths],
  );

  const groupedEntities = useMemo(() => {
    const groups: Record<string, EntityResult[]> = {};
    for (const item of entityResults) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [entityResults]);

  const matchedCommands = useMemo(() => {
    const parsed = parseCommand(search);
    if (!parsed) return [] as SearchCommand[];
    return SEARCH_COMMANDS.filter((cmd) => {
      const matchesKeyword = cmd.keywords.some((k) => k.startsWith(parsed.keyword));
      if (!matchesKeyword) return false;
      // Se o comando exige `arg`, o input precisa conter um sub-token compatível.
      if (cmd.arg && !(parsed.arg ?? '').startsWith(cmd.arg)) return false;
      // Comandos sem `arg`: só mostra quando o usuário não digitou um arg
      // OU quando o arg digitado não bate com o de "novo" (para não duplicar).
      if (!cmd.arg && parsed.arg && parsed.arg.startsWith('novo')) return false;
      if (cmd.requires && !can(cmd.requires as never)) return false;
      if (isPathDisabled(cmd.path)) return false;
      return true;
    }).slice(0, 6);
  }, [search, can, disabledPaths]);

  const persistRecent = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((x) => x !== trimmed)].slice(0, 6);
    setRecentSearches(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const handleSelect = (path: string) => {
    if (isPathDisabled(path)) {
      toast.info('Recurso em breve', { description: 'Este módulo está em construção.' });
      onOpenChange(false);
      return;
    }
    persistRecent(search);
    onOpenChange(false);
    navigate(path);
  };

  const handleSelectEntity = (entity: EntityResult) => {
    persistRecent(search);
    onOpenChange(false);
    // Notas fiscais não estão na lista de drawers — fallback para a tela.
    if (entity.entityType === 'nota_fiscal') {
      navigate('/fiscal');
      return;
    }
    pushView(entity.entityType, entity.entityId);
  };

  const body = (
    <>
      <CommandInput placeholder="Buscar módulos, registros e ações..." value={search} onValueChange={setSearch} />
      <CommandList className={isMobile ? 'max-h-[65vh]' : undefined}>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {recentSearches.length > 0 && !search.trim() && (
          <CommandGroup heading="Buscas recentes">
            {recentSearches.map((term) => (
              <CommandItem key={term} onSelect={() => setSearch(term)}>
                <History className="mr-2 h-4 w-4" />
                {term}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedCommands.length > 0 && (
          <CommandGroup heading="Comandos">
            {matchedCommands.map((cmd) => (
              <CommandItem
                key={`${cmd.keywords[0]}-${cmd.arg ?? 'open'}-${cmd.path}`}
                onSelect={() => handleSelect(cmd.path)}
              >
                <Terminal className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span>{cmd.title}</span>
                  <span className="text-xs text-muted-foreground">{cmd.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {allowedActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ações rápidas">
              {allowedActions.map((item) => (
                <CommandItem key={item.id} onSelect={() => handleSelect(item.path)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{highlight(item.title, search)}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                  {item.shortcut && <span className="ml-auto text-[10px] text-muted-foreground">{item.shortcut}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {Object.entries(groupedEntities).map(([category, items]) => (
          <div key={category}>
            <CommandSeparator />
            <CommandGroup heading={category}>
              {items.map((item) => (
                <CommandItem key={item.id} onSelect={() => handleSelectEntity(item)}>
                  <Search className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{highlight(item.title, search)}</span>
                    <span className="text-xs text-muted-foreground">{highlight(item.subtitle, search)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Navegação">
          {filteredNavigation.map((item) => (
            <CommandItem key={item.id} onSelect={() => handleSelect(item.path)}>
              <Search className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>
                  {highlight(item.title, search)}
                  {item.disabled && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">Em breve</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{highlight(item.subtitle, search)}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Busca global</DrawerTitle>
          </DrawerHeader>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 mt-2 bg-transparent">
            {body}
          </Command>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {body}
    </CommandDialog>
  );
}
