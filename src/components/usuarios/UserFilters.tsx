/**
 * Barra de filtros da lista de usuários: busca textual, status, role e
 * toggle "com exceções". Recebe os getters/setters do pai — o estado real
 * é persistido nos `searchParams` do `UsuariosTab` (URL-as-state).
 */

import { useState } from 'react';
import { Filter, Search, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { ROLE_LABELS } from '@/lib/permissions';
import { ALL_ROLES, type AppRole } from './_shared';

export type StatusFilter = 'todos' | 'ativo' | 'inativo';
export type RoleFilter = AppRole | 'todos';

interface UserFiltersProps {
  search: string;
  filterStatus: StatusFilter;
  filterRole: RoleFilter;
  filterExtra: boolean;
  hasFilters: boolean;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: StatusFilter) => void;
  onRoleChange: (v: RoleFilter) => void;
  onExtraChange: (v: boolean) => void;
  onClear: () => void;
}

export function UserFilters({
  search,
  filterStatus,
  filterRole,
  filterExtra,
  hasFilters,
  onSearchChange,
  onStatusChange,
  onRoleChange,
  onExtraChange,
  onClear,
}: UserFiltersProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Conta filtros não-padrão para mostrar no botão "Filtros (n)".
  const activeCount =
    (filterStatus !== 'todos' ? 1 : 0) +
    (filterRole !== 'todos' ? 1 : 0) +
    (filterExtra ? 1 : 0);

  if (isMobile) {
    return (
      <>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar usuário..."
              className="pl-9 pr-8 h-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={activeCount > 0 ? 'secondary' : 'outline'}
            size="sm"
            className="h-11 gap-1.5 shrink-0"
            onClick={() => setSheetOpen(true)}
            aria-label="Abrir filtros"
          >
            <Filter className="h-4 w-4" />
            {activeCount > 0 ? `Filtros (${activeCount})` : 'Filtros'}
          </Button>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Refine a lista de usuários.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={filterStatus} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativo">Apenas ativos</SelectItem>
                    <SelectItem value="inativo">Apenas inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Perfil</label>
                <Select value={filterRole} onValueChange={(v) => onRoleChange(v as RoleFilter)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os perfis</SelectItem>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant={filterExtra ? 'secondary' : 'outline'}
                className="w-full h-11 gap-1.5"
                onClick={() => onExtraChange(!filterExtra)}
              >
                <ShieldAlert className="h-4 w-4" />
                {filterExtra ? 'Mostrando com exceções' : 'Apenas com exceções'}
              </Button>
              <div className="flex gap-2 pt-2">
                {hasFilters && (
                  <Button
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={() => {
                      onClear();
                      setSheetOpen(false);
                    }}
                  >
                    Limpar tudo
                  </Button>
                )}
                <Button className="flex-1 h-11" onClick={() => setSheetOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nome, e-mail ou cargo..."
          className="pl-9 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Apenas ativos</SelectItem>
            <SelectItem value="inativo">Apenas inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={(v) => onRoleChange(v as RoleFilter)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filterExtra ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => onExtraChange(!filterExtra)}
          title="Filtrar usuários com permissões complementares"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Com exceções
        </Button>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}