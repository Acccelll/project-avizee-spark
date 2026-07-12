import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDestructive } from "@/hooks/useConfirmDestructive";
import { desfazerLote, listarLotes } from "@/services/conciliacaoCartao/importacaoLote.service";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function LotesImportacaoPanel() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDestructive({ verb: "Desfazer" });

  const q = useQuery({
    queryKey: ["cartao-importacao-lotes"],
    queryFn: listarLotes,
  });

  const desfazer = useMutation({
    mutationFn: (id: string) => desfazerLote(id),
    onSuccess: () => {
      toast.success("Lote desfeito");
      qc.invalidateQueries({ queryKey: ["cartao-importacao-lotes"] });
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao desfazer"),
  });

  const pedir = (id: string) => {
    void confirm(
      {
        verb: "Desfazer",
        entity: "lote de importação de faturas",
        sideEffects: [
          "Faturas criadas por este lote serão removidas",
          "Linhas auto‑vinculadas voltarão a ficar pendentes",
          "Lançamentos financeiros perdem a referência à fatura",
        ],
      },
      async () => { await desfazer.mutateAsync(id); },
    );
  };

  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Lotes de importação recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lote registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const resumo = r.resumo ?? {};
              const totalFaturas = resumo.faturas?.length ?? r.faturas_criadas.length;
              return (
                <div key={r.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {fmtDate(r.created_at)} · {totalFaturas} faturas · {resumo.total_vinculadas ?? 0} vinculadas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.desfeito_em ? `Desfeito em ${fmtDate(r.desfeito_em)}` : `${resumo.total_linhas ?? 0} linhas`}
                    </p>
                  </div>
                  {!r.desfeito_em && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => pedir(r.id)}
                      disabled={desfazer.isPending}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />Desfazer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {dialog}
      </CardContent>
    </Card>
  );
}