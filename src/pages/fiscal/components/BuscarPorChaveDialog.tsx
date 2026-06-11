/**
 * Busca de NF-e por chave de acesso (44 dígitos).
 * Ordem: cache local -> consultadanfe (primário) -> SEFAZ (último recurso).
 */

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Search, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormModal } from "@/components/FormModal";
import { obterXmlNFePorChave, DEST_MISMATCH_PREFIX } from "@/services/fiscal/sefaz/distdfe.service";

interface BuscarPorChaveDialogProps {
  open: boolean;
  onClose: () => void;
  /** Chave inicial (vinda do scanner, por exemplo). */
  chaveInicial?: string;
  /** Callback chamado quando o XML foi obtido. Recebe o conteúdo bruto do XML. */
  onXmlObtido: (xml: string, origem: "cache" | "sefaz" | "api") => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function BuscarPorChaveDialog({
  open,
  onClose,
  chaveInicial,
  onXmlObtido,
}: BuscarPorChaveDialogProps) {
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && chaveInicial) setChave(chaveInicial);
    if (!open) {
      setChave("");
      setLoading(false);
    }
  }, [open, chaveInicial]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleBuscar = async () => {
    const chaveLimpa = onlyDigits(chave);
    if (chaveLimpa.length !== 44) {
      toast.error("A chave de acesso deve ter exatamente 44 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const result = await obterXmlNFePorChave({ chave: chaveLimpa });
      if (result.sucesso && result.xml) {
        const origemLabel =
          result.origem === "cache" ? "cache local"
          : result.origem === "sefaz" ? "SEFAZ (DistDFe)"
          : "consultadanfe";
        toast.success(`XML obtido via ${origemLabel}.`);
        onXmlObtido(result.xml, result.origem);
        onClose();
        return;
      }
      const erro = result.erro ?? "Não foi possível obter o XML desta chave.";
      if (erro.startsWith(`${DEST_MISMATCH_PREFIX}:`)) {
        toast.error("Esta NF-e não pertence ao certificado configurado", {
          description: erro.replace(`${DEST_MISMATCH_PREFIX}: `, ""),
          duration: 14000,
        });
      } else {
        toast.error(erro, { duration: 10000 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro na consulta: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const chaveDigits = onlyDigits(chave);
  const chaveValida = chaveDigits.length === 44;

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Consultar NF-e por chave de acesso"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleBuscar} disabled={loading || !chaveValida} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="chave-acesso" className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Chave de acesso (44 dígitos)
          </Label>
          <Input
            id="chave-acesso"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
            maxLength={60}
            inputMode="numeric"
            autoFocus
            disabled={loading}
            className="font-mono tracking-tight"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {chaveDigits.length}/44 dígitos
              {chaveValida && <span className="ml-2 text-success">✓ válido</span>}
            </span>
            {chaveDigits.length > 0 && chaveDigits.length !== 44 && (
              <span className="text-warning">Faltam {44 - chaveDigits.length}</span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs text-foreground space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-info" />
            Como funciona
          </p>
          <p className="text-muted-foreground">
            Buscamos primeiro no <strong>cache local</strong>, depois na base{" "}
            <strong>consultadanfe</strong> (resolve qualquer chave) e, por fim,
            na <strong>SEFAZ</strong> como último recurso. O XML obtido fica em
            cache para a próxima consulta.
          </p>
          <p className="flex items-start gap-1.5 text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Se a chave não existir ou a base não tiver o documento, peça o XML ao emissor.
          </p>
        </div>
      </div>
    </FormModal>
  );
}