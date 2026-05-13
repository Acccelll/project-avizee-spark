import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, KeyRound, ScanLine, FileCode2, Download } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface FiscalToolbarActionsProps {
  onXmlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportClick: () => void;
  onBuscarChaveClick: () => void;
  onScannerClick: () => void;
  /** Em mobile, agrupa Importar XML + Buscar por chave em um menu "⋯". */
  compact?: boolean;
}

/**
 * Kill-switch (Sprint 7.1 P0) para a busca por chave via API pública.
 * Default = habilitado. Para desativar em runtime, defina
 *   VITE_FEATURE_BUSCA_CHAVE=false
 * em build secret. Quando desligado, escondemos os botões de busca-por-chave
 * e scanner — `consultadanfe-proxy` não é mais acessível pela UI.
 */
const BUSCA_CHAVE_ENABLED =
  String(import.meta.env.VITE_FEATURE_BUSCA_CHAVE ?? "true").toLowerCase() !== "false";

/**
 * Ações do header do módulo Fiscal:
 * - Buscar por chave (API consultadanfe.com)
 * - Ler QR/Código (scanner local — extrai chave e abre o diálogo de busca)
 * - Importar XML
 */
export const FiscalToolbarActions = forwardRef<HTMLInputElement, FiscalToolbarActionsProps>(
  ({ onXmlChange, onImportClick, onBuscarChaveClick, onScannerClick, compact = false }, ref) => {
    const [sheetOpen, setSheetOpen] = useState(false);

    const fire = (cb: () => void) => {
      setSheetOpen(false);
      // Aguarda o sheet fechar para evitar foco preso
      setTimeout(cb, 80);
    };

    if (compact) {
      return (
        <>
          <input ref={ref} type="file" accept=".xml" className="hidden" onChange={onXmlChange} />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-11 px-3"
                aria-label="Importar nota fiscal"
              >
                <Download className="h-4 w-4" />
                Importar
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader className="text-left">
                <SheetTitle>Importar nota fiscal</SheetTitle>
                <SheetDescription>Escolha como quer trazer a NF-e.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 py-4">
                {BUSCA_CHAVE_ENABLED && (
                  <button
                    type="button"
                    onClick={() => fire(onBuscarChaveClick)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 min-h-[96px] hover:bg-accent transition"
                  >
                    <KeyRound className="h-6 w-6 text-primary" />
                    <span className="text-xs font-medium">Chave</span>
                  </button>
                )}
                {BUSCA_CHAVE_ENABLED && (
                  <button
                    type="button"
                    onClick={() => fire(onScannerClick)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 min-h-[96px] hover:bg-accent transition"
                  >
                    <ScanLine className="h-6 w-6 text-primary" />
                    <span className="text-xs font-medium">QR Code</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fire(onImportClick)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 min-h-[96px] hover:bg-accent transition"
                >
                  <FileCode2 className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">XML</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      );
    }

    return (
      <>
        <input ref={ref} type="file" accept=".xml" className="hidden" onChange={onXmlChange} />
        {BUSCA_CHAVE_ENABLED && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 min-h-11 md:min-h-9 px-3"
              onClick={onBuscarChaveClick}
              aria-label="Buscar NF-e pela chave de acesso"
            >
              <KeyRound className="h-4 w-4 md:h-3.5 md:w-3.5" />{" "}
              <span className="hidden xs:inline">Buscar por </span>chave
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 min-h-11 md:min-h-9 px-3"
              onClick={onScannerClick}
              aria-label="Ler chave por código de barras ou QR Code"
            >
              <ScanLine className="h-4 w-4 md:h-3.5 md:w-3.5" />{" "}
              <span className="hidden xs:inline">Ler </span>QR/Código
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 min-h-11 md:min-h-9 px-3"
          onClick={onImportClick}
          aria-label="Importar XML de NF-e"
        >
          <Upload className="h-4 w-4 md:h-3.5 md:w-3.5" />{" "}
          <span className="hidden xs:inline">Importar </span>XML
        </Button>
      </>
    );
  }
);

FiscalToolbarActions.displayName = "FiscalToolbarActions";