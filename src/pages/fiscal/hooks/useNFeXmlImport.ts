/**
 * Hook para importação de XML de NF-e.
 *
 * Encapsula toda a lógica de:
 *  - Parse do XML via `parseNFeXml`
 *  - Verificação de duplicidade pela chave de acesso (`verificarDuplicidadeChave`)
 *  - Casamento automático de fornecedor (por CNPJ) e produtos (por SKU/código interno)
 *  - Construção do payload `FiscalForm` + `GridItem[]` + mapa fiscal por item
 *
 * Extraído de `src/pages/Fiscal.tsx` na Fase 3 (parte 2) do roadmap fiscal
 * para reduzir o god component sem alterar comportamento.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { parseNFeXml, type NFeData } from "@/lib/nfeXmlParser";
import { verificarDuplicidadeChave } from "@/services/fiscal.service";
import type { GridItem } from "@/components/ui/ItemsGrid";

export interface FornecedorMatchRef {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string | null;
}

export interface ProdutoMatchRef {
  id: string;
  nome: string;
  sku: string | null;
  codigo_interno: string | null;
}

export interface NfItemFiscalDataLike {
  cfop?: string | null;
  ncm?: string | null;
  unidade?: string | null;
  icms_valor?: number | null;
  ipi_valor?: number | null;
  pis_valor?: number | null;
  cofins_valor?: number | null;
  descricao?: string | null;
  codigo_produto?: string | null;
}

export interface NFeXmlImportResult {
  nfe: NFeData;
  fornecedorId: string;
  items: GridItem[];
  fiscalMap: Record<number, NfItemFiscalDataLike>;
  unmatchedItemsCount: number;
}

export interface UseNFeXmlImportArgs {
  fornecedores: FornecedorMatchRef[];
  produtos: ProdutoMatchRef[];
}

/**
 * Importa um XML de NF-e a partir de um `File` e devolve o resultado já
 * normalizado para popular o formulário. Lança erro em caso de duplicidade
 * ou parse inválido — o caller decide como reagir (toast/modal).
 */
export function useNFeXmlImport({ fornecedores, produtos }: UseNFeXmlImportArgs) {
  const importXml = useCallback(
    async (file: File): Promise<NFeXmlImportResult | null> => {
      const xmlText = await file.text();
      const nfe: NFeData = parseNFeXml(xmlText);

      // Bloqueio de re-importação por chave de acesso (idempotência fiscal).
      if (nfe.chaveAcesso) {
        const isDuplicate = await verificarDuplicidadeChave(nfe.chaveAcesso);
        if (isDuplicate) {
          toast.error(
            `XML já importado anteriormente (chave: ${nfe.chaveAcesso.slice(0, 12)}…). Importação abortada.`,
          );
          return null;
        }
      }

      // Match de fornecedor por CNPJ (limpo).
      let fornecedorId = "";
      if (nfe.emitente.cnpj) {
        const cnpjClean = nfe.emitente.cnpj.replace(/\D/g, "");
        const matched = fornecedores.find(
          (f) => (f.cpf_cnpj || "").replace(/\D/g, "") === cnpjClean,
        );
        if (matched) {
          fornecedorId = matched.id;
          toast.info(`Fornecedor identificado: ${matched.nome_razao_social}`);
        } else {
          toast.info(
            `Fornecedor CNPJ ${nfe.emitente.cnpj} não encontrado no cadastro. Preencha manualmente.`,
          );
        }
      }

      // Match de produtos por código interno ou SKU.
      const items: GridItem[] = nfe.itens.map((nfeItem) => {
        const matchedProd = produtos.find(
          (p) => p.codigo_interno === nfeItem.codigo || p.sku === nfeItem.codigo,
        );
        return {
          produto_id: matchedProd?.id || "",
          codigo: nfeItem.codigo,
          descricao: matchedProd?.nome || nfeItem.descricao,
          quantidade: nfeItem.quantidade,
          valor_unitario: nfeItem.valorUnitario,
          valor_total: nfeItem.valorTotal,
        };
      });

      // Preserva campos fiscais que vêm do XML para reescrita ao salvar.
      const fiscalMap: Record<number, NfItemFiscalDataLike> = {};
      nfe.itens.forEach((nfeItem, idx) => {
        fiscalMap[idx] = {
          cfop: nfeItem.cfop || null,
          ncm: nfeItem.ncm || null,
          unidade: nfeItem.unidade || null,
          icms_valor: nfeItem.icms || null,
          ipi_valor: nfeItem.ipi || null,
          pis_valor: nfeItem.pis || null,
          cofins_valor: nfeItem.cofins || null,
          descricao: nfeItem.descricao || null,
          codigo_produto: nfeItem.codigo || null,
        };
      });

      const unmatchedItemsCount = items.filter((i) => !i.produto_id).length;

      return { nfe, fornecedorId, items, fiscalMap, unmatchedItemsCount };
    },
    [fornecedores, produtos],
  );

  return { importXml };
}