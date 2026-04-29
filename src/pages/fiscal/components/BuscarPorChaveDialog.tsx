/**
 * Busca de NF-e por chave de acesso (44 dígitos).
 *
 * Estratégia em 2 níveis:
 *  1. Busca local em `nfe_distribuicao.xml_nfe` — XMLs que já chegaram via
 *     DistDFe (sincronização automática agendada). É a fonte preferencial:
 *     instantânea, sem custo SEFAZ.
 *  2. Sob demanda, dispara `sefaz-distdfe / consultar-nsu` para baixar
 *     novos documentos destinados ao CNPJ da empresa configurada.
 *
 * IMPORTANTE — limitação SEFAZ:
 *   O serviço NFeDistribuicaoDFe **só retorna documentos destinados ao CNPJ
 *   do certificado A1 configurado**. Não existe API pública gratuita para
 *   baixar XML de uma NF-e arbitrária por chave (esse é um serviço pago
 *   oferecido por SEFAZ-virtual / contadores). Por isso, se a chave não
 *   estiver no DistDFe, o XML não pode ser obtido automaticamente.
 */

import { useState } from "react";
import { KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormModal } from "@/components/FormModal";

interface BuscarPorChaveDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback chamado quando o XML foi obtido. Recebe o conteúdo bruto do XML. */
  onXmlObtido: (xml: string, origem: "local" | "sefaz") => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function BuscarPorChaveDialog({
  open,
  onClose,
  onXmlObtido,
}: BuscarPorChaveDialogProps) {
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "local" | "sefaz">("idle");

  const reset = () => {
    setChave("");
    setLoading(false);
    setPhase("idle");
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const buscarLocal = async (chaveLimpa: string) => {
    const { data, error } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe, nome_emitente, numero, serie")
      .eq("chave_acesso", chaveLimpa)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const handleBuscar = async () => {
    const chaveLimpa = onlyDigits(chave);
    if (chaveLimpa.length !== 44) {
      toast.error("A chave de acesso deve ter exatamente 44 dígitos.");
      return;
    }

    setLoading(true);
    setPhase("local");
    try {
      // 1. Busca local
      const local = await buscarLocal(chaveLimpa);
      if (local?.xml_nfe) {
        toast.success(
          `XML encontrado localmente (NF ${local.numero ?? "?"} de ${local.nome_emitente ?? "—"}).`,
        );
        onXmlObtido(local.xml_nfe, "local");
        reset();
        onClose();
        return;
      }

      // 2. Consulta direta por chave no DistDFe (consChNFe).
      //    Diferente do consultar-nsu (incremental), busca exatamente esta chave.
      //    Limitação SEFAZ: a NF precisa ser destinada ao CNPJ do certificado.
      setPhase("sefaz");
      toast.info("Consultando SEFAZ pela chave…");

      const { data: result, error: syncErr } = await supabase.functions.invoke(
        "sefaz-distdfe",
        { body: { action: "consultar-chave", chNFe: chaveLimpa } },
      );

      if (syncErr) {
        const msg =
          (syncErr as { message?: string })?.message ??
          "Falha ao consultar SEFAZ. Verifique o certificado digital configurado.";
        throw new Error(msg);
      }

      type SefazResp = {
        sucesso?: boolean;
        erro?: string;
        cStat?: string;
        xMotivo?: string;
        docs?: Array<{ schema?: string; xml?: string; chave?: string }>;
      };
      const r = (result ?? {}) as SefazResp;

      if (r.sucesso === false) {
        throw new Error(r.erro ?? "Falha desconhecida no SEFAZ.");
      }

      // Procura o doc da chave consultada (procNFe completo).
      const doc = (r.docs ?? []).find(
        (d) => d.chave === chaveLimpa && d.schema?.toLowerCase().includes("procnfe"),
      ) ?? (r.docs ?? []).find((d) => d.chave === chaveLimpa);

      if (doc?.xml) {
        // Persiste o XML para reuso (cache local + disponibiliza na manifestação).
        try {
          await supabase.from("nfe_distribuicao").upsert(
            [{ chave_acesso: chaveLimpa, xml_nfe: doc.xml }],
            { onConflict: "chave_acesso" },
          );
        } catch (persistErr) {
          console.warn("[BuscarPorChave] cache local falhou:", persistErr);
        }
        toast.success("XML obtido via SEFAZ.");
        onXmlObtido(doc.xml, "sefaz");
        reset();
        onClose();
        return;
      }

      // Não encontrou — devolve a mensagem real da SEFAZ (cStat + xMotivo).
      const cStat = r.cStat ?? "";
      const xMotivo = r.xMotivo ?? "Documento não localizado.";
      const explicacao =
        cStat === "137" || cStat === "138"
          ? `${xMotivo} (cStat ${cStat}). A NF-e existe mas não está vinculada ao CNPJ do certificado configurado — peça o XML diretamente ao emissor.`
          : `${xMotivo}${cStat ? ` (cStat ${cStat})` : ""}.`;
      toast.error(`SEFAZ: ${explicacao}`, { duration: 10000 });
    } catch (err) {
      console.error("[BuscarPorChave]", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro na consulta: ${msg}`);
    } finally {
      setLoading(false);
      setPhase("idle");
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
                {phase === "sefaz" ? "Consultando SEFAZ…" : "Buscando…"}
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
          <p className="font-semibold">Como funciona</p>
          <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
            <li>Procuramos primeiro nos XMLs já recebidos por DistDFe (instantâneo).</li>
            <li>
              Se não encontrarmos, sincronizamos com a SEFAZ usando o certificado digital
              configurado.
            </li>
            <li>
              <strong>Limitação:</strong> a SEFAZ só devolve XMLs destinados ao CNPJ do
              certificado. Notas emitidas para outros CNPJs precisam ser obtidas com o
              próprio emissor.
            </li>
          </ol>
        </div>
      </div>
    </FormModal>
  );
}