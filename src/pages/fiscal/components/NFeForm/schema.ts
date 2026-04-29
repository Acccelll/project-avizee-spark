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

export const nfeParcelaSchema = z.object({
  numero: z.coerce.number().int().positive(),
  vencimento: z.string().min(1, "Vencimento obrigatório"),
  valor: z.coerce.number().positive("Valor da parcela deve ser positivo"),
});

const nfeBaseSchema = z.object({
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
  geraFinanceiro: z.boolean().default(true),
  dataVencimento: z.string().optional(),
  numeroParcelas: z.coerce.number().int().min(1).default(1),
  intervaloParcelasDias: z.coerce.number().int().min(0).default(30),
  freteModalidade: z.enum(["0", "1", "2", "3", "4", "9"]).default("9"),
  freteValor: z.coerce.number().min(0).default(0),
  descontoValor: z.coerce.number().min(0).default(0),
  outrasDespesas: z.coerce.number().min(0).default(0),
  observacoes: z.string().optional(),
  itens: z.array(nfeItemSchema).min(1, "Adicione ao menos um item"),
  parcelas: z.array(nfeParcelaSchema).optional(),
});

/**
 * Validações de negócio (Fase 4):
 *   1. CFOP do cabeçalho coerente com tipoOperacao (entrada=1/2/3, saída=5/6/7).
 *   2. CFOP de cada item segue a mesma regra do cabeçalho.
 *   3. Quando há parcelas, soma das parcelas == total da NF (tolerância 0,01).
 */
export const nfeSchema = nfeBaseSchema.superRefine((data, ctx) => {
  const isEntrada = data.tipoOperacao === "entrada";
  const cfopValido = (cfop: string) =>
    isEntrada
      ? /^[123]/.test(cfop)
      : /^[567]/.test(cfop);

  // (1) CFOP do header
  if (data.cfop && !cfopValido(data.cfop)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cfop"],
      message: isEntrada
        ? "CFOP de entrada deve começar com 1, 2 ou 3."
        : "CFOP de saída deve começar com 5, 6 ou 7.",
    });
  }

  // (2) CFOP por item
  data.itens.forEach((item, idx) => {
    if (item.cfop && !cfopValido(item.cfop)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itens", idx, "cfop"],
        message: isEntrada
          ? "CFOP de entrada deve começar com 1, 2 ou 3."
          : "CFOP de saída deve começar com 5, 6 ou 7.",
      });
    }
  });

  // (3) Soma de parcelas = total da NF (quando há parcelas)
  if (data.parcelas && data.parcelas.length > 0) {
    const totalProdutos = data.itens.reduce(
      (s, i) => s + Number(i.valorTotal || 0),
      0,
    );
    const totalNF =
      totalProdutos +
      Number(data.freteValor || 0) +
      Number(data.outrasDespesas || 0) -
      Number(data.descontoValor || 0);
    const somaParcelas = data.parcelas.reduce(
      (s, p) => s + Number(p.valor || 0),
      0,
    );
    if (Math.abs(somaParcelas - totalNF) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parcelas"],
        message: `Soma das parcelas (${somaParcelas.toFixed(2)}) difere do total da NF (${totalNF.toFixed(2)}).`,
      });
    }
  }
});

export type NFeFormData = z.infer<typeof nfeSchema>;
export type NFeItemFormData = z.infer<typeof nfeItemSchema>;
export type NFeParcelaFormData = z.infer<typeof nfeParcelaSchema>;
