import { Truck } from "lucide-react";
import { FreteSimuladorCard } from "@/components/Orcamento/FreteSimuladorCard";
import type { FreteSelecaoPayload } from "@/services/freteSimulacao.service";
import { formatCurrency } from "@/lib/format";
import { MobileSection } from "./MobileSection";

interface FreteSectionProps {
  orcamentoId: string | null;
  clienteId: string;
  cepDestino: string;
  pesoTotal: number;
  valorMercadoria: number;
  freteValor: number;
  simulacaoId: string | null;
  onEmbalagemPesoChange: (peso: number) => void;
  onSelect: (payload: FreteSelecaoPayload) => void;
}

/** Bloco "Frete" — simulador encapsulado em MobileSection com summary do valor. */
export function FreteSection({
  orcamentoId,
  clienteId,
  cepDestino,
  pesoTotal,
  valorMercadoria,
  freteValor,
  simulacaoId,
  onEmbalagemPesoChange,
  onSelect,
}: FreteSectionProps) {
  return (
    <MobileSection
      title="Frete"
      icon={Truck}
      summary={freteValor > 0 ? formatCurrency(freteValor) : "Sem frete definido"}
      defaultOpen={false}
    >
      <FreteSimuladorCard
        orcamentoId={orcamentoId}
        clienteId={clienteId}
        cepDestino={cepDestino}
        pesoTotal={pesoTotal}
        valorMercadoria={valorMercadoria}
        simulacaoId={simulacaoId}
        onEmbalagemPesoChange={onEmbalagemPesoChange}
        onSelect={onSelect}
      />
    </MobileSection>
  );
}