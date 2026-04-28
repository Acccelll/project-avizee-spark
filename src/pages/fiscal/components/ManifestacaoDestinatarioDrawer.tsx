import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Inbox, Plus, CheckCircle2, AlertTriangle, EyeOff, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  enviarManifestacao,
  statusManifestacaoFromEvento,
  tipoEventoFiscalFromManifestacao,
  type AmbienteSefaz,
  type TipoManifestacao,
} from "@/services/fiscal/sefaz";
import { notifyError } from "@/utils/errorMessages";

/**
 * Manifestação do Destinatário (Onda 8).
 *
 * Lista NF-e capturadas em `nfe_distribuicao` (entrada por chave) e permite:
 *  - Adicionar NF por chave de acesso (44 dígitos).
 *  - Manifestar Ciência / Confirmação / Desconhecimento / Operação Não Realizada.
 * Cada manifestação grava um evento em `eventos_fiscais` e atualiza o
 * `status_manifestacao` da NF capturada.
 */

interface ManifestacaoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NfeCapturada {
  id: string;
  chave_acesso: string;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  protocolo_autorizacao: string | null;
  status_manifestacao: string;
  data_manifestacao: string | null;
  observacao: string | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sem_manifestacao: { label: "Sem manifestação", variant: "outline" },
  ciencia: { label: "Ciência", variant: "secondary" },
  confirmada: { label: "Confirmada", variant: "default" },
  desconhecida: { label: "Desconhecida", variant: "destructive" },
  nao_realizada: { label: "Não realizada", variant: "destructive" },
};

function chaveValida(c: string): boolean {
  return /^\d{44}$/.test(c.replace(/\D/g, ""));
}

function extrairDoChave(chave: string): { cnpj: string; serie: string; numero: string; data: string | null } {
  // Layout NF-e: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + numero(9) + tpEmis(1) + cNF(8) + cDV(1)
  const c = chave.replace(/\D/g, "");
  const aaMm = c.slice(2, 6);
  const cnpj = c.slice(6, 20);
  const serie = String(parseInt(c.slice(22, 25), 10));
  const numero = String(parseInt(c.slice(25, 34), 10));
  const ano = 2000 + parseInt(aaMm.slice(0, 2), 10);
  const mes = parseInt(aaMm.slice(2, 4), 10);
  let data: string | null = null;
  if (mes >= 1 && mes <= 12) {
    data = new Date(Date.UTC(ano, mes - 1, 1)).toISOString();
  }
  return { cnpj, serie, numero, data };
}

export function ManifestacaoDestinatarioDrawer({ open, onOpenChange }: ManifestacaoDrawerProps) {
  const qc = useQueryClient();
  const [novaChave, setNovaChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [manifestando, setManifestando] = useState<string | null>(null);
  const [naoRealizadaTarget, setNaoRealizadaTarget] = useState<NfeCapturada | null>(null);
  const [justNaoRealizada, setJustNaoRealizada] = useState("");

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["nfe-distribuicao"],
    queryFn: async (): Promise<NfeCapturada[]> => {
      const { data, error } = await supabase
        .from("nfe_distribuicao")
        .select(
          "id, chave_acesso, cnpj_emitente, nome_emitente, numero, serie, data_emissao, valor_total, protocolo_autorizacao, status_manifestacao, data_manifestacao, observacao",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NfeCapturada[];
    },
    enabled: open,
  });

  const handleAdicionar = async () => {
    const chave = novaChave.replace(/\D/g, "");
    if (!chaveValida(chave)) {
      toast.error("Chave de acesso inválida (44 dígitos).");
      return;
    }
    setSalvando(true);
    try {
      const { cnpj, serie, numero, data } = extrairDoChave(chave);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("nfe_distribuicao").insert({
        chave_acesso: chave,
        cnpj_emitente: cnpj,
        numero,
        serie,
        data_emissao: data,
        status_manifestacao: "sem_manifestacao",
        usuario_id: user?.id ?? null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Esta chave já está cadastrada.");
        } else {
          throw error;
        }
      } else {
        toast.success("NF-e adicionada para manifestação.");
        setNovaChave("");
        qc.invalidateQueries({ queryKey: ["nfe-distribuicao"] });
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setSalvando(false);
    }
  };

  const executarManifestacao = async (
    nf: NfeCapturada,
    tpEvento: TipoManifestacao,
    justificativa?: string,
  ) => {
    setManifestando(nf.id);
    try {
      const { data: cfg } = await supabase
        .from("empresa_config")
        .select("cnpj, ambiente_sefaz, ambiente_padrao")
        .limit(1)
        .maybeSingle();
      if (!cfg?.cnpj) {
        throw new Error("Configuração da empresa incompleta (CNPJ).");
      }
      let ambiente: AmbienteSefaz = "2";
      if (cfg.ambiente_sefaz === "1" || cfg.ambiente_sefaz === "2") ambiente = cfg.ambiente_sefaz;
      else if (cfg.ambiente_padrao === "producao") ambiente = "1";

      const result = await enviarManifestacao(
        {
          chave: nf.chave_acesso,
          cnpjDestinatario: cfg.cnpj,
          tpEvento,
          ambiente,
          justificativa,
        },
        { tipo: "A1", conteudo: "", senha: "" },
      );

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("eventos_fiscais").insert({
        nfe_distribuicao_id: nf.id,
        tipo_evento: tipoEventoFiscalFromManifestacao(tpEvento),
        codigo_evento: tpEvento,
        sequencia: 1,
        justificativa: justificativa ?? null,
        protocolo: result.protocolo ?? null,
        data_evento: result.dataRetorno ?? new Date().toISOString(),
        status_sefaz: result.sucesso ? "autorizado" : "rejeitado",
        motivo_retorno: result.motivo ?? null,
        xml_retorno: result.xmlRetorno ?? null,
        usuario_id: user?.id ?? null,
      });

      if (result.sucesso) {
        await supabase
          .from("nfe_distribuicao")
          .update({
            status_manifestacao: statusManifestacaoFromEvento(tpEvento),
            data_manifestacao: result.dataRetorno ?? new Date().toISOString(),
          })
          .eq("id", nf.id);
        toast.success(`Manifestação registrada — protocolo ${result.protocolo ?? "—"}`);
      } else {
        toast.error(`SEFAZ rejeitou: ${result.motivo ?? "—"}`);
      }
      qc.invalidateQueries({ queryKey: ["nfe-distribuicao"] });
    } catch (e) {
      notifyError(e);
    } finally {
      setManifestando(null);
    }
  };

  const handleNaoRealizadaConfirm = async () => {
    if (!naoRealizadaTarget) return;
    if (justNaoRealizada.trim().length < 15 || justNaoRealizada.trim().length > 255) {
      toast.error("Justificativa deve ter de 15 a 255 caracteres.");
      return;
    }
    const target = naoRealizadaTarget;
    const just = justNaoRealizada.trim();
    setNaoRealizadaTarget(null);
    setJustNaoRealizada("");
    await executarManifestacao(target, "210240", just);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Manifestação do Destinatário
            </SheetTitle>
            <SheetDescription>
              Capture NF-e de fornecedores pela chave de acesso e registre Ciência,
              Confirmação, Desconhecimento ou Operação Não Realizada na SEFAZ.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Adicionar nova chave */}
            <div className="rounded-md border p-4 space-y-3">
              <Label htmlFor="nova-chave">Capturar NF-e por chave de acesso</Label>
              <div className="flex gap-2">
                <Input
                  id="nova-chave"
                  value={novaChave}
                  onChange={(e) => setNovaChave(e.target.value.replace(/\D/g, "").slice(0, 44))}
                  placeholder="44 dígitos"
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleAdicionar}
                  disabled={salvando || !chaveValida(novaChave)}
                  className="gap-2"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {novaChave.replace(/\D/g, "").length}/44 dígitos. Os dados básicos
                (CNPJ emitente, série, número e mês de emissão) são extraídos da chave.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-sm font-semibold">
                NF-e capturadas ({notas.length})
              </h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : notas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma NF-e capturada ainda. Adicione uma chave acima.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notas.map((nf) => {
                    const st = STATUS_LABEL[nf.status_manifestacao] ?? STATUS_LABEL.sem_manifestacao;
                    const isLoading = manifestando === nf.id;
                    return (
                      <li key={nf.id} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              NF {nf.numero ?? "—"}/{nf.serie ?? "—"}{" "}
                              <span className="font-normal text-muted-foreground">
                                · CNPJ {nf.cnpj_emitente ?? "—"}
                              </span>
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground break-all">
                              {nf.chave_acesso}
                            </p>
                            {nf.data_manifestacao && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Manifestada em{" "}
                                {format(new Date(nf.data_manifestacao), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            )}
                          </div>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => executarManifestacao(nf, "210210")}
                            className="gap-1"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Ciência
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isLoading}
                            onClick={() => executarManifestacao(nf, "210200")}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => executarManifestacao(nf, "210220")}
                            className="gap-1"
                          >
                            <EyeOff className="h-3 w-3" /> Desconhecer
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isLoading}
                            onClick={() => {
                              setNaoRealizadaTarget(nf);
                              setJustNaoRealizada("");
                            }}
                            className="gap-1"
                          >
                            <XCircle className="h-3 w-3" /> Não realizada
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground rounded-md bg-muted/40 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Após Confirmação ou Operação Não Realizada não é mais possível
              alterar a manifestação. Use Ciência quando ainda for analisar a operação.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!naoRealizadaTarget}
        onOpenChange={(o) => !o && setNaoRealizadaTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operação Não Realizada</DialogTitle>
            <DialogDescription>
              Informe a justificativa (15 a 255 caracteres). Esta manifestação é
              irreversível e indica formalmente à SEFAZ que a operação não ocorreu.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={justNaoRealizada}
            onChange={(e) => setJustNaoRealizada(e.target.value.slice(0, 255))}
            placeholder="Ex.: Mercadoria não entregue / pedido cancelado pelo comprador antes do faturamento."
          />
          <p className="text-xs text-muted-foreground">
            {justNaoRealizada.trim().length}/255 (mín. 15)
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNaoRealizadaTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleNaoRealizadaConfirm}
              disabled={justNaoRealizada.trim().length < 15}
            >
              Confirmar manifestação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}