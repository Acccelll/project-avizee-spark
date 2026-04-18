import { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawerHeaderShell } from "@/components/ui/DrawerHeaderShell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X } from "lucide-react";

interface ViewDrawerV2Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Linha de contexto/breadcrumb logo abaixo do título. */
  subtitle?: ReactNode;
  /** Conteúdo principal do drawer (quando não há tabs). */
  children?: ReactNode;
  /** [Compat] Badge ao lado do título — agora migrado para a barra de resumo se houver. */
  badge?: ReactNode;
  /** Linha de ações do registro (Editar/Excluir/Mais). */
  actions?: ReactNode;
  /** Faixa de resumo do registro (identity card, KPIs, status). */
  summary?: ReactNode;
  tabs?: { value: string; label: string; content: ReactNode }[];
  defaultTab?: string;
  footer?: ReactNode;
}

/**
 * ViewDrawerV2 — drawer padrão para visualizações standalone (não relacionais).
 * Padroniza o topo via DrawerHeaderShell:
 *   1. HEADER GLOBAL: título + breadcrumb + botão fechar
 *   2. RESUMO: identity card / KPIs (prop `summary`)
 *   3. AÇÕES: Editar/Excluir/Mais (prop `actions`)
 */
export function ViewDrawerV2({
  open, onClose, title, subtitle, children, badge, actions, summary, tabs, defaultTab, footer,
}: ViewDrawerV2Props) {
  // Quando há badge legado e não há summary, embute o badge no breadcrumb para não perder contexto.
  const breadcrumbContent = (subtitle || badge) ? (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {subtitle}
      {badge && !summary && <span className="inline-flex items-center">{badge}</span>}
    </span>
  ) : undefined;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Visualização detalhada de {title}</SheetDescription>
        </SheetHeader>

        <DrawerHeaderShell
          title={title}
          breadcrumb={breadcrumbContent}
          recordSummary={summary ? (
            // Quando há summary explícito, badge legado entra junto na barra de resumo
            badge ? (
              <div className="space-y-2">
                <div className="flex items-center justify-end">{badge}</div>
                {summary}
              </div>
            ) : summary
          ) : undefined}
          recordActions={actions}
          globalControls={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onClose}
                  aria-label="Fechar drawer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Fechar</TooltipContent>
            </Tooltip>
          }
        />

        <div className="flex-1 px-4 sm:px-6 py-4">
          {tabs && tabs.length > 0 ? (
            <Tabs defaultValue={defaultTab || tabs[0].value} className="w-full">
              <TabsList className="w-full justify-start mb-4">
                {tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((t) => (
                <TabsContent key={t.value} value={t.value} className="space-y-5 mt-0">
                  {t.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="space-y-5">{children}</div>
          )}
        </div>

        {footer && (
          <div className="sticky bottom-0 bg-card border-t px-4 sm:px-6 py-3">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* Re-export ViewField and ViewSection for convenience */
export { ViewField, ViewSection } from "@/components/ViewDrawer";
