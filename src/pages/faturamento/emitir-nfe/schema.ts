import { z } from "zod";
import { FileText, User, Package, Truck, ListChecks } from "lucide-react";

/**
 * Schema, tipos e constantes do wizard NF-e (`/faturamento/emitir`).
 * Extraído 1:1 de `EmitirNFeWizard.tsx` na Etapa 6.2 — comportamento
 * idêntico, apenas reorganização.
 */

export const itemSchema = z.object({
  produto_id: z.string().nullable(),
  codigo_produto: z.string().optional(),
  descricao: z.string().min(1, "Descrição obrigatória"),
  ncm: z.string().regex(/^\d{8}$/, "NCM deve ter 8 dígitos"),
  cfop: z.string().regex(/^\d{4}$/, "CFOP deve ter 4 dígitos"),
  cst: z.string().min(2),
  origem_mercadoria: z.string().default("0"),
  unidade: z.string().min(1).default("UN"),
  quantidade: z.coerce.number().positive(),
  valor_unitario: z.coerce.number().nonnegative(),
  valor_total: z.coerce.number().nonnegative(),
  icms_aliquota: z.coerce.number().min(0).max(100).default(0),
  icms_base: z.coerce.number().min(0).default(0),
  icms_valor: z.coerce.number().min(0).default(0),
  ipi_aliquota: z.coerce.number().min(0).max(100).default(0),
  ipi_valor: z.coerce.number().min(0).default(0),
  pis_aliquota: z.coerce.number().min(0).max(100).default(0),
  pis_valor: z.coerce.number().min(0).default(0),
  cofins_aliquota: z.coerce.number().min(0).max(100).default(0),
  cofins_valor: z.coerce.number().min(0).default(0),
  matriz_aplicada: z.boolean().default(false),
});
export type WizardItem = z.infer<typeof itemSchema>;

export const wizardSchema = z.object({
  // Passo 1
  serie: z.string().default("1"),
  data_emissao: z.string().min(1),
  natureza_codigo: z.string().min(1, "Selecione a natureza de operação"),
  natureza_descricao: z.string().min(1),
  finalidade: z.enum(["1", "2", "3", "4"]).default("1"),
  tipo_operacao: z.enum(["saida", "entrada"]).default("saida"),
  indicador_presenca: z.enum(["0", "1", "2", "3", "4", "9"]).default("0"),
  data_saida: z.string().optional(),
  hora_saida: z.string().optional(),
  via_intermediador: z.boolean().default(false),
  intermediador_cnpj: z.string().optional(),
  intermediador_identificador: z.string().optional(),
  // Passo 2
  cliente_id: z.string().min(1, "Selecione um destinatário"),
  cliente_nome: z.string(),
  cliente_uf: z.string().length(2),
  cliente_municipio_ibge: z.string().min(7, "Município IBGE obrigatório"),
  // Passo 3
  itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
  // Passo 4
  frete_modalidade: z.enum(["0", "1", "2", "3", "4", "9"]).default("9"),
  frete_valor: z.coerce.number().min(0).default(0),
  outras_despesas: z.coerce.number().min(0).default(0),
  desconto_valor: z.coerce.number().min(0).default(0),
  transportadora_id: z.string().nullable().optional(),
  transportadora_nome: z.string().optional(),
  transportadora_cnpj: z.string().optional(),
  veiculo_placa: z.string().optional(),
  veiculo_uf: z.string().optional(),
  forma_pagamento: z.string().default("01"),
  observacoes: z.string().optional(),
  // Vínculo opcional com Ordem de Venda (Onda 4)
  ordem_venda_id: z.string().nullable().optional(),
  ordem_venda_numero: z.string().nullable().optional(),
  // Vínculo opcional com NF-e referenciada (Onda 5: devolução/complementar)
  nf_referenciada_id: z.string().nullable().optional(),
  nf_referenciada_chave: z.string().nullable().optional(),
}).refine(
  (v) => !v.data_saida || v.data_saida >= v.data_emissao,
  { message: "Data de saída não pode ser anterior à emissão.", path: ["data_saida"] },
);
export type WizardData = z.infer<typeof wizardSchema>;

export const STEPS = [
  { key: "identificacao", label: "Identificação", icon: FileText },
  { key: "destinatario", label: "Destinatário", icon: User },
  { key: "itens", label: "Itens", icon: Package },
  { key: "transporte", label: "Transporte/Pagamento", icon: Truck },
  { key: "revisao", label: "Revisão", icon: ListChecks },
] as const;

export const FORMA_PAGAMENTO = [
  { value: "01", label: "01 — Dinheiro" },
  { value: "02", label: "02 — Cheque" },
  { value: "03", label: "03 — Cartão de crédito" },
  { value: "04", label: "04 — Cartão de débito" },
  { value: "15", label: "15 — Boleto bancário" },
  { value: "17", label: "17 — PIX" },
  { value: "99", label: "99 — Outros" },
];

export const FINALIDADE_MAP: Record<string, string> = {
  "1": "normal",
  "2": "complementar",
  "3": "ajuste",
  "4": "devolucao",
};

export const WIZARD_DEFAULTS: WizardData = {
  serie: "1",
  data_emissao: new Date().toISOString().split("T")[0],
  natureza_codigo: "",
  natureza_descricao: "",
  finalidade: "1",
  tipo_operacao: "saida",
  indicador_presenca: "0",
  data_saida: "",
  hora_saida: "",
  via_intermediador: false,
  intermediador_cnpj: "",
  intermediador_identificador: "",
  cliente_id: "",
  cliente_nome: "",
  cliente_uf: "",
  cliente_municipio_ibge: "",
  itens: [],
  frete_modalidade: "9",
  frete_valor: 0,
  outras_despesas: 0,
  desconto_valor: 0,
  transportadora_id: null,
  transportadora_nome: "",
  transportadora_cnpj: "",
  veiculo_placa: "",
  veiculo_uf: "",
  forma_pagamento: "01",
  observacoes: "",
} as WizardData;