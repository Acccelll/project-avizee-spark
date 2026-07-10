/**
 * Mapeamento canônico de TRNTYPE do OFX para naturezas do ERP.
 * Referência: docs/financeiro-motor-importacao-ofx.md — Fase 1 do Motor
 * Inteligente de Importação Financeira. Todos os códigos padrão OFX 2.x
 * são cobertos; códigos não reconhecidos caem em "outros".
 */
export type NaturezaCanonica =
  | "credito"
  | "debito"
  | "transferencia"
  | "pix"
  | "boleto"
  | "cartao"
  | "tarifa"
  | "juros"
  | "estorno"
  | "cheque"
  | "saque"
  | "deposito"
  | "outros";

const MAP: Record<string, NaturezaCanonica> = {
  CREDIT: "credito",
  DEBIT: "debito",
  INT: "juros",
  DIV: "credito",
  FEE: "tarifa",
  SRVCHG: "tarifa",
  DEP: "deposito",
  ATM: "saque",
  POS: "cartao",
  XFER: "transferencia",
  CHECK: "cheque",
  PAYMENT: "debito",
  CASH: "saque",
  DIRECTDEP: "deposito",
  DIRECTDEBIT: "debito",
  REPEATPMT: "debito",
  HOLD: "outros",
  OTHER: "outros",
};

export function canonizarTrntype(trntype?: string | null): NaturezaCanonica {
  if (!trntype) return "outros";
  return MAP[trntype.trim().toUpperCase()] ?? "outros";
}