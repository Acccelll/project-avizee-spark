import { memo } from "react";
import { useRelationalNavigation, EntityType, ViewState, MAX_DRAWER_DEPTH } from "@/contexts/RelationalNavigationContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, X, AlertTriangle } from "lucide-react";
import { ProdutoView } from "./ProdutoView";
import { ClienteView } from "./ClienteView";
import { FornecedorView } from "./FornecedorView";
import { OrcamentoView } from "./OrcamentoView";
import { PedidoCompraView } from "./PedidoCompraView";
import { NotaFiscalView } from "./NotaFiscalView";
import { RemessaView } from "./RemessaView";
import { OrdemVendaView } from "./OrdemVendaView";

const DrawerContent = memo(function DrawerContent({ view }: { view: ViewState }) {
  switch (view.type) {
    case "produto": return <ProdutoView id={view.id} />;
    case "cliente": return <ClienteView id={view.id} />;
    case "fornecedor": return <FornecedorView id={view.id} />;
    case "orcamento": return <OrcamentoView id={view.id} />;
    case "pedido_compra": return <PedidoCompraView id={view.id} />;
    case "nota_fiscal": return <NotaFiscalView id={view.id} />;
    case "remessa": return <RemessaView id={view.id} />;
    case "ordem_venda": return <OrdemVendaView id={view.id} />;
    default: return <div className="p-4">Visualização não implementada para {view.type}</div>;
  }
});

const getTitle = (type: EntityType) => ({
  produto: "Detalhes do Produto",
  cliente: "Detalhes do Cliente",
  fornecedor: "Detalhes do Fornecedor",
  orcamento: "Cotação / Orçamento",
  pedido_compra: "Pedido de Compra",
  nota_fiscal: "Nota Fiscal",
  remessa: "Remessa / Rastreio",
  ordem_venda: "Pedido",
}[type] || "Detalhes");

export function RelationalDrawerStack() {
  const { stack, pendingPush, confirmPendingPush, cancelPendingPush, popView, clearStack } = useRelationalNavigation();
  const atLimit = stack.length >= MAX_DRAWER_DEPTH;

  return (
    <>
      <AlertDialog open={!!pendingPush}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de drawers atingido</AlertDialogTitle>
            <AlertDialogDescription>
              Você atingiu o limite de drawers abertos. Fechar o drawer mais antigo para abrir este novo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPendingPush}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingPush}>Fechar mais antigo e abrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {stack.map((view, index) => {
        const isTop = index === stack.length - 1;
        return (
          <Sheet key={`${view.type}-${view.id}-${index}`} open onOpenChange={(open) => !open && popView()}>
            <SheetContent
              side="right"
              className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col focus-visible:outline-none transition-all duration-300 ease-out border-l"
              style={{
                zIndex: 50 + index,
                transform: `translateX(${Math.max(0, (stack.length - 1 - index) * -8)}px)`,
                boxShadow: `${(index + 1) * -6}px 0 ${(index + 1) * 16}px rgba(15, 23, 42, 0.12)`,
                borderLeftColor: `hsl(var(--primary) / ${Math.min(0.18 + index * 0.06, 0.45)})`,
              }}
            >
              <SheetHeader className="sticky top-0 z-10 bg-card border-b px-6 py-3 flex flex-col gap-1 space-y-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <SheetTitle className="text-base truncate">{getTitle(view.type)}</SheetTitle>
                    <SheetDescription className="sr-only">Visualização de {getTitle(view.type)}</SheetDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isTop && atLimit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center h-7 w-7 text-amber-500"><AlertTriangle className="h-4 w-4" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Limite de drawers atingido: novas aberturas pedem confirmação.</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={popView}><X className="h-4 w-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Fechar drawer</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </SheetHeader>

              <div className="border-b bg-muted/20 px-6 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                  <span className="shrink-0">Drawers: {stack.length}/{MAX_DRAWER_DEPTH}</span>
                  {index > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2.5 -ml-1" onClick={popView}>
                      <ArrowLeft className="h-4 w-4" />
                      <span className="text-xs truncate">Voltar para {getTitle(stack[index - 1].type)}</span>
                    </Button>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs shrink-0" onClick={clearStack}>
                  Fechar todos
                </Button>
              </div>

              <div className="flex-1 px-6 pt-3 pb-4">
                <DrawerContent view={view} />
              </div>
            </SheetContent>
          </Sheet>
        );
      })}
    </>
  );
}
