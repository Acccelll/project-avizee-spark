import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { parseOfx } from "@/services/conciliacao/ofxParser";
import { parseCnab240, detectarFormato } from "@/services/conciliacao/cnab240Parser";
import {
  registrarExtratoComLinhas,
  sha256Hex,
  type LinhaExtratoNormalizadaInput,
} from "@/services/conciliacao/importService";

export function ImportarExtratoDialog({ onImported }: { onImported?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [contaId, setContaId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LinhaExtratoNormalizadaInput[]>([]);
  const [formato, setFormato] = useState<"ofx" | "cnab240" | null>(null);
  const [busy, setBusy] = useState(false);
  const [periodo, setPeriodo] = useState<{ ini: string | null; fim: string | null }>({ ini: null, fim: null });
  const [conteudo, setConteudo] = useState<string>("");

  const contasQuery = useQuery({
    queryKey: ["contas-bancarias", "ativas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, descricao, agencia, conta")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const empresaQuery = useQuery({
    queryKey: ["empresa", "atual"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const reset = () => {
    setFile(null);
    setPreview([]);
    setFormato(null);
    setPeriodo({ ini: null, fim: null });
    setConteudo("");
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const fmt = detectarFormato(f.name);
    if (!fmt) {
      toast.error("Formato não suportado. Use .ofx, .ret ou .cnab");
      return;
    }
    const text = await f.text();
    setConteudo(text);
    const parsed = fmt === "ofx" ? parseOfx(text) : parseCnab240(text);
    setFormato(fmt);
    setPreview(parsed.linhas);
    setPeriodo({ ini: parsed.periodo_inicio, fim: parsed.periodo_fim });
    if (parsed.linhas.length === 0) {
      toast.warning("Nenhuma linha encontrada no arquivo");
    }
  };

  const confirmar = async () => {
    if (!file || !formato || !contaId || !empresaQuery.data) {
      toast.error("Selecione a conta e um arquivo válido");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(conteudo);
      const res = await registrarExtratoComLinhas({
        empresa_id: empresaQuery.data,
        conta_bancaria_id: contaId,
        arquivo_hash: hash,
        arquivo_nome: file.name,
        formato,
        origem: "upload",
        periodo_inicio: periodo.ini,
        periodo_fim: periodo.fim,
        linhas: preview,
      });
      toast.success(`${res.linhas.length} linhas importadas`);
      await queryClient.invalidateQueries({ queryKey: ["conciliacao", "extratos"] });
      onImported?.();
      reset();
      setOpen(false);
      if (periodo.ini && periodo.fim) {
        navigate(
          `/financeiro/conciliacao/dashboard?inicio=${periodo.ini}&fim=${periodo.fim}`,
        );
      }
    } catch (err) {
      logger.error("conciliacao.importar_dialog", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Upload className="mr-2 h-4 w-4" />
          Importar extrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extrato (OFX / CNAB 240)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contasQuery.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.descricao ?? `Ag ${c.agencia} · Cc ${c.conta}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Arquivo</Label>
            <input
              type="file"
              accept=".ofx,.ret,.rem,.cnab,.txt"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-sm"
            />
            {formato && (
              <p className="text-xs text-muted-foreground">
                Formato detectado: <strong>{formato.toUpperCase()}</strong> · {preview.length} linhas
                {periodo.ini && periodo.fim ? ` · ${periodo.ini} → ${periodo.fim}` : ""}
              </p>
            )}
          </div>

          {preview.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-1 text-left">Data</th>
                    <th className="p-1 text-left">Descrição</th>
                    <th className="p-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">{l.data_movimento}</td>
                      <td className="p-1">{l.descricao.slice(0, 60)}</td>
                      <td className="p-1 text-right">{l.valor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={busy || preview.length === 0 || !contaId}>
            {busy ? "Importando…" : `Importar ${preview.length} linhas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}