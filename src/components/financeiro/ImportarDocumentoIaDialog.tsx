import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extrairDocumento, type TipoExtracao } from "@/services/ia/extracaoDocumento.service";
import type { LancamentoForm } from "@/pages/financeiro/types";
import { emptyLancamentoForm } from "@/pages/financeiro/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Recebe os defaults pré-preenchidos + set de campos vindos da IA. */
  onExtracted: (
    defaults: Partial<LancamentoForm>,
    iaFields: Set<keyof LancamentoForm>,
    meta: { confianca: "alta" | "media" | "baixa" },
  ) => void;
}

const TIPOS: Array<{ value: TipoExtracao; label: string; hint: string }> = [
  { value: "boleto", label: "Boleto", hint: "Cobrança bancária com linha digitável" },
  { value: "nota", label: "Nota fiscal", hint: "NF-e ou NFS-e em PDF" },
  { value: "extrato", label: "Extrato bancário", hint: "Lista de lançamentos (apenas leitura)" },
];

const MAX_MB = 10;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export function ImportarDocumentoIaDialog({ open, onClose, onExtracted }: Props) {
  const [tipo, setTipo] = useState<TipoExtracao>("boleto");
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    if (working) return;
    reset();
    onClose();
  };

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED.includes(f.type.toLowerCase())) {
      toast.error("Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (limite ${MAX_MB} MB).`);
      return;
    }
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    if (tipo === "extrato") {
      toast.error("Importação de extrato deve ser feita pela tela de Conciliação (OFX).");
      return;
    }
    setWorking(true);
    try {
      const result = await extrairDocumento(file, tipo);
      const defaults: Partial<LancamentoForm> = { ...emptyLancamentoForm };
      const ia = new Set<keyof LancamentoForm>();

      if (result.tipo === "boleto") {
        const d = result.dados;
        defaults.tipo = "pagar";
        ia.add("tipo");
        if (d.valor != null) {
          defaults.valor = Number(d.valor) || 0;
          ia.add("valor");
        }
        if (d.data_vencimento) {
          defaults.data_vencimento = d.data_vencimento;
          ia.add("data_vencimento");
        }
        const desc = [d.beneficiario_nome, d.nosso_numero ? `NN ${d.nosso_numero}` : null]
          .filter(Boolean)
          .join(" — ");
        if (desc) {
          defaults.descricao = desc;
          ia.add("descricao");
        }
        defaults.forma_pagamento = "boleto";
        ia.add("forma_pagamento");
        if (d.linha_digitavel) {
          defaults.observacoes = `Linha digitável: ${d.linha_digitavel}`;
          ia.add("observacoes");
        }
      } else if (result.tipo === "nota") {
        const d = result.dados;
        defaults.tipo = "pagar";
        ia.add("tipo");
        if (d.valor_total != null) {
          defaults.valor = Number(d.valor_total) || 0;
          ia.add("valor");
        }
        if (d.data_emissao) {
          defaults.data_vencimento = d.data_emissao;
          ia.add("data_vencimento");
        }
        const desc = [
          d.fornecedor_nome,
          d.numero ? `NF ${d.numero}${d.serie ? "-" + d.serie : ""}` : null,
        ]
          .filter(Boolean)
          .join(" — ");
        if (desc) {
          defaults.descricao = desc;
          ia.add("descricao");
        }
        if (d.chave_acesso) {
          defaults.observacoes = `Chave: ${d.chave_acesso}`;
          ia.add("observacoes");
        }
      }

      onExtracted(defaults, ia, { confianca: result.confianca });
      toast.success("Documento extraído. Revise os campos antes de salvar.");
      reset();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na extração.";
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar lançamento por documento (IA)
          </DialogTitle>
          <DialogDescription>
            Envie um PDF/imagem. A IA pré-preenche o formulário. Nada é salvo sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Tipo de documento</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoExtracao)}
              className="mt-2 grid gap-2"
            >
              {TIPOS.map((t) => (
                <label
                  key={t.value}
                  className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value={t.value} id={`tipo-${t.value}`} className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.hint}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="ia-file" className="text-xs">
              Arquivo (PDF, JPG, PNG · até {MAX_MB} MB)
            </Label>
            <input
              ref={inputRef}
              id="ia-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-xs"
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {file.name} — {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose} disabled={working}>
              Cancelar
            </Button>
            <Button onClick={handleExtract} disabled={!file || working}>
              {working ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Extraindo…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Extrair e pré-preencher
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}