/**
 * AdminSidebar — navegação lateral agrupada da página de Administração.
 * Itens com `behavior: 'external'` (Migração / Auditoria) navegam para fora
 * da página em vez de trocar a tab interna.
 *
 * Layout dual:
 *  - Desktop (>=lg): coluna fixa lateral (`w-60`).
 *  - Mobile (<lg): renderizada dentro de um <Sheet> controlado externamente.
 *    O componente exporta `AdminSidebarContent` (markup compartilhado) e o
 *    wrapper `AdminSidebar` em desktop. O `Administracao.tsx` cuida do botão
 *    sticky "Menu Admin" + estado open do Sheet.
 */

import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export interface SideNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  behavior?: "internal" | "external";
}

export interface SideNavGroup {
  key: string;
  label: string;
  items: SideNavItem[];
}

interface AdminSidebarProps {
  groups: SideNavGroup[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Quando true, layout otimizado para uso dentro de um Sheet mobile. */
  inSheet?: boolean;
}

export function AdminSidebar({ groups, activeKey, onSelect, inSheet = false }: AdminSidebarProps) {
  return (
    <nav
      className={cn(
        inSheet ? "w-full" : "hidden lg:block lg:w-60",
        "space-y-5",
      )}
      aria-label="Navegação administrativa"
    >
      {groups.map((group, gIdx) => (
        <div key={group.key}>
          <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;
              const external = item.behavior === "external" || item.key === "migracao";
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-left transition-colors",
                    inSheet ? "py-3 min-h-11" : "py-2",
                    isActive
                      ? "bg-accent/40 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                  )}
                >
                  {isActive && (
                    <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                  )}
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-md shrink-0 transition-colors",
                      inSheet ? "h-7 w-7" : "h-6 w-6",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon className={inSheet ? "h-4 w-4" : "h-3.5 w-3.5"} />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {external && <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </div>
          {gIdx < groups.length - 1 && <Separator className="mt-4 opacity-60" />}
        </div>
      ))}
    </nav>
  );
}