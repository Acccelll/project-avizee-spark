import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { OrcamentoSidebarSummary } from "@/components/Orcamento/OrcamentoSidebarSummary";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { useOrcamentoForm } from "@/pages/comercial/orcamento-form/useOrcamentoForm";
import { IdentificacaoCard } from "@/pages/comercial/orcamento-form/IdentificacaoCard";
import { ClienteCard } from "@/pages/comercial/orcamento-form/ClienteCard";
import { ActionsToolbar } from "@/pages/comercial/orcamento-form/ActionsToolbar";
import { EditMetaBanner } from "@/pages/comercial/orcamento-form/EditMetaBanner";
import { ShareCard } from "@/pages/comercial/orcamento-form/ShareCard";
import { ItensSection } from "@/pages/comercial/orcamento-form/ItensSection";
import { ObservacoesSection } from "@/pages/comercial/orcamento-form/ObservacoesSection";
import { MidSummaryBar } from "@/pages/comercial/orcamento-form/MidSummaryBar";
import { FreteSection } from "@/pages/comercial/orcamento-form/FreteSection";
import { CondicoesSection } from "@/pages/comercial/orcamento-form/CondicoesSection";
import { LockedAlert } from "@/pages/comercial/orcamento-form/LockedAlert";
import { TemplateSaveDialog } from "@/pages/comercial/orcamento-form/TemplateSaveDialog";
import { EnviarEmailDialog } from "@/pages/comercial/orcamento-form/EnviarEmailDialog";
import { PreviewDialog, OffscreenPdfTemplate, type OrcamentoPdfData } from "@/pages/comercial/orcamento-form/PreviewDialog";
import { RestoreDraftDialog } from "@/pages/comercial/orcamento-form/RestoreDraftDialog";
import { MobileStickyFooter } from "@/pages/comercial/orcamento-form/MobileStickyFooter";
import { STATUS_LABEL } from "@/pages/comercial/orcamento-form/types";
import { notifyError } from "@/utils/errorMessages";
import { criarRevisaoOrcamento } from "@/services/orcamentos.service";

export default function OrcamentoForm() {
  const v = useOrcamentoForm();

  const handleCriarRevisao = async () => {
    if (!v.id) return;
    try {
      const novoId = await criarRevisaoOrcamento(v.id);
      if (novoId) {
        toast.success("Revisão criada.");
        v.navigate(`/orcamentos/${novoId}`, { replace: true });
      }
    } catch (err) { notifyError(err); }
  };

  const pdfData: OrcamentoPdfData = {
    numero: v.numero, dataOrcamento: v.dataOrcamento, clienteSnapshot: v.clienteSnapshot, items: v.items,
    totalProdutos: v.totalProdutos, desconto: v.desconto, impostoSt: v.impostoSt, impostoIpi: v.impostoIpi,
    freteValor: v.freteValor, outrasDespesas: v.outrasDespesas, valorTotal: v.valorTotal,
    quantidadeTotal: v.quantidadeTotal, pesoTotal: v.pesoTotal, pagamento: v.pagamento,
    prazoPagamento: v.prazoPagamento, prazoEntrega: v.prazoEntrega,
    freteTipo: v.freteTipo, servicoFrete: v.servicoFrete, modalidade: v.modalidade,
    observacoes: v.observacoes, empresaConfig: v.empresaConfig,
  };

  return (
    <PageShell
      backTo="/orcamentos"
      title={v.isEdit ? (v.isMobile ? "Editar Orçamento" : `Editando Orçamento${v.numero ? ` — ${v.numero}` : ""}`) : "Novo Orçamento"}
      subtitle={
        v.isMobile && v.isEdit && v.numero
          ? `${v.numero} · ${STATUS_LABEL[v.status] || v.status}`
          : v.isEdit ? "Revisão e ajuste da proposta comercial" : "Criação e emissão da proposta comercial"
      }
      actions={
        <ActionsToolbar
          saving={v.saving}
          isEdit={v.isEdit}
          isLocked={v.isLocked}
          templates={v.templates}
          onSave={v.handleSave}
          onPreview={() => v.setPreviewOpen(true)}
          onGeneratePdf={v.handleGeneratePdf}
          onDuplicate={v.handleDuplicate}
          onCriarRevisao={handleCriarRevisao}
          onApplyTemplate={v.applyTemplate}
          onOpenTemplateDialog={v.openTemplateDialog}
        />
      }
      meta={
        <EditMetaBanner
          isEdit={v.isEdit} isMobile={v.isMobile} numero={v.numero} status={v.status}
          clienteSnapshot={v.clienteSnapshot} dataOrcamento={v.dataOrcamento} validade={v.validade}
          lastAutoSaveAt={v.lastAutoSaveAt} valorTotal={v.valorTotal} pesoTotal={v.pesoTotal}
          items={v.items}
        />
      }
    >
      {v.isEdit && v.status && v.isLocked && (
        <LockedAlert status={v.status} onCriarRevisao={handleCriarRevisao} />
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 pb-32 lg:pb-0">
        <div className={cn("lg:col-span-8 space-y-5", v.isLocked && "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed")}>
          <fieldset disabled={v.isLocked} className="space-y-5 disabled:opacity-70 contents">
            <IdentificacaoCard
              register={v.register} control={v.control} fieldErrors={v.fieldErrors}
              numero={v.numero} status={v.status} id={v.id} isLocked={v.isLocked}
              statusOptions={v.statusOptions}
            />
            <ClienteCard
              clienteOptions={v.clienteOptions} clientes={v.clientes}
              clienteId={v.clienteId} clienteSnapshot={v.clienteSnapshot}
              fieldErrors={v.fieldErrors} onClienteChange={v.handleClienteChange}
              onQuickAdd={() => v.setQuickAddOpen(true)}
            />
            <ItensSection
              items={v.items} onItemsChange={v.setItems} produtos={v.produtos}
              precosEspeciais={v.precosEspeciais}
              baseAnalysis={v.baseAnalysis} scenarioAnalysis={v.scenarioAnalysis}
              scenarioConfig={v.scenarioConfig} onScenarioConfigChange={v.setScenarioConfig}
              internalAccess={v.internalAccess} totalProdutos={v.totalProdutos}
              pesoTotalCalculado={v.pesoTotalCalculado} pesoTotalOverride={v.pesoTotalOverride}
              onPesoOverrideChange={v.setPesoTotalOverride}
              valorTotal={v.valorTotal} desconto={v.desconto}
              impostoSt={v.impostoSt} impostoIpi={v.impostoIpi}
              freteValor={v.freteValor} outrasDespesas={v.outrasDespesas}
              onTotalChange={v.handleTotalChange}
              freteSimulacaoId={v.freteSimulacaoId}
              freteServico={v.freteServico || v.servicoFrete || null}
              onClearFrete={() => {
                v.setValue('freteValor', 0);
                v.setValue('servicoFrete', '');
                v.setFreteSimulacaoId(null);
              }}
            />
            <FreteSection
              orcamentoId={v.id || null} clienteId={v.clienteId}
              cepDestino={v.clienteSnapshot.cep}
              pesoTotal={v.pesoTotal} valorMercadoria={v.totalProdutos}
              freteValor={v.freteValor} simulacaoId={v.freteSimulacaoId}
              onEmbalagemPesoChange={v.setPesoEmbalagemTotal}
              onSelect={(payload) => {
                v.setValue('freteValor', payload.freteValor);
                v.setValue('servicoFrete', payload.servicoFrete || payload.freteTipo);
                if (payload.modalidade && ['CIF','FOB','sem_frete'].includes(payload.modalidade)) {
                  v.setValue('freteTipo', payload.modalidade);
                }
                v.setValue('prazoEntrega', payload.prazoEntrega);
                v.setValue('modalidade', payload.modalidade || v.modalidade);
                v.setFreteSimulacaoId(payload.freteSimulacaoId);
                v.setFreteTransportadoraId(payload.transportadoraId);
                v.setFreteOrigemFrete(payload.origemFrete);
                v.setFreteServico(payload.servicoFrete);
                v.setFretePrazoEntregaDias(payload.prazoEntregaDias);
                v.setFreteVolumes(payload.volumes);
                v.setFreteAlturaCm(payload.alturaCm);
                v.setFreteLarguraCm(payload.larguraCm);
                v.setFreteComprimentoCm(payload.comprimentoCm);
              }}
            />
            <CondicoesSection
              quantidadeTotal={v.quantidadeTotal} pesoTotal={v.pesoTotal}
              pagamento={v.pagamento} prazoPagamento={v.prazoPagamento}
              prazoEntrega={v.prazoEntrega} servicoFrete={v.servicoFrete || ''}
              modalidade={v.modalidade} onChange={v.handleCondicaoChange}
            />
            <ObservacoesSection register={v.register} isLocked={v.isLocked} />
          </fieldset>
        </div>

        <div className="hidden lg:col-span-4 lg:block">
          <OrcamentoSidebarSummary
            qtdItens={v.items.filter(i => i.produto_id).length} totalProdutos={v.totalProdutos}
            freteValor={v.freteValor} valorTotal={v.valorTotal}
            pesoTotal={v.pesoTotal} validade={v.validade}
          />
          {v.isEdit && (
            <ShareCard
              id={v.id} dataOrcamento={v.dataOrcamento} validade={v.validade}
              clienteEmail={v.clienteSnapshot.email}
              onOpenMailModal={() => v.setMailModalOpen(true)}
            />
          )}
        </div>
      </div>

      <MidSummaryBar items={v.items} pesoTotal={v.pesoTotal} validade={v.validade} valorTotal={v.valorTotal} />

      <PreviewDialog
        open={v.previewOpen} onOpenChange={v.setPreviewOpen}
        fullscreen={v.previewFullscreen}
        onToggleFullscreen={() => v.setPreviewFullscreen((x) => !x)}
        layout={v.layoutTemplate} onLayoutChange={v.setLayoutTemplate}
        zoom={v.previewZoom} onZoomChange={v.setPreviewZoom}
        autoScale={v.autoScale} stageRef={v.previewStageRef} pdfRef={v.pdfRef}
        data={pdfData} onDownloadPdf={v.handleGeneratePdf}
      />
      <OffscreenPdfTemplate ref={v.offscreenPdfRef} data={pdfData} layout={v.layoutTemplate} />

      <EnviarEmailDialog
        open={v.mailModalOpen} onOpenChange={v.setMailModalOpen}
        mailStep={v.mailStep} setMailStep={v.setMailStep}
        mailError={v.mailError} setMailError={v.setMailError}
        emailTemplate={v.emailTemplate} setEmailTemplate={v.setEmailTemplate}
        clienteSnapshot={v.clienteSnapshot} orcamentoId={v.id ?? null}
        numero={v.numero} validade={v.validade} valorTotal={v.valorTotal}
        buildPdfBlob={v.buildPdfBlob}
      />

      <RestoreDraftDialog
        open={v.restoreDraftOpen} onOpenChange={v.setRestoreDraftOpen}
        draftKey={v.draftKey} userId={v.user?.id}
        applyDraft={(payload) => v.applyDraft(payload as Parameters<typeof v.applyDraft>[0])}
      />

      <QuickAddClientModal
        open={v.quickAddOpen} onClose={() => v.setQuickAddOpen(false)}
        onCreated={async (newId) => {
          await v.queryClient.invalidateQueries({ queryKey: ["orcamento-form", "clientes-ativos"] });
          v.handleClienteChange(newId);
        }}
      />

      <TemplateSaveDialog
        open={v.templateDialogOpen}
        onOpenChange={(open) => !open && v.setTemplateDialogOpen(null)}
        name={v.templateName} onNameChange={v.setTemplateName}
        onConfirm={v.saveTemplate}
      />

      {v.confirmActionDialog}

      <MobileStickyFooter
        items={v.items} valorTotal={v.valorTotal} saving={v.saving}
        onSave={v.handleSave} onPreview={() => v.setPreviewOpen(true)}
        onGeneratePdf={v.handleGeneratePdf}
      />
    </PageShell>
  );
}