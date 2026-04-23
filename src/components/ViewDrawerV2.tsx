import { ReactNode, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawerHeaderShell } from "@/components/ui/DrawerHeaderShell";
import { DrawerStickyFooter } from "@/components/ui/DrawerStickyFooter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visual variant do drawer — controla peso de tabs, footer e densidade.
 *  - "view"        : leitura, tabs slim, footer leve.
 *  - "operational" : transacional, tabs médias, footer sticky com sombra (use DrawerStickyFooter via prop `footer`).
 *  - "edit"        : edição, tabs fortes, footer salvar/cancelar fixo.
 */
export type ViewDrawerVariant = "view" | "operational" | "edit";

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
  /** Conteúdo do footer. Para variant "operational"/"edit" use <DrawerStickyFooter />. */
  footer?: ReactNode;
  /**
   * Sinaliza explicitamente que `footer` já é um sticky/com borda própria
   * (ex.: <DrawerStickyFooter />). Quando true, evita wrapper duplo.
   * Detecção automática via `type === DrawerStickyFooter` ainda é tentada,
   * mas falha com React.memo/forwardRef — prefira marcar via prop.
   */
  footerSticky?: boolean;
  variant?: ViewDrawerVariant;
}

/**
 * ViewDrawerV2 — drawer padrão para visualizações standalone (não relacionais).
 * Padroniza o topo via DrawerHeaderShell:
 *   1. HEADER GLOBAL: título + breadcrumb + botão fechar
 *   2. RESUMO: identity card / KPIs (prop `summary`)
 *   3. AÇÕES: Editar/Excluir/Mais (prop `actions`)
 *
 * O `variant` controla a tipologia visual (tabs/footer) sem alterar fluxos.
 */
export function ViewDrawerV2({
  open, onClose, title, subtitle, children, badge, actions, summary, tabs, defaultTab, footer,
  footerSticky,
  variant = "view",
}: ViewDrawerV2Props) {
  // Tabs controladas: garantem reset quando o conjunto de abas muda
  // (ex.: trocar de registro com aba inexistente no novo registro).
  const tabValues = tabs?.map((t) => t.value).join("|") ?? "";
  const initialTab = defaultTab && tabs?.some((t) => t.value === defaultTab)
    ? defaultTab
    : tabs?.[0]?.value;
  const [activeTab, setActiveTab] = useState<string | undefined>(initialTab);
  useEffect(() => {
    // Reset sempre que muda a lista de abas OU o defaultTab dinâmico
    if (!tabs || tabs.length === 0) { setActiveTab(undefined); return; }
    const next = defaultTab && tabs.some((t) => t.value === defaultTab) ? defaultTab : tabs[0].value;
    setActiveTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValues, defaultTab]);

  // Quando há badge legado e não há summary, embute o badge no breadcrumb para não perder contexto.
  const breadcrumbContent = (subtitle || badge) ? (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {subtitle}
      {badge && !summary && <span className="inline-flex items-center">{badge}</span>}
    </span>
  ) : undefined;

  // Tabs styling per variant
  const tabsListClass =
    variant === "view"
      ? "w-full justify-start mb-4 h-9"
      : "w-full justify-start mb-4 h-10 bg-muted/60";
  const tabsTriggerClass =
    variant === "view"
      ? "text-xs"
      : "text-xs sm:text-sm font-medium data-[state=active]:shadow-sm";

  // Se footer for fornecido como nó "cru" (não DrawerStickyFooter) em modo operational/edit,
  // ainda assim aplicamos um wrapper sticky com sombra superior para consistência.
  const renderFooter = () => {
    if (!footer) return null;
    // Prefer the explicit prop; fallback à heurística por type para retro-compat.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f: any = footer;
    const isSticky = footerSticky === true || f?.type === DrawerStickyFooter;
    if (isSticky) return footer;
    if (variant === "view") {
      return (
        <div className="sticky bottom-0 bg-card border-t px-4 sm:px-6 py-3">{footer}</div>
      );
    }
    return (
      <div className="sticky bottom-0 z-10 bg-card border-t shadow-[0_-4px_8px_-4px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3">
        {footer}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        className={cn(
          "w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col",
          variant === "operational" && "sm:max-w-2xl",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Visualização detalhada de {title}</SheetDescription>
        </SheetHeader>

        <DrawerHeaderShell
          title={title}
          breadcrumb={breadcrumbContent}
          recordSummary={summary ? (
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={tabsListClass}>
                {tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className={tabsTriggerClass}>
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

        {renderFooter()}
      </SheetContent>
    </Sheet>
  );
}

/* Re-export ViewField and ViewSection for convenience */
export { ViewField, ViewSection } from "@/components/ui/ViewField";
export { DrawerStickyFooter } from "@/components/ui/DrawerStickyFooter";
export { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
