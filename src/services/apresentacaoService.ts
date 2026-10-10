/**
 * Geração automática da apresentação de fechamento (`apresentacao_cadencia`):
 * no dia configurado, a edge function `apresentacao-cadencia-runner` cria o
 * rascunho do mês anterior na versão certa e avisa por e-mail.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ApresentacaoCadencia {
  id: string;
  nome: string;
  template_id: string | null;
  modo_geracao: 'dinamico' | 'fechado';
  dia_do_mes: number;
  exigir_revisao: boolean;
  destinatarios_emails: string[];
  ativo: boolean;
  ultima_execucao_em: string | null;
  ultima_execucao_status: string | null;
  ultima_execucao_geracao_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type ApresentacaoCadenciaDraft = Omit<
  ApresentacaoCadencia,
  'id' | 'created_at' | 'updated_at' | 'ultima_execucao_em' | 'ultima_execucao_status' | 'ultima_execucao_geracao_id'
>;

export async function listarApresentacaoCadencias(): Promise<ApresentacaoCadencia[]> {
  const { data, error } = await supabase
    .from('apresentacao_cadencia')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApresentacaoCadencia[];
}

export async function salvarApresentacaoCadencia(input: Partial<ApresentacaoCadenciaDraft> & { id?: string }): Promise<ApresentacaoCadencia> {
  const payload = {
    nome: input.nome,
    template_id: input.template_id ?? null,
    modo_geracao: input.modo_geracao ?? 'fechado',
    dia_do_mes: input.dia_do_mes ?? 5,
    exigir_revisao: input.exigir_revisao ?? true,
    destinatarios_emails: input.destinatarios_emails ?? [],
    ativo: input.ativo ?? true,
    observacoes: input.observacoes ?? null,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from('apresentacao_cadencia')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ApresentacaoCadencia;
  }
  const { data, error } = await supabase
    .from('apresentacao_cadencia')
    .insert(payload as never)
    .select('*')
    .single();
  if (error) throw error;
  return data as ApresentacaoCadencia;
}
