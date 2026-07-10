import { ModulePage } from "@/components/ModulePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar, type FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  CheckCheck, XCircle, GitMerge, Landmark, Info, CalendarPlus, FileUp,
} from "lucide-react";
import { useMemo } from "react";
import { exportarParaExcel } from "@/services/export.service";
import { useConciliacao } from "@/pages/financeiro/conciliacao/useConciliacao";
import { conciliacaoColumns } from "@/pages/financeiro/conciliacao/conciliacaoColumns";
import { ConciliacaoTopControls } from "@/pages/financeiro/conciliacao/ConciliacaoTopControls";
import { OFXMatchingPane } from "@/pages/financeiro/conciliacao/OFXMatchingPane";
import { VincularBottomSheet } from "@/pages/financeiro/conciliacao/VincularBottomSheet";
import { ConfirmFloatingBar } from "@/pages/financeiro/conciliacao/ConfirmFloatingBar";

const statusConciliacaoOptions: MultiSelectOption[] = [
  { value: "pendente", label: "Pendente" },
  { value: "conciliado", label: "Conciliado" },
  { value: "divergente", label: "Divergente" },
];
const tipoOptions: MultiSelectOption[] = [
  { value: "receber", label: "A Receber" },
  { value: "pagar", label: "A Pagar" },
];
const origemOptions: MultiSelectOption[] = [
  { value: "manual", label: "Manual" },
  { value: "nf", label: "NF Fiscal" },
  { value: "parcela", label: "Parcelamento" },
];

export default function Conciliacao() {
  const v = useConciliacao();

  const handleExportar = async () => {
    const rows = v.filteredData.map((l) => ({
      Descrição: l.descricao,
      Tipo: l.tipo,
      Vencimento: l.data_vencimento,
      "Valor (R$)": Number(l.valor),
      Status: l.status ?? "",
      Conciliação: l.statusConciliacao,
    }));
    await exportarParaExcel({ titulo: "Conciliacao Bancaria", rows });
  };

  const activeFilterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (v.statusConcFilters.length > 0)
      chips.push({ key: "statusConc", label: "Conciliação", value: v.statusConcFilters, displayValue: v.statusConcFilters.join(", ") });
    if (v.tipoFilters.length > 0)
      chips.push({ key: "tipo", label: "Tipo", value: v.tipoFilters, displayValue: v.tipoFilters.join(", ") });
    if (v.origemFilters.length > 0)
      chips.push({ key: "origem", label: "Origem", value: v.origemFilters, displayValue: v.origemFilters.join(", ") });
    return chips;
  }, [v.statusConcFilters, v.tipoFilters, v.origemFilters]);

  return (
    <>
      <ModulePage title="Conciliação Bancária" subtitle="Central de conferência financeira entre ERP e movimentação real">
        <ConciliacaoTopControls
          isMobile={v.isMobile}
          contasBancarias={v.contasBancarias}
          selectedConta={v.selectedConta}
          onContaChange={v.handleContaChange}
          dataInicio={v.dataInicio}
          dataFim={v.dataFim}
          setDataInicio={v.setDataInicio}
          setDataFim={v.setDataFim}
          fileInputRef={v.fileInputRef}
          onFileSelect={v.handleFileSelect}
          uploading={v.uploading}
          hasExtrato={v.extratoItems.length > 0}
          hasLancamentos={v.lancamentos.length > 0}
          onConciliacaoAutomatica={v.handleConciliacaoAutomatica}
          onMatchPorValor={v.handleAutoMatch}
          onExportar={handleExportar}
        />

        {v.selectedConta ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard title="Conciliados" value={v.pareados}
              subtitle={v.extratoItems.length > 0 ? `de ${v.extratoItems.length} do extrato` : "pares confirmados"}
              variant="success" icon={CheckCheck} />
            <SummaryCard title="Pendentes ERP" value={v.pendentesERP} subtitle="lançamentos sem par" variant="warning" icon={GitMerge} />
            <SummaryCard title="Sem Correspondência" value={v.semParOFX}
              subtitle={v.extratoItems.length > 0 ? "itens do extrato OFX" : "importe um extrato OFX"}
              variant={v.semParOFX > 0 ? "danger" : "default"} icon={XCircle} />
            <SummaryCard title="Total no Período" value={v.lancamentos.length}
              subtitle={`${v.selectedConta ? "lançamentos da conta" : "selecione uma conta"}`}
              variant="info" icon={Landmark} />
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/10 p-8 mb-6 text-center">
            <Landmark className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold">Configure a conciliação bancária</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Siga as etapas para conferir seus lançamentos financeiros com o extrato do banco.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
              {[
                ["1", "Selecione a conta"],
                ["2", "Escolha o período"],
                ["3", "Importe o OFX"],
                ["4", "Concilie"],
              ].map(([n, label]) => (
                <div key={n} className="rounded-lg border bg-card p-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{n}</span>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {v.selectedConta && (
          <div className="flex items-center justify-between mb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] gap-1 border-info/40 text-info bg-info/5 cursor-help">
                    <Info className="w-3 h-3" /> Eixo: baixa + vencimento
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs leading-relaxed">
                    A grade considera dois eixos: títulos com <strong>baixa não estornada</strong> no
                    período (eixo da liquidação) e títulos em <strong>aberto/parcial</strong> com
                    vencimento no período (candidatos a nova baixa).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <AdvancedFilterBar
          searchValue={v.searchTerm}
          onSearchChange={v.setSearchTerm}
          searchPlaceholder="Buscar por descrição, tipo, status ou forma de pagamento..."
          activeFilters={activeFilterChips}
          onRemoveFilter={v.handleRemoveFilter}
          onClearAll={v.handleClearAll}
          count={v.filteredData.length}
        >
          <MultiSelect options={statusConciliacaoOptions} selected={v.statusConcFilters}
            onChange={v.setStatusConcFilters} placeholder="Conciliação" className="w-[140px]" />
          <MultiSelect options={tipoOptions} selected={v.tipoFilters}
            onChange={v.setTipoFilters} placeholder="Tipo" className="w-[120px]" />
          <MultiSelect options={origemOptions} selected={v.origemFilters}
            onChange={v.setOrigemFilters} placeholder="Origem" className="w-[120px]" />
        </AdvancedFilterBar>

        {v.selectedConta && !v.loadingLanc && v.lancamentos.length === 0 ? (
          <div className="bg-card rounded-xl border">
            <EmptyState
              variant="noResults" icon={CalendarPlus}
              title="Nenhum lançamento no período"
              description="Tente ampliar o intervalo de datas ou importar um extrato OFX para começar a conciliar."
              action={
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => {
                    const [y, m, d] = v.dataFim.split("-").map(Number);
                    const next = new Date(y, m - 1, d);
                    next.setDate(next.getDate() + 30);
                    v.setDataFim(next.toISOString().slice(0, 10));
                  }}>
                    <CalendarPlus className="w-4 h-4 mr-1.5" /> Ampliar período (+30 dias)
                  </Button>
                  <Button size="sm" onClick={() => v.fileInputRef.current?.click()} disabled={v.uploading}>
                    <FileUp className="w-4 h-4 mr-1.5" /> Importar OFX
                  </Button>
                </div>
              }
            />
          </div>
        ) : v.selectedConta && v.extratoItems.length === 0 && v.lancamentos.length > 0 ? (
          <>
            <div className="bg-card rounded-xl border mb-4">
              <EmptyState
                variant="firstUse" icon={FileUp}
                title="Importe um extrato OFX para conciliar"
                description="Há lançamentos no período aguardando confronto. Carregue o arquivo OFX do banco para iniciar o pareamento automático."
                action={
                  <Button size="sm" onClick={() => v.fileInputRef.current?.click()} disabled={v.uploading}>
                    <FileUp className="w-4 h-4 mr-1.5" />
                    {v.uploading ? "Importando..." : "Importar extrato OFX"}
                  </Button>
                }
              />
            </div>
            <DataTable columns={conciliacaoColumns} data={v.filteredData} loading={v.loadingLanc}
              moduleKey="conciliacao" showColumnToggle
              mobileStatusKey="statusConciliacao" mobileIdentifierKey="data_vencimento" />
          </>
        ) : (
          <DataTable columns={conciliacaoColumns} data={v.filteredData} loading={v.loadingLanc}
            moduleKey="conciliacao" showColumnToggle
            emptyTitle={!v.selectedConta ? "Selecione uma conta bancária" : "Nenhum lançamento encontrado"}
            emptyDescription={!v.selectedConta
              ? "Escolha uma conta e um período para visualizar os lançamentos para conciliação."
              : "Tente ajustar o período ou os filtros de busca."}
            mobileStatusKey="statusConciliacao" mobileIdentifierKey="descricao" />
        )}

        {v.extratoItems.length > 0 && (
          <OFXMatchingPane
            extratoItems={v.extratoItems} lancamentos={v.lancamentos} matches={v.matches}
            showOFXPane={v.showOFXPane} setShowOFXPane={v.setShowOFXPane}
            getMatch={v.getMatch} usedLancamentoIds={v.usedLancamentoIds}
            pareados={v.pareados} semParOFX={v.semParOFX}
            confirming={v.confirming} selectedConta={v.selectedConta}
            onManualMatch={v.handleManualMatch}
            onAbrirVincular={(id) => {
              v.setVincularExtratoId(id);
              v.setVincularSearch("");
              v.setVincularOpen(true);
            }}
            onCriarInline={v.handleCriarLancamentoInline}
            onConfirmar={v.handleConfirmarConciliacao}
            onConfirmarSelecao={v.handleConfirmarSelecao}
            onDesvincularExtrato={v.handleDesvincularExtrato}
            sugestoesPersistidas={v.sugestoesPersistidas}
            onAceitarSugestao={v.handleAceitarSugestao}
            onAceitarSugestoesPersistidas={v.handleAceitarSugestoesPersistidas}
            onRejeitarSugestao={v.handleRejeitarSugestao}
          />
        )}

        {!v.selectedConta && v.extratoItems.length === 0 && (
          <div className="py-12 text-center border rounded-xl bg-muted/10 mt-4">
            <Landmark className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Selecione uma conta bancária para começar</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Escolha a conta e o período para ver os lançamentos e iniciar a conciliação
            </p>
          </div>
        )}
      </ModulePage>

      <ConfirmFloatingBar
        matches={v.matches}
        lancamentosComStatus={v.lancamentosComStatus}
        semParOFX={v.semParOFX}
        confirming={v.confirming}
        onDescartar={() => v.setMatches([])}
        onConfirmar={v.handleConfirmarConciliacao}
      />

      <VincularBottomSheet
        open={v.vincularOpen}
        onOpenChange={v.setVincularOpen}
        vincularExtratoId={v.vincularExtratoId}
        vincularSearch={v.vincularSearch}
        setVincularSearch={v.setVincularSearch}
        extratoItems={v.extratoItems}
        lancamentos={v.lancamentos}
        usedLancamentoIds={v.usedLancamentoIds}
        onManualMatch={v.handleManualMatch}
      />
    </>
  );
}