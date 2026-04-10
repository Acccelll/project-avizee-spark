import { z } from "zod";

export const nfeItemSchema = z.object({
  produto_id: z.string().optional(),
  descricao: z.string().min(1, "Descrição obrigatória"),
  ncm: z.string().length(8, "NCM deve ter 8 dígitos"),
  cfop: z.string().length(4, "CFOP deve ter 4 dígitos"),
  cst: z.string().optional(),
  unidade: z.string().min(1, "Unidade obrigatória"),
  quantidade: z.coerce.number().positive("Quantidade deve ser positiva"),
  valorUnitario: z.coerce.number().positive("Valor unitário deve ser positivo"),
  valorTotal: z.coerce.number().positive("Valor total deve ser positivo"),
  icmsAliquota: z.coerce.number().min(0).max(100),
  icmsBase: z.coerce.number().min(0),
  icmsValor: z.coerce.number().min(0),
  ipiAliquota: z.coerce.number().min(0).max(100),
  ipiValor: z.coerce.number().min(0),
  pisAliquota: z.coerce.number().min(0).max(100),
  pisValor: z.coerce.number().min(0),
  cofinsAliquota: z.coerce.number().min(0).max(100),
  cofinsValor: z.coerce.number().min(0),
});

export const nfeSchema = z.object({
  numero: z.string().optional(),
  serie: z.string().default("1"),
  dataEmissao: z.string().min(1, "Data de emissão obrigatória"),
  naturezaOperacao: z.string().min(1, "Natureza da operação obrigatória"),
  cfop: z.string().length(4, "CFOP deve ter 4 dígitos"),
  tipoOperacao: z.enum(["entrada", "saida"]).default("saida"),
  clienteId: z.string().optional(),
  fornecedorId: z.string().optional(),
  condicaoPagamento: z.string().optional(),
  formaPagamento: z.string().optional(),
  freteModalidade: z.enum(["0", "1", "2", "3", "4", "9"]).default("9"),
  freteValor: z.coerce.number().min(0).default(0),
  descontoValor: z.coerce.number().min(0).default(0),
  outrasDespesas: z.coerce.number().min(0).default(0),
  observacoes: z.string().optional(),
  itens: z.array(nfeItemSchema).min(1, "Adicione ao menos um item"),
});

export type NFeFormData = z.infer<typeof nfeSchema>;
export type NFeItemFormData = z.infer<typeof nfeItemSchema>;
