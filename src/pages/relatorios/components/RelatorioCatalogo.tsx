/**
 * Catálogo de relatórios — exibido quando `?tipo` está vazio.
 *
 * Renderiza:
 * - Faixa de relatórios prioritários (cards menores).
 * - Categorias (`reportCategoryMeta`) com seus relatórios.
 *
 * Extraído de `Relatorios.tsx` (Fase 5 do roadmap). Sem mudança visual.
 */

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  reportConfigs,
  reportCategoryMeta,
  type ReportCategory,
} from '@/config/relatoriosConfig';
import type { TipoRelatorio } from '@/services/relatorios.service';

interface RelatorioCatalogoProps {
  onSelect: (tipo: TipoRelatorio) => void;
}

export function RelatorioCatalogo({ onSelect }: RelatorioCatalogoProps) {
  const groupedReports = useMemo(() => {
    const all = Object.values(reportConfigs);
    return Object.entries(reportCategoryMeta).map(([cat, meta]) => ({
      category: cat as ReportCategory,
      ...meta,
      items: all.filter((r) => r.category === cat),
    }));
  }, []);

  const prioritized = Object.values(reportConfigs).filter((r) => r.priority);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          Selecione um Relatório
        </CardTitle>
        <CardDescription>
          Escolha o contexto de negócio e o relatório desejado para acessar filtros,
          análises e exportações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Relatórios prioritários</p>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {prioritized.map((card) => (
              <button
                key={card.id}
                onClick={() => onSelect(card.id)}
                aria-label={`Abrir relatório: ${card.title}`}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 bg-card',
                )}
              >
                <div className="flex items-center gap-2">
                  <card.icon className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold leading-tight">{card.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {groupedReports.map((group) => (
            <div key={group.category} className="rounded-lg border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <group.icon className="h-4 w-4 text-muted-foreground" />
                {group.title}
              </p>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                {group.items.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onSelect(card.id)}
                    aria-label={`Abrir relatório: ${card.title}`}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all hover:border-primary/30 bg-card',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <card.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{card.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}