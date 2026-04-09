import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

export interface TemplateConfig {
  items: OrcamentoItem[];
  pagamento: string;
  prazoPagamento: string;
  prazoEntrega: string;
  modalidade: string;
  freteTipo: string;
  observacoes?: string;
  observacoes_internas?: string;
}
