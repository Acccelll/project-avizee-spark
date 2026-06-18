import { NfeCreateFormModal } from "@/pages/fiscal/components/NfeCreateFormModal";
import { NotaFiscalEditModal } from "@/components/fiscal/NotaFiscalEditModal";
import type { GridItem } from "@/components/ui/ItemsGrid";
import type { ParcelaPlano } from "@/pages/fiscal/components/ParcelasFiscalEditor";
import type { useFiscalModalState } from "@/pages/fiscal/hooks/useFiscalModalState";
import type { useFiscalXmlImport } from "@/pages/fiscal/hooks/useFiscalXmlImport";
import type { NotaFiscal } from "@/types/domain";
import type { NfItemFiscalData, FiscalFormState } from "@/pages/fiscal/hooks/useFiscalNotaForm";

type ModalState = ReturnType<typeof useFiscalModalState>;
type XmlApi = ReturnType<typeof useFiscalXmlImport>;

export interface FiscalNotaModalsSlotProps {
  modal: ModalState;
  xml: XmlApi;
  selected: NotaFiscal | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancelarRascunho: () => Promise<void> | void;
}

/**
 * Agrupa os dois modais de NF (criar + editar). Extraído do `Fiscal.tsx`
 * como parte da Etapa 6.3 (Pass 3) — apenas marcação, sem lógica nova.
 */
export function FiscalNotaModalsSlot({
  modal,
  xml,
  selected,
  onSubmit,
  onCancelarRascunho,
}: FiscalNotaModalsSlotProps) {
  const {
    modalOpen, setModalOpen, mode,
    form, setForm,
    items, setItems,
    itemContaContabil, setItemContaContabil,
    parcelas, setParcelas,
    primeiroVencimento, setPrimeiroVencimento,
    intervaloDias, setIntervaloDias,
    parcelasPlano, setParcelasPlano,
    saving,
    fornecedores, clientes, produtos,
    ordensVenda, contasContabeis, cartoes,
    valorProdutos, totalImpostos, totalNF,
  } = modal;

  return (
    <>
      <NfeCreateFormModal
        open={modalOpen && mode === "create"}
        onClose={() => { setModalOpen(false); xml.resetXmlOriginState(); }}
        form={form as unknown as Record<string, string | number | boolean>}
        setForm={(next) => setForm(next as unknown as FiscalFormState)}
        items={items}
        setItems={setItems as (items: GridItem[]) => void}
        itemContaContabil={itemContaContabil}
        setItemContaContabil={setItemContaContabil}
        parcelas={parcelas}
        setParcelas={setParcelas}
        primeiroVencimento={primeiroVencimento}
        setPrimeiroVencimento={setPrimeiroVencimento}
        intervaloDias={intervaloDias}
        setIntervaloDias={setIntervaloDias}
        parcelasPlano={parcelasPlano as ParcelaPlano[]}
        setParcelasPlano={setParcelasPlano}
        saving={saving}
        onSubmit={onSubmit}
        fornecedores={fornecedores}
        clientes={clientes}
        produtos={produtos}
        ordensVenda={ordensVenda}
        contasContabeis={contasContabeis}
        cartoes={cartoes}
        valorProdutos={valorProdutos}
        totalImpostos={totalImpostos}
        totalNF={totalNF}
        xmlOriginInfo={xml.xmlOriginInfo}
        traducaoLinhasCount={xml.traducaoLinhas.length}
        onAbrirTraducao={xml.openTraducaoEdit}
        onCriarProdutoQuick={xml.openQuickProdutoFromForm}
        onCriarFornecedorQuick={xml.openQuickFornecedorFromForm}
      />

      {selected && (
        <NotaFiscalEditModal
          open={modalOpen && mode === "edit"}
          onClose={() => setModalOpen(false)}
          selected={selected}
          form={form}
          setForm={setForm}
          items={items}
          setItems={setItems}
          itemContaContabil={itemContaContabil}
          setItemContaContabil={setItemContaContabil}
          parcelas={parcelas}
          setParcelas={setParcelas}
          parcelasPlano={parcelasPlano}
          setParcelasPlano={setParcelasPlano}
          saving={saving}
          onSubmit={onSubmit}
          onCancelarRascunho={selected.status === "pendente" ? onCancelarRascunho : undefined}
          fornecedores={fornecedores}
          clientes={clientes}
          ordensVenda={ordensVenda}
          contasContabeis={contasContabeis}
          produtosCrud={produtos}
          valorProdutos={valorProdutos}
          totalImpostos={totalImpostos}
          totalNF={totalNF}
          cartoes={cartoes}
        />
      )}
    </>
  );
}

// Helper re-export so consumers don't need to re-import the underlying type.
export type { NfItemFiscalData };