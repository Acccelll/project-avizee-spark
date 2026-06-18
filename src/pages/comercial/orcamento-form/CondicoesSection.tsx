import { CreditCard } from "lucide-react";
import { OrcamentoCondicoesCard } from "@/components/Orcamento/OrcamentoCondicoesCard";
import { MobileSection } from "./MobileSection";

interface CondicoesSectionProps {
  quantidadeTotal: number;
  pesoTotal: number;
  pagamento: string;
  prazoPagamento: string;
  prazoEntrega: string;
  servicoFrete: string;
  modalidade: string;
  onChange: (field: string, value: string) => void;
}

/** Bloco "Condições Comerciais" do formulário de orçamento. */
export function CondicoesSection({
  quantidadeTotal,
  pesoTotal,
  pagamento,
  prazoPagamento,
  prazoEntrega,
  servicoFrete,
  modalidade,
  onChange,
}: CondicoesSectionProps) {
  return (
    <MobileSection title="Condições Comerciais" icon={CreditCard} defaultOpen>
      <OrcamentoCondicoesCard
        form={{
          quantidade_total: quantidadeTotal,
          peso_total: pesoTotal,
          pagamento,
          prazo_pagamento: prazoPagamento,
          prazo_entrega: prazoEntrega,
          servico_frete: servicoFrete,
          modalidade,
        }}
        onChange={onChange}
      />
    </MobileSection>
  );
}