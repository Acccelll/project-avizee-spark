import { toast } from "sonner";
import { BuscarPorChaveDialog } from "@/pages/fiscal/components/BuscarPorChaveDialog";
import { FiscalChaveScannerDialog } from "@/pages/fiscal/components/FiscalChaveScannerDialog";
import { logger } from "@/lib/logger";

export interface FiscalChaveDialogsSlotProps {
  buscarChaveOpen: boolean;
  buscarChaveInicial: string | undefined;
  setBuscarChaveOpen: (open: boolean) => void;
  setBuscarChaveInicial: (chave: string | undefined) => void;
  scannerOpen: boolean;
  setScannerOpen: (open: boolean) => void;
  processarXmlImportado: (input: File | string) => Promise<void>;
}

/**
 * Slot dos dois diálogos centrados na "chave de acesso" da NF-e — extraído
 * de `Fiscal.tsx` como parte da decomposição §6/Fase 2.1.
 *
 * - `BuscarPorChaveDialog`: busca DistDFe local + sync SEFAZ a partir de uma chave.
 * - `FiscalChaveScannerDialog`: scanner (câmera/upload/digitação) que extrai
 *   apenas a chave e a encaminha para o diálogo de busca.
 *
 * Mantém o contrato 1:1 com o JSX original — apenas isola o bloco do god-component.
 */
export function FiscalChaveDialogsSlot({
  buscarChaveOpen,
  buscarChaveInicial,
  setBuscarChaveOpen,
  setBuscarChaveInicial,
  scannerOpen,
  setScannerOpen,
  processarXmlImportado,
}: FiscalChaveDialogsSlotProps) {
  return (
    <>
      {/* Busca de NF-e por chave de acesso (44 dígitos) — DistDFe local + sync SEFAZ */}
      <BuscarPorChaveDialog
        open={buscarChaveOpen}
        chaveInicial={buscarChaveInicial}
        onClose={() => {
          setBuscarChaveOpen(false);
          setBuscarChaveInicial(undefined);
        }}
        onXmlObtido={async (xml) => {
          try {
            await processarXmlImportado(xml);
          } catch (err) {
            logger.error("[fiscal] processar XML por chave:", err);
            toast.error(
              `Erro ao processar XML: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }}
      />

      {/* Scanner de chave (câmera/upload/digitação) — extrai apenas a chave;
          os fluxos de consulta/XML continuam canônicos. */}
      <FiscalChaveScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBuscarXml={(chave) => {
          setScannerOpen(false);
          setBuscarChaveInicial(chave);
          setBuscarChaveOpen(true);
        }}
        onConsultarSituacao={(chave) => {
          setScannerOpen(false);
          setBuscarChaveInicial(chave);
          setBuscarChaveOpen(true);
        }}
      />
    </>
  );
}