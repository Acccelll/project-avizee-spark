import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, RefreshCw, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useNotasPendentesForma, type NotaPendente } from "@/hooks/useNotasPendentesForma";
import { EditarPagamentoNotaModal } from "@/components/fiscal/EditarPagamentoNotaModal";
import type { NotaFiscal } from "@/types/domain";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatCnpj(doc: string | null | undefined): string {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

export function PendenciasPanel({ open, onClose }: Props) {
  const { data: notas = [], isLoading, refetch, isFetching } = useNotasPendentesForma();
  const [editTarget, setEditTarget] = useState<NotaPendente | null>(null);
  const qc = useQueryClient();

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["notas-pendentes-forma"] });
    qc.invalidateQueries({ queryKey: ["sidebar-alerts"] });
    qc.invalidateQueries({ queryKey: ["financeiro", "lancamentos"] });
    qc.invalidateQueries({ queryKey: ["financeiro", "kpis"] });
    setEditTarget(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Pendências de pagamento
                {notas.length > 0 && (
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    {notas.length}
                  </Badge>
                )}
              </SheetTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                title="Atualizar"
                aria-label="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <SheetDescription>
              NFs de entrada que geram financeiro mas estão sem forma de pagamento. Clique em
              <strong> Definir</strong> para resolver cada pendência.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
          ) : notas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold">Tudo em dia!</h3>
              <p className="text-sm text-muted-foreground">
                Não há notas fiscais de entrada aguardando forma de pagamento.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {notas.map((nota) => {
                const nome =
                  nota.fornecedores?.nome_razao_social || "Fornecedor desconhecido";
                return (
                  <div
                    key={nota.id}
                    className="rounded-lg border bg-card p-3 hover:border-warning/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-medium text-sm truncate">{nome}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatCnpj(nota.fornecedores?.cpf_cnpj)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground pt-0.5">
                          {nota.numero && (
                            <span className="font-mono">NF {nota.numero}</span>
                          )}
                          {nota.data_emissao && (
                            <span>
                              {new Date(nota.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-mono font-semibold text-sm">
                          {formatCurrency(Number(nota.valor_total || 0))}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setEditTarget(nota)}
                        >
                          <FileText className="h-3 w-3" /> Definir
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                {notas.length} nota(s) · exibindo até 100
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <EditarPagamentoNotaModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        nota={editTarget as unknown as NotaFiscal | null}
        onSaved={handleSaved}
      />
    </>
  );
}