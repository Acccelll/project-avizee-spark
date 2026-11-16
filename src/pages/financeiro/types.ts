import type { ContaBancaria } from "@/types/domain";
import type { CartaoCredito } from "@/services/cartoesCredito.service";
import { todayISO } from "@/lib/dateUtils";

export interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
}

export interface LancamentoForm {
  tipo: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string;
  status: string;
  forma_pagamento: string;
  banco: string;
  cartao: string;
  cartao_id: string;
  cartao_fatura_id: string;
  cliente_id: string;
  fornecedor_id: string;
  conta_bancaria_id: string;
  conta_contabil_id: string;
  observacoes: string;
  gerar_parcelas: boolean;
  num_parcelas: number;
  intervalo_dias: number;
  /**
   * Dados específicos da forma de pagamento (Épico E — Financeiro 2.0).
   * Persistido em `financeiro_lancamentos.forma_pagamento_dados` (jsonb).
   * Ex.: `{ chave_pix, txid }`, `{ linha_digitavel }`, `{ tipo: "TED" }`.
   */
  forma_pagamento_dados: Record<string, unknown>;
}

export const emptyLancamentoForm: LancamentoForm = {
  // 73% dos lançamentos manuais são a pagar; a tela ainda ajusta pelo filtro
  // ativo ou pelo último tipo usado (ver tipoInicialLancamento).
  tipo: "pagar",
  descricao: "",
  valor: 0,
  // Getter: `{ ...emptyLancamentoForm }` chama todayISO() na hora, e não no
  // carregamento do módulo (sessão aberta de um dia para o outro).
  get data_vencimento() {
    return todayISO();
  },
  data_pagamento: "",
  status: "aberto",
  forma_pagamento: "",
  banco: "",
  cartao: "",
  cartao_id: "",
  cartao_fatura_id: "",
  cliente_id: "",
  fornecedor_id: "",
  conta_bancaria_id: "",
  conta_contabil_id: "",
  observacoes: "",
  gerar_parcelas: false,
  num_parcelas: 2,
  intervalo_dias: 30,
  forma_pagamento_dados: {},
};

export interface FinanceiroAuxiliaresState {
  contasBancarias: ContaBancaria[];
  contasContabeis: ContaContabil[];
  cartoes: CartaoCredito[];
}

const ULTIMO_TIPO_KEY = "financeiro:ultimo-tipo-lancamento";

/**
 * Tipo com que o formulário de novo lançamento abre: o do filtro, quando só
 * um está ativo; senão o último que a pessoa usou neste navegador; senão
 * "pagar".
 */
export function tipoInicialLancamento(tiposFiltrados: string[]): LancamentoForm["tipo"] {
  if (tiposFiltrados.length === 1 && (tiposFiltrados[0] === "pagar" || tiposFiltrados[0] === "receber")) {
    return tiposFiltrados[0];
  }
  try {
    const ultimo = localStorage.getItem(ULTIMO_TIPO_KEY);
    if (ultimo === "pagar" || ultimo === "receber") return ultimo;
  } catch {
    /* armazenamento indisponível: usa o padrão */
  }
  return "pagar";
}

export function lembrarTipoLancamento(tipo: string): void {
  try {
    localStorage.setItem(ULTIMO_TIPO_KEY, tipo);
  } catch {
    /* armazenamento indisponível: não lembra */
  }
}
