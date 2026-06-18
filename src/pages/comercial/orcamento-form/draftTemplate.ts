import type { UseFormReset, UseFormSetValue } from "react-hook-form";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { OrcamentoTemplate } from "@/pages/comercial/hooks/useOrcamentoTemplates";
import { type ClienteSnapshot, emptyCliente } from "./types";

export interface ApplyDraftDeps {
  reset: UseFormReset<OrcamentoFormValues>;
  setClienteSnapshot: (snap: ClienteSnapshot) => void;
  setItems: (items: OrcamentoItem[]) => void;
}

/** Aplica um draft persistido (localStorage) ao formulário de orçamento. */
export function applyOrcamentoDraft(draft: Record<string, unknown>, deps: ApplyDraftDeps) {
  const { reset, setClienteSnapshot, setItems } = deps;
  reset({
    numero: (draft.numero as string) || '',
    dataOrcamento: (draft.dataOrcamento as string) || new Date().toISOString().split('T')[0],
    status: ((draft.status as OrcamentoFormValues['status']) || 'rascunho'),
    clienteId: (draft.clienteId as string) || '',
    validade: (draft.validade as string) || '',
    desconto: Number(draft.desconto) || 0,
    impostoSt: Number(draft.impostoSt) || 0,
    impostoIpi: Number(draft.impostoIpi) || 0,
    freteValor: Number(draft.freteValor) || 0,
    outrasDespesas: Number(draft.outrasDespesas) || 0,
    pagamento: (draft.pagamento as string) || '',
    prazoPagamento: (draft.prazoPagamento as string) || '',
    prazoEntrega: (draft.prazoEntrega as string) || '',
    freteTipo: (draft.freteTipo as string) || '',
    servicoFrete: (draft.servicoFrete as string) || '',
    modalidade: (draft.modalidade as string) || '',
    observacoes: (draft.observacoes as string) || '',
    observacoesInternas: (draft.observacoesInternas as string) || '',
  });
  setClienteSnapshot((draft.clienteSnapshot as ClienteSnapshot) || emptyCliente);
  setItems((draft.items as OrcamentoItem[]) || []);
}

export interface ApplyTemplateDeps {
  setValue: UseFormSetValue<OrcamentoFormValues>;
  setItems: (items: OrcamentoItem[]) => void;
}

/** Aplica um template de orçamento (itens + condições comerciais) ao formulário. */
export function applyOrcamentoTemplate(tpl: OrcamentoTemplate, deps: ApplyTemplateDeps) {
  const { setValue, setItems } = deps;
  setItems(tpl.payload.items || []);
  setValue('pagamento', tpl.payload.pagamento || '');
  setValue('prazoPagamento', tpl.payload.prazoPagamento || '');
  setValue('prazoEntrega', tpl.payload.prazoEntrega || '');
  setValue('modalidade', tpl.payload.modalidade || '');
  // Templates antigos podem ter texto livre em freteTipo; tratá-lo como servicoFrete.
  if (['CIF','FOB','sem_frete'].includes(tpl.payload.freteTipo || '')) {
    setValue('freteTipo', tpl.payload.freteTipo || '');
  } else {
    setValue('servicoFrete', tpl.payload.freteTipo || '');
  }
  setValue('observacoes', tpl.payload.observacoes || '');
  setValue('observacoesInternas', tpl.payload.observacoes_internas || '');
}