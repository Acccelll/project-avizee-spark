import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  FiscalSefazStatusBadge,
  FiscalInternalStatusBadge,
} from "@/components/fiscal/FiscalStatusBadges";
import { SefazAcoesPanel } from "@/pages/fiscal/components/SefazAcoesPanel";
import { PedidoCompraLinker } from "@/pages/fiscal/components/PedidoCompraLinker";
import {
  buildNFeDataFromDb,
  buildDanfeDataFromDb,
} from "@/services/fiscal/nfeBuilders.service";
import type { NotaFiscal } from "@/types/domain";
import { NfeFormBody } from "@/pages/fiscal/components/NfeFormBody";
import { useFiscalNotaForm } from "@/pages/fiscal/hooks/useFiscalNotaForm";
import { QuickAddSupplierModal } from "@/components/QuickAddSupplierModal";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanEditFinanceiroAvancado } from "@/hooks/useCanEditFinanceiroAvancado";

/**
 * Página de criação/edição de NF-e (Fase 4 do roadmap fiscal).
 *
 * Rotas:
 *   - /fiscal/novo            → criação (id === "novo")
 *   - /fiscal/:id/editar      → edição
 *
 * Read-only quando status_sefaz ∈ {autorizada, cancelada_sefaz, denegada}.
 */
const STATUS_SEFAZ_TRAVADOS = new Set([
  "autorizada",
  "cancelada_sefaz",
  "denegada",
]);

export default function NotaFiscalFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreate = !id || id === "novo";
  const notaId = isCreate ? null : id!;

  const fnf = useFiscalNotaForm({
    notaId,
    onSaved: (savedId) => {
      if (isCreate) navigate(`/fiscal/${savedId}/editar`, { replace: true });
      else navigate("/fiscal");
    },
  });

  const { isAdmin } = useIsAdmin();
  const { canEditAvancado } = useCanEditFinanceiroAvancado();
  const isMobile = useIsMobile();

  const [statusSefaz, setStatusSefaz] = useState<string | null>(null);
  const [statusErp, setStatusErp] = useState<string | null>(null);
  const [nfRow, setNfRow] = useState<NotaFiscal | null>(null);
  const [quickFornecedorOpen, setQuickFornecedorOpen] = useState(false);
  const [sefazOpen, setSefazOpen] = useState(!isMobile);
  const [isDirty, setIsDirty] = useState(false);
  const initialFormRef = useRef<string | null>(null);

  useEffect(() => {
    if (fnf.loading) return;
    const serialized = JSON.stringify(fnf.form);
    if (initialFormRef.current === null) {
      initialFormRef.current = serialized;
      return;
    }
    setIsDirty(serialized !== initialFormRef.current);
  }, [fnf.form, fnf.loading]);

  useEffect(() => {
    if (isCreate) return;
    (async () => {
      const { data } = await supabase
        .from("notas_fiscais")
        .select("*, fornecedores(nome_razao_social, cpf_cnpj), clientes(nome_razao_social)")
        .eq("id", id!)
        .maybeSingle();
      if (!data) return;
      setNfRow(data as unknown as NotaFiscal);
      setStatusSefaz((data as { status_sefaz?: string | null }).status_sefaz ?? null);
      setStatusErp((data as { status?: string | null }).status ?? null);
    })();
  }, [id, isCreate]);

  const wouldBeReadOnly =
    !isCreate && !!statusSefaz && STATUS_SEFAZ_TRAVADOS.has(statusSefaz);
  // Override de edição privilegiada: admin OU financeiro podem editar
  // qualquer NF (entrada/saída) independentemente do status interno/SEFAZ.
  // Mantemos o flag `isAdmin` legado apenas para compatibilidade dos textos.
  const isPrivilegedOverride = !isCreate && canEditAvancado;
  const readOnly = wouldBeReadOnly && !isPrivilegedOverride;
  const showAdminOverrideBanner =
    isPrivilegedOverride &&
    (wouldBeReadOnly || (statusErp && ["confirmada", "importada", "cancelada"].includes(statusErp)));
  // hint para evitar warning de variável não usada quando isAdmin sobra
  void isAdmin;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    void fnf.submit();
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/fiscal")}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isCreate ? "Nova Nota Fiscal" : `NF-e ${fnf.form.numero ?? ""}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isCreate
                ? "Preencha os dados da nota fiscal para emissão."
                : "Edite os dados da nota fiscal."}
            </p>
          </div>
        </div>
        {!isCreate && (
          <div className="flex items-center gap-2">
            {statusErp && <FiscalInternalStatusBadge status={statusErp} />}
            {statusSefaz && <FiscalSefazStatusBadge status={statusSefaz} />}
          </div>
        )}
      </div>

      {readOnly && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription className="flex items-center flex-wrap gap-1">
            Esta NF-e está
            {statusSefaz && <FiscalSefazStatusBadge status={statusSefaz} />}
            na SEFAZ. Para alterar, utilize Cancelar/Inutilizar pela tela de
            Fiscal e emita uma nova nota.
          </AlertDescription>
        </Alert>
      )}

      {showAdminOverrideBanner && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo administrador</AlertTitle>
          <AlertDescription>
            Você está editando uma NF de entrada já lançada
            {statusErp && (
              <Badge variant="secondary" className="mx-1">
                {statusErp}
              </Badge>
            )}
            {statusSefaz && (
              <Badge variant="secondary" className="mx-1">
                {statusSefaz}
              </Badge>
            )}
            . Alterações afetam estoque e financeiro vinculados — confirme com cuidado e revise os lançamentos após salvar.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isCreate ? "Emissão" : "Edição"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!isCreate && nfRow && (
            <Collapsible
              open={sefazOpen}
              onOpenChange={setSefazOpen}
              className="mb-4 rounded-lg border bg-muted/30"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ações SEFAZ
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${sefazOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <SefazAcoesPanel
                  nf={nfRow}
                  buildNFeData={buildNFeDataFromDb}
                  buildDanfeData={buildDanfeDataFromDb}
                />
                {nfRow.tipo === "entrada" && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pedido de Compra
                    </p>
                    <PedidoCompraLinker
                      notaFiscalId={nfRow.id}
                      fornecedorId={nfRow.fornecedor_id}
                      pedidoCompraIdAtual={(nfRow as { pedido_compra_id?: string | null }).pedido_compra_id ?? null}
                      disabled={readOnly}
                      nfValorTotal={nfRow.valor_total}
                      nfDataEmissao={nfRow.data_emissao}
                    />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          {fnf.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
                <NfeFormBody
                  form={fnf.form as unknown as Record<string, string | number | boolean>}
                  setForm={(next) => fnf.setForm(next as never)}
                  items={fnf.items}
                  setItems={fnf.setItems}
                  itemContaContabil={fnf.itemContaContabil}
                  setItemContaContabil={fnf.setItemContaContabil}
                  parcelas={fnf.parcelas}
                  setParcelas={fnf.setParcelas}
                  primeiroVencimento={fnf.primeiroVencimento}
                  setPrimeiroVencimento={fnf.setPrimeiroVencimento}
                  intervaloDias={fnf.intervaloDias}
                  setIntervaloDias={fnf.setIntervaloDias}
                  parcelasPlano={fnf.parcelasPlano}
                  setParcelasPlano={fnf.setParcelasPlano}
                  fornecedores={fnf.fornecedores}
                  clientes={fnf.clientes}
                  produtos={fnf.produtos}
                  ordensVenda={fnf.ordensVenda}
                  contasContabeis={fnf.contasContabeis}
                  cartoes={fnf.cartoes}
                  valorProdutos={fnf.valorProdutos}
                  totalImpostos={fnf.totalImpostos}
                  totalNF={fnf.totalNF}
                  xmlOriginInfo={null}
                  traducaoLinhasCount={0}
                  onAbrirTraducao={() => {}}
                  onCriarProdutoQuick={() => {}}
                  onCriarFornecedorQuick={() => setQuickFornecedorOpen(true)}
                />
              </fieldset>
              {!readOnly && (
                <>
                  {/* Desktop: botões inline */}
                  <div className="hidden md:flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => navigate("/fiscal")}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={fnf.saving}>
                      {fnf.saving ? "Salvando..." : "Salvar NF-e"}
                    </Button>
                  </div>
                  {/* Mobile: spacer + sticky footer */}
                  {(isDirty || isCreate) && (
                    <>
                      <div className="md:hidden h-20" aria-hidden />
                      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => navigate("/fiscal")}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={fnf.saving} className="flex-1 min-h-11">
                          {fnf.saving ? "Salvando..." : isCreate ? "Criar NF-e" : "Salvar alterações"}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <QuickAddSupplierModal
        open={quickFornecedorOpen}
        defaults={{}}
        onClose={() => setQuickFornecedorOpen(false)}
        onCreated={async (fornecedorId) => {
          await fnf.refetchFornecedores();
          setQuickFornecedorOpen(false);
          fnf.setForm({ ...(fnf.form as Record<string, unknown>), fornecedor_id: fornecedorId } as never);
          toast.success("Fornecedor cadastrado e selecionado.");
        }}
      />
    </div>
  );
}