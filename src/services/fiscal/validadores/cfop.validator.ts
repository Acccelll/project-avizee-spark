/**
 * Validação e descrição de CFOPs (Código Fiscal de Operações e Prestações).
 */

export type CFOPNatureza = "entrada" | "saida";

const DESCRICOES_CFOP: Record<string, string> = {
  "1101": "Compra para industrialização ou produção rural",
  "1102": "Compra para comercialização",
  "1111": "Compra para industrialização de mercadoria recebida anteriormente",
  "1116": "Compra para industrialização originada de encomenda",
  "1201": "Devolução de venda de produção do estabelecimento",
  "1202": "Devolução de venda de mercadoria adquirida ou recebida de terceiros",
  "1252": "Transferência para comercialização",
  "1301": "Aquisição de serviço de comunicação",
  "1302": "Aquisição de serviço de transporte",
  "1401": "Compra para uso ou consumo",
  "1556": "Compra de material para uso ou consumo",
  "2101": "Compra para industrialização (outro estado)",
  "2102": "Compra para comercialização (outro estado)",
  "2201": "Devolução de venda de produção (outro estado)",
  "2202": "Devolução de venda de mercadoria (outro estado)",
  "2401": "Compra para uso ou consumo (outro estado)",
  "3101": "Compra para industrialização (exterior)",
  "3102": "Compra para comercialização (exterior)",
  "5101": "Venda de produção do estabelecimento",
  "5102": "Venda de mercadoria adquirida ou recebida de terceiros",
  "5111": "Venda de produção para uso ou consumo",
  "5116": "Venda de produção originada de encomenda",
  "5201": "Devolução de compra para industrialização",
  "5202": "Devolução de compra para comercialização",
  "5301": "Prestação de serviço de comunicação",
  "5302": "Prestação de serviço de transporte",
  "5401": "Venda de produção do estabelecimento em operação com ST",
  "5402": "Venda de mercadoria adquirida com ST",
  "5501": "Remessa para armazenagem",
  "5556": "Venda de material de uso ou consumo",
  "5667": "Venda de combustíveis e lubrificantes",
  "5933": "Prestação de serviço tributado pelo ISSQN",
  "6101": "Venda de produção (outro estado)",
  "6102": "Venda de mercadoria adquirida ou recebida de terceiros (outro estado)",
  "6201": "Devolução de compra (outro estado)",
  "6401": "Venda de produção com ST (outro estado)",
  "6402": "Venda de mercadoria com ST adquirida (outro estado)",
  "7101": "Exportação de produção do estabelecimento",
  "7102": "Exportação de mercadoria adquirida ou recebida de terceiros",
};

/**
 * Verifica se o CFOP é válido.
 * CFOP válido deve ter 4 dígitos, com primeiro dígito entre 1 e 9.
 */
export function validarCFOP(cfop: string): boolean {
  if (!cfop) return false;
  const limpo = cfop.replace(/\D/g, "");
  if (limpo.length !== 4) return false;
  const primeiro = parseInt(limpo[0]);
  return primeiro >= 1 && primeiro <= 9;
}

/**
 * Retorna a descrição do CFOP ou "CFOP não encontrado".
 */
export function getCFOPDescricao(cfop: string): string {
  const limpo = cfop.replace(/\D/g, "");
  return DESCRICOES_CFOP[limpo] ?? "CFOP não encontrado";
}

/**
 * Retorna a natureza (entrada/saída) do CFOP com base no primeiro dígito.
 * - 1xxx, 2xxx, 3xxx → entrada
 * - 5xxx, 6xxx, 7xxx → saída
 */
export function getCFOPNatureza(cfop: string): CFOPNatureza | null {
  const limpo = cfop.replace(/\D/g, "");
  if (limpo.length !== 4) return null;
  const primeiro = parseInt(limpo[0]);
  if (primeiro >= 1 && primeiro <= 3) return "entrada";
  if (primeiro >= 5 && primeiro <= 7) return "saida";
  return null;
}
