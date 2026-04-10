import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Sparkles } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { flatNavItems, quickActions } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EntityCategory = 'Clientes' | 'Produtos' | 'Orçamentos' | 'Notas';
interface EntityResult {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  category: EntityCategory;
}

const RECENT_KEY = 'erp:global-search:recent';

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

    Promise.all([
      supabase.from('clientes').select('id, nome_razao_social, cpf_cnpj').eq('ativo', true).ilike('nome_razao_social', `%${term}%`).limit(4),
      supabase.from('produtos').select('id, nome, codigo_interno').eq('ativo', true).ilike('nome', `%${term}%`).limit(4),
      supabase.from('orcamentos').select('id, numero, status').eq('ativo', true).ilike('numero', `%${term}%`).limit(4),
      supabase.from('notas_fiscais').select('id, numero, status, tipo').eq('ativo', true).ilike('numero', `%${term}%`).limit(4),
    ]).then(([clientes, produtos, orcamentos, notas]) => {
      if (!active) return;
      const merged: EntityResult[] = [
        ...(clientes.data || []).map((c: any) => ({ id: `cli-${c.id}`, title: c.nome_razao_social, subtitle: c.cpf_cnpj || 'Cliente', path: '/clientes', category: 'Clientes' as const })),
        ...(produtos.data || []).map((p: any) => ({ id: `pro-${p.id}`, title: p.nome, subtitle: p.codigo_interno || 'Produto', path: '/produtos', category: 'Produtos' as const })),
        ...(orcamentos.data || []).map((o: any) => ({ id: `orc-${o.id}`, title: `Orçamento #${o.numero}`, subtitle: o.status || 'Orçamento', path: `/orcamentos/${o.id}`, category: 'Orçamentos' as const })),
        ...(notas.data || []).map((n: any) => ({ id: `nf-${n.id}`, title: `NF #${n.numero}`, subtitle: `${n.tipo || 'nota'} · ${n.status || ''}`, path: '/fiscal', category: 'Notas' as const })),
      ];
      setEntityResults(merged);
    });

    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  const navigationResults = useMemo(
    () =>
      flatNavItems.map((item) => ({
        id: item.path,
        title: item.title,
        category: 'Navegação',
        subtitle: item.section ? `${item.section} · ${item.subgroup}` : 'Navegação',
        path: item.path,
      })),
    [],
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
      { id: 'nova-nota', title: 'Nova Nota Fiscal', description: 'Abrir emissão fiscal', path: '/fiscal?tipo=saida', shortcut: '⌃⇧N' },
      { id: 'novo-produto-atalho', title: 'Novo Produto', description: 'Ir para cadastro de produto', path: '/produtos', shortcut: '⌃⇧P' },
    ];
    if (!search.trim()) return enriched;
    const term = search.toLowerCase();
    return enriched.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(term));
  }, [search]);

  const groupedEntities = useMemo(() => {
    const groups: Record<string, EntityResult[]> = {};
    for (const item of entityResults) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [entityResults]);

  const persistRecent = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((x) => x !== trimmed)].slice(0, 6);
    setRecentSearches(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const handleSelect = (path: string) => {
    persistRecent(search);
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulos, registros e ações..." value={search} onValueChange={setSearch} />
      <CommandList>
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

        {filteredActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ações rápidas">
              {filteredActions.map((item) => (
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
                <CommandItem key={item.id} onSelect={() => handleSelect(item.path)}>
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
                <span>{highlight(item.title, search)}</span>
                <span className="text-xs text-muted-foreground">{highlight(item.subtitle, search)}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
