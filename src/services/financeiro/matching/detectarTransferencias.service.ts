/**
 * Detecta transferências internas entre contas da própria empresa.
 * Fase 3 do Motor Inteligente — ver docs/financeiro-motor-importacao-ofx.md.
 *
 * Regra de par:
 *   • mesma empresa, contas bancárias diferentes;
 *   • valores opostos com tolerância R$ 0,05;
 *   • datas ±2 dias;
 *   • ambos ainda `pendente` (não conciliados).
 * Marca `is_transferencia_interna=true` nos dois lados e vincula
 * `transferencia_par_id` cruzado. Idempotente: só toca linhas ainda
 * não pareadas.
 */
import { supabase } from "@/integrations/supabase/client";

const JANELA_DIAS = 2;
const TOLERANCIA = 0.05;

interface Linha {
  id: string;
  conta_bancaria_id: string;
  data: string;
  valor: number;
}

function diffDias(a: string, b: string): number {
  return Math.abs(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export async function detectarTransferenciasInternas(params: {
  empresa_id: string;
  documento_importacao_id?: string;
}): Promise<{ pares: number }> {
  let q = supabase
    .from("financeiro_extrato_importacoes")
    .select("id, conta_bancaria_id, data, valor")
    .eq("empresa_id", params.empresa_id)
    .eq("status", "pendente")
    .eq("is_transferencia_interna", false);
  if (params.documento_importacao_id) q = q.eq("documento_importacao_id", params.documento_importacao_id);

  const { data, error } = await q.limit(2000);
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as unknown as Linha[];

  // Para cada débito, procura crédito espelho em outra conta.
  const debitos = linhas.filter((l) => Number(l.valor) < 0);
  const creditos = linhas.filter((l) => Number(l.valor) > 0);
  const usados = new Set<string>();
  const pares: [string, string][] = [];

  for (const d of debitos) {
    if (usados.has(d.id)) continue;
    const par = creditos.find(
      (c) =>
        !usados.has(c.id) &&
        c.conta_bancaria_id !== d.conta_bancaria_id &&
        Math.abs(Number(c.valor) + Number(d.valor)) <= TOLERANCIA &&
        diffDias(c.data, d.data) <= JANELA_DIAS,
    );
    if (par) {
      usados.add(d.id);
      usados.add(par.id);
      pares.push([d.id, par.id]);
    }
  }

  for (const [a, b] of pares) {
    const { error: e1 } = await supabase
      .from("financeiro_extrato_importacoes")
      .update({ is_transferencia_interna: true, transferencia_par_id: b })
      .eq("id", a);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase
      .from("financeiro_extrato_importacoes")
      .update({ is_transferencia_interna: true, transferencia_par_id: a })
      .eq("id", b);
    if (e2) throw new Error(e2.message);
  }

  return { pares: pares.length };
}