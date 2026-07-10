/**
 * Extratores de MEMO OFX — Fase 1 do Motor Inteligente de Importação.
 *
 * Cada extrator olha padrões livres do campo MEMO (Banco Inter, Mercado
 * Pago, RecargaPay, PIX genérico e boleto genérico) e devolve um objeto
 * `MemoExtracao` normalizado. A ordem de tentativa é do mais específico
 * (padrões proprietários) para o mais genérico (PIX/boleto), garantindo
 * que "PIX enviado — Mercado Pago" caia primeiro no extrator do MP.
 *
 * Nenhum extrator lança — se o padrão não bate, retorna `null` e o
 * próximo é tentado.
 */

export interface MemoExtracao {
  favorecido?: string;
  favorecido_documento?: string;
  forma_pagamento?: "pix" | "boleto" | "cartao" | "ted" | "doc" | "debito_automatico";
  documento?: string;
  origem_padrao?: string;
  categoria_sugerida?: string;
  is_transferencia_interna?: boolean;
}

const CPF_RE = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
const CNPJ_RE = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
const BOLETO_LINHA_RE = /(\d{5}\.?\d{5}\s?\d{5}\.?\d{6}\s?\d{5}\.?\d{6}\s?\d{1}\s?\d{14})/;

function limparNome(s?: string): string | undefined {
  return s?.replace(/\s+/g, " ").trim().slice(0, 120) || undefined;
}

function extrairDocumento(memo: string): string | undefined {
  return CNPJ_RE.exec(memo)?.[1] ?? CPF_RE.exec(memo)?.[1];
}

/** Banco Inter — padrões: "Pix enviado — <Nome> — CPF <doc>". */
export function extractInter(memo: string): MemoExtracao | null {
  const m = /^(?:PIX|Pix)\s+(?:enviado|recebido)\b[\s\S]*?(?:—|-)\s*([^—\-]+?)(?:\s+(?:—|-)\s*(?:CPF|CNPJ)\s*([\d./\-]+))?$/i.exec(memo.trim());
  if (!m) return null;
  return {
    origem_padrao: "banco_inter",
    forma_pagamento: "pix",
    favorecido: limparNome(m[1]),
    favorecido_documento: m[2]?.replace(/\D/g, "") || extrairDocumento(memo),
  };
}

/** Mercado Pago — "Mercado Pago", "MERCADOPAGO*<Loja>". */
export function extractMercadoPago(memo: string): MemoExtracao | null {
  if (!/mercado\s*pago|mercadopago/i.exec(memo)) return null;
  const loja = /mercadopago\s*\*\s*([^\s]+)/i.exec(memo)?.[1];
  return {
    origem_padrao: "mercado_pago",
    forma_pagamento: /pix/i.test(memo) ? "pix" : undefined,
    favorecido: limparNome(loja) ?? "Mercado Pago",
    favorecido_documento: extrairDocumento(memo),
    categoria_sugerida: "marketplace",
  };
}

/** RecargaPay — "RECARGAPAY*<serviço>". */
export function extractRecargaPay(memo: string): MemoExtracao | null {
  if (!/recargapay/i.exec(memo)) return null;
  const servico = /recargapay\s*\*\s*([^\s]+)/i.exec(memo)?.[1];
  return {
    origem_padrao: "recargapay",
    forma_pagamento: "cartao",
    favorecido: limparNome(servico) ?? "RecargaPay",
    categoria_sugerida: "recargas_servicos",
  };
}

/** PIX genérico — captura chave/valor quando os padrões acima não batem. */
export function extractPixGenerico(memo: string): MemoExtracao | null {
  if (!/\bpix\b/i.test(memo)) return null;
  const nome = /(?:para|de|favorecido)\s*[:\-]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ\s]{2,60})/i.exec(memo)?.[1];
  return {
    origem_padrao: "pix_generico",
    forma_pagamento: "pix",
    favorecido: limparNome(nome),
    favorecido_documento: extrairDocumento(memo),
  };
}

/** Boleto genérico — detecta linha digitável ou palavra-chave. */
export function extractBoleto(memo: string): MemoExtracao | null {
  const linha = BOLETO_LINHA_RE.exec(memo)?.[1];
  if (!linha && !/\bboleto|cobran[çc]a\b/i.test(memo)) return null;
  return {
    origem_padrao: "boleto",
    forma_pagamento: "boleto",
    documento: linha?.replace(/\D/g, ""),
    favorecido_documento: extrairDocumento(memo),
  };
}

const EXTRATORES = [
  extractInter,
  extractMercadoPago,
  extractRecargaPay,
  extractPixGenerico,
  extractBoleto,
];

/**
 * Aplica os extratores na ordem e devolve a primeira extração positiva.
 * Sempre retorna um objeto (pode ser vazio) para simplificar consumo.
 */
export function extrairMemo(memo: string | undefined | null): MemoExtracao {
  if (!memo) return {};
  for (const fn of EXTRATORES) {
    const r = fn(memo);
    if (r) return r;
  }
  return { favorecido_documento: extrairDocumento(memo) };
}