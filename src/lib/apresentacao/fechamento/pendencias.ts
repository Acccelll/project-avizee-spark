/** Pendências do fechamento do mês, mostradas na página (não bloqueiam o download). */
import { BaseFechamento } from './base';
import { fimDoMes, fimDoMesCurto, mesAnoCurto } from './formato';
import type { ApresentacaoFechamentoDados } from './tipos';

export interface PendenciaItem {
  ok: boolean;
  texto: string;
}

export function pendenciasDoMes(dados: ApresentacaoFechamentoDados): PendenciaItem[] {
  const base = new BaseFechamento(dados);
  const c = dados.competencia;
  const p = dados.pendencias;
  const ultimoDia = Number(fimDoMes(c).slice(0, 2));
  // Extrato "até o fim do mês": última linha nos 5 últimos dias (fim de semana e feriado não têm lançamento).
  const extratoAteFim = !!p.extrato_ultima_data && p.extrato_ultima_data >= `${c}-${String(ultimoDia - 5).padStart(2, '0')}`;
  const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return [
    p.extrato_pendentes > 0
      ? { ok: false, texto: `${p.extrato_pendentes} ${p.extrato_pendentes === 1 ? 'linha do extrato pendente' : 'linhas do extrato pendentes'} de conciliação` }
      : extratoAteFim
        ? { ok: true, texto: 'Extrato conciliado, sem pendências' }
        : { ok: false, texto: p.extrato_ultima_data ? `Extrato importado só até ${dataCurta(p.extrato_ultima_data)} (mês fecha em ${fimDoMesCurto(c)})` : 'Nenhum extrato importado' },
    p.notas_saida_mes > 0
      ? { ok: true, texto: `${p.notas_saida_mes} ${p.notas_saida_mes === 1 ? 'nota de saída' : 'notas de saída'} de ${mesAnoCurto(c)}` }
      : { ok: false, texto: `Nenhuma nota de saída em ${mesAnoCurto(c)}` },
    base.fonte(c, 'caixa_final')
      ? { ok: true, texto: 'Caixa final do extrato informado' }
      : { ok: false, texto: 'Caixa final do extrato não informado (usa o calculado)' },
    base.bloqueado(c) != null
      ? { ok: true, texto: 'Valor bloqueado informado' }
      : { ok: false, texto: 'Valor bloqueado não informado' },
    base.tem(c, 'seguidores_linkedin') || base.tem(c, 'seguidores_instagram')
      ? { ok: true, texto: 'Seguidores informados' }
      : { ok: false, texto: 'Seguidores não informados' },
  ];
}
