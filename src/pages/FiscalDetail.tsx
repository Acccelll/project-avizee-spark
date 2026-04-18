/**
 * Página de detalhe de Nota Fiscal.
 * Rota: /fiscal/:id
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { NotaFiscalDrawer } from "@/components/fiscal/NotaFiscalDrawer";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { useDetailActions } from "@/hooks/useDetailActions";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import type { NotaFiscal } from "@/pages/Fiscal";

export default function FiscalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { run, locked } = useDetailActions();
  const invalidate = useInvalidateAfterMutation();

  const { data: nf, loading, error, reload } = useDetailFetch<NotaFiscal>(id, async (nfId, signal) => {
    const { data, error: fetchErr } = await supabase
      .from("notas_fiscais")
      .select("*, fornecedores(nome_razao_social, cpf_cnpj), clientes(nome_razao_social), ordens_venda(numero)")
      .eq("id", nfId)
      .abortSignal(signal)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    return (data as unknown as NotaFiscal) ?? null;
  });

  function handleDelete(nfId: string) {
    run("delete", async () => {
      const { error: delErr } = await supabase
        .from("notas_fiscais")
        .update({ ativo: false })
        .eq("id", nfId);
      if (delErr) throw delErr;
      toast.success("Nota fiscal removida.");
      invalidate(["notas_fiscais", "fiscal"]);
      navigate("/fiscal");
    }).catch(() => {
      // erro já reportado via toast
    });
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive font-semibold">Erro ao carregar nota fiscal</p>
          <p className="text-xs text-muted-foreground">{getUserFriendlyError(error)}</p>
          <Button variant="outline" onClick={() => navigate("/fiscal")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Fiscal
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!nf) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Nota fiscal não encontrada.</p>
          <Button variant="outline" onClick={() => navigate("/fiscal")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Fiscal
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/fiscal")}
            aria-label="Voltar para lista de notas fiscais"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">NF {nf.numero}</span>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir detalhes da nota fiscal"
              disabled={locked("delete")}
            >
              <Edit className="h-4 w-4 mr-1.5" />
              Ver Detalhes
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-5 space-y-2 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Nota Fiscal</p>
              <p className="text-2xl font-bold font-mono text-primary">NF {nf.numero}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold font-mono">
                {Number(nf.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-medium capitalize">{nf.tipo === "entrada" ? "Entrada" : "Saída"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{nf.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Emissão</p>
              <p className="font-medium">
                {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>
          <div className="pt-2">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir painel de detalhes"
              disabled={locked("delete")}
            >
              Abrir Detalhes Completos
            </Button>
          </div>
        </div>
      </div>

      <NotaFiscalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={nf}
        onEdit={() => navigate("/fiscal")}
        onDelete={handleDelete}
        onConfirmar={() => reload()}
        onEstornar={() => reload()}
        onDevolucao={() => reload()}
        onDanfe={() => { /* DANFE PDF generation handled inside drawer */ }}
      />
    </AppLayout>
  );
}
