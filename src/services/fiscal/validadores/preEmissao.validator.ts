/**
 * Validador agregador de pré-emissão SEFAZ.
 *
 * Roda antes da chamada `autorizarNFe` para bloquear envios obviamente
 * inválidos (NCM/CFOP malformados, dados de emitente/destinatário ausentes).
 * Reduz rejeições da SEFAZ por validação estrutural simples.
 *
 * Compõe os validadores existentes: `validarNCM` e `validarCFOP`.
 */
import { validarNCM, validarCFOP } from "@/services/fiscal/validadores";

export interface ErroPreEmissao {
  campo: string;
  mensagem: string;
}

interface ItemNF {
  ncm?: string | null;
  cfop?: string | null;
  descricao?: string | null;
}

interface NotaParaValidacao {
  cnpj_emitente?: string | null;
  destinatario_cnpj_cpf?: string | null;
  destinatario_nome?: string | null;
}

/**
 * Valida estrutura mínima da NF antes do envio à SEFAZ.
 *
 * @param nf     Cabeçalho da NF (campos do emitente/destinatário).
 * @param itens  Itens da NF — cada um com NCM e CFOP.
 * @returns      Lista de erros estruturados; vazia se OK.
 */
export function validarPreEmissao(
  nf: NotaParaValidacao,
  itens: ItemNF[] = [],
): ErroPreEmissao[] {
  const erros: ErroPreEmissao[] = [];

  if (!nf.cnpj_emitente || nf.cnpj_emitente.trim().length < 14) {
    erros.push({
      campo: "Emitente",
      mensagem: "CNPJ do emitente não configurado",
    });
  }

  if (!nf.destinatario_cnpj_cpf || nf.destinatario_cnpj_cpf.trim().length < 11) {
    erros.push({
      campo: "Destinatário",
      mensagem: "CPF/CNPJ do destinatário ausente ou inválido",
    });
  }

  if (!itens.length) {
    erros.push({
      campo: "Itens",
      mensagem: "NF precisa de ao menos 1 item",
    });
  }

  itens.forEach((item, idx) => {
    const label = `Item ${idx + 1}`;
    if (!item.ncm || !validarNCM(item.ncm)) {
      erros.push({
        campo: label,
        mensagem: `NCM inválido: ${item.ncm ?? "vazio"}`,
      });
    }
    if (!item.cfop || !validarCFOP(item.cfop)) {
      erros.push({
        campo: label,
        mensagem: `CFOP inválido: ${item.cfop ?? "vazio"}`,
      });
    }
  });

  return erros;
}
