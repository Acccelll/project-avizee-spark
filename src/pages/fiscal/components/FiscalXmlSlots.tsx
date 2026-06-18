import { TraducaoXmlDrawer } from "@/pages/fiscal/components/TraducaoXmlDrawer";
import { QuickAddProductModal } from "@/components/QuickAddProductModal";
import { QuickAddSupplierModal } from "@/components/QuickAddSupplierModal";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import type { useFiscalXmlImport } from "@/pages/fiscal/hooks/useFiscalXmlImport";
import type { ProdutoMatchRef } from "@/pages/fiscal/hooks/useNFeXmlImport";

type XmlApi = ReturnType<typeof useFiscalXmlImport>;

interface FiscalXmlSlotsProps {
  xml: XmlApi;
  produtos: ProdutoMatchRef[];
}

/**
 * Agrupa os modais/drawers do pipeline XML do Fiscal:
 *  - input oculto para anexar XML;
 *  - drawer de tradução XML;
 *  - quick-add de produto, fornecedor e cliente.
 *
 * Mantém o `Fiscal.tsx` enxuto sem alterar comportamento (Etapa 6.3, Pass 2).
 */
export function FiscalXmlSlots({ xml, produtos }: FiscalXmlSlotsProps) {
  return (
    <>
      <input
        ref={xml.anexarXmlInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={xml.handleAnexarXmlChange}
      />

      <TraducaoXmlDrawer
        open={xml.traducaoOpen}
        readOnly={xml.traducaoReadOnly}
        fornecedorNome={xml.pendingXmlImport?.fornecedorNome ?? xml.xmlOriginInfo?.fornecedorNome ?? ""}
        fornecedorId={xml.pendingXmlImport?.fornecedorId ?? xml.xmlOriginInfo?.fornecedorId ?? ""}
        produtos={produtos}
        linhas={xml.traducaoLinhas}
        onCancel={xml.handleTraducaoCancel}
        onConfirm={xml.handleTraducaoConfirm}
        onCreateProduto={(idx, nome) => {
          xml.setQuickProdutoLinhaIdx(idx);
          xml.setQuickProdutoNome(nome);
        }}
      />

      <QuickAddProductModal
        open={xml.quickProdutoLinhaIdx !== null}
        defaultNome={xml.quickProdutoNome}
        onClose={() => {
          xml.setQuickProdutoLinhaIdx(null);
          xml.setQuickProdutoNome("");
        }}
        onCreated={xml.handleQuickProdutoCreated}
      />

      <QuickAddSupplierModal
        open={xml.quickFornecedorOpen}
        defaults={xml.quickFornecedorDefaults}
        onClose={() => xml.setQuickFornecedorOpen(false)}
        onCreated={xml.handleQuickFornecedorCreated}
      />

      <QuickAddClientModal
        open={xml.quickClienteOpen}
        defaults={xml.quickClienteDefaults}
        onClose={() => xml.setQuickClienteOpen(false)}
        onCreated={xml.handleQuickClienteCreated}
      />
    </>
  );
}