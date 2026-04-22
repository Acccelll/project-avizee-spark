import { z } from 'zod';

export const orcamentoSchema = z.object({
  numero: z.string().min(1, 'Número obrigatório'),
  dataOrcamento: z.string(),
  status: z.enum([
    'rascunho',
    'pendente',
    'aprovado',
    'convertido',
    'rejeitado',
    'cancelado',
    'expirado',
    'historico',
  ]),
  clienteId: z.string().min(1, 'Cliente obrigatório'),
  validade: z.string().optional(),
  desconto: z.number().min(0).default(0),
  impostoSt: z.number().min(0).default(0),
  impostoIpi: z.number().min(0).default(0),
  freteValor: z.number().min(0).default(0),
  outrasDespesas: z.number().min(0).default(0),
  pagamento: z.string().optional(),
  prazoPagamento: z.string().optional(),
  prazoEntrega: z.string().optional(),
  freteTipo: z.string().optional(),
  servicoFrete: z.string().optional(),
  modalidade: z.string().optional(),
  observacoes: z.string().optional(),
  observacoesInternas: z.string().optional(),
});

export type OrcamentoFormValues = z.infer<typeof orcamentoSchema>;
