import { BarChart3 } from "lucide-react";
import { OrcamentoItemsGrid, type OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import {
  OrcamentoInternalAnalysisPanel,
  type RentabilidadeScenarioConfig,
} from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { OrcamentoTotaisCard } from "@/components/Orcamento/OrcamentoTotaisCard";
import { MobileSection } from "./MobileSection";
import type { Tables } from "@/integrations/supabase/types";
import type { OrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";
import type { RentabilidadeAnalise } from "@/lib/orcamentoRentabilidade";

interface ItensSectionProps {
  items: OrcamentoItem[];
  onItemsChange: (items: OrcamentoItem[]) => void;
  produtos: React.ComponentProps<typeof OrcamentoItemsGrid>["produtos"];
  precosEspeciais: Tables<"precos_especiais">[];
  baseAnalysis: RentabilidadeAnalise;
  scenarioAnalysis: RentabilidadeAnalise;
  scenarioConfig: RentabilidadeScenarioConfig;
  onScenarioConfigChange: (cfg: RentabilidadeScenarioConfig) => void;
  internalAccess: OrcamentoInternalAccess;
  totalProdutos: number;
  pesoTotalCalculado: number;
  pesoTotalOverride: number | null;
  onPesoOverrideChange: (v: number | null) => void;
  valorTotal: number;
  desconto: number;
  impostoSt: number;
  impostoIpi: number;
  freteValor: number;
  outrasDespesas: number;
  onTotalChange: (field: string, value: number) => void;
  freteSimulacaoId: string | null;
  freteServico: string | null;
  onClearFrete: () => void;
}

/** Bloco central do form: lista de itens + análise interna + totais. */
export function ItensSection({
  items,
  onItemsChange,
  produtos,
  precosEspeciais,
  baseAnalysis,
  scenarioAnalysis,
  scenarioConfig,
  onScenarioConfigChange,
  internalAccess,
  totalProdutos,
  pesoTotalCalculado,
  pesoTotalOverride,
  onPesoOverrideChange,
  valorTotal,
  desconto,
  impostoSt,
  impostoIpi,
  freteValor,
  outrasDespesas,
  onTotalChange,
  freteSimulacaoId,
  freteServico,
  onClearFrete,
}: ItensSectionProps) {
  return (
    <>
      <OrcamentoItemsGrid
        items={items}
        onChange={onItemsChange}
        produtos={produtos}
        precosEspeciais={precosEspeciais}
      />

      <MobileSection title="Análise Interna" icon={BarChart3} summary="Margem · Cenário" defaultOpen={false}>
        <OrcamentoInternalAnalysisPanel
          baseAnalysis={baseAnalysis}
          scenarioAnalysis={scenarioAnalysis}
          items={items}
          onItemsChange={onItemsChange}
          scenarioConfig={scenarioConfig}
          onScenarioConfigChange={onScenarioConfigChange}
          access={internalAccess}
        />
      </MobileSection>

      <OrcamentoTotaisCard
        totalProdutos={totalProdutos}
        pesoTotal={pesoTotalCalculado}
        pesoOverride={pesoTotalOverride}
        onPesoOverrideChange={onPesoOverrideChange}
        form={{
          valor_total: valorTotal,
          desconto,
          imposto_st: impostoSt,
          imposto_ipi: impostoIpi,
          frete_valor: freteValor,
          outras_despesas: outrasDespesas,
        }}
        onChange={onTotalChange}
        freteSimulacaoId={freteSimulacaoId}
        freteServico={freteServico}
        onClearFrete={onClearFrete}
      />
    </>
  );
}