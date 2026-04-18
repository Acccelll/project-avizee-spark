/**
 * Página de detalhe de Nota Fiscal.
 * Rota: /fiscal/:id
 *
 * Shell mínimo que orquestra o NotaFiscalDrawer. O conteúdo (resumo, abas,
 * itens, financeiro) vive dentro do drawer — esta página apenas fornece
 * cabeçalho, navegação de volta e o ponto de entrada para reabrir o painel.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Receipt, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ListPageHeader } from "@/components/list/ListPageHeader";
import { NotaFiscalDrawer } from "@/components/fiscal/NotaFiscalDrawer";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { toast } from "sonner";
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
        <div className="p-6">
          <DetailLoading />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <DetailError error={error} onRetry={reload} onBack={() => navigate("/fiscal")} backLabel="Voltar ao Fiscal" />
        </div>
      </AppLayout>
    );
  }

  if (!nf) {
    return (
      <AppLayout>
        <div className="p-6">
          <DetailEmpty
            title="Nota fiscal não encontrada"
            description="O documento pode ter sido removido ou o link está incorreto."
            onBack={() => navigate("/fiscal")}
            backLabel="Voltar ao Fiscal"
          />
        </div>
      </AppLayout>
    );
  }

  const tipoLabel = nf.tipo === "entrada" ? "Entrada" : "Saída";
  const contraparte =
    nf.tipo === "entrada"
      ? (nf as any).fornecedores?.nome_razao_social
      : (nf as any).clientes?.nome_razao_social;

  return (
    <AppLayout>
      <div className="p-6">
        <ListPageHeader
          title={`NF ${nf.numero}`}
          contextLine={
            <span className="inline-flex items-center gap-1.5">
              <Receipt className="h-3 w-3" />
              Nota Fiscal · {tipoLabel}
              {contraparte ? ` · ${contraparte}` : ""}
            </span>
          }
          subtitle={
            nf.data_emissao
              ? `Emitida em ${new Date(nf.data_emissao).toLocaleDateString("pt-BR")}`
              : undefined
          }
          primaryAction={{
            label: "Abrir Detalhes",
            icon: Eye,
            onClick: () => setDrawerOpen(true),
            disabled: locked("delete"),
          }}
          secondaryActions={[
            {
              label: "Voltar ao Fiscal",
              icon: ArrowLeft,
              onClick: () => navigate("/fiscal"),
            },
          ]}
        />
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
