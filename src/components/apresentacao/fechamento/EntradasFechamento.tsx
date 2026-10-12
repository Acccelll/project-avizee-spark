import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { nomeMes } from '@/lib/apresentacao/fechamento/formato';
import {
  avisoSeguidores,
  lerInteiro,
  lerPercentual,
  lerReais,
  paraCampoInteiro,
  paraCampoReais,
  seguidoresAnteriores,
  type Leitura,
} from '@/lib/apresentacao/fechamento/entradas';
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';
import {
  carregarEntradasManuais,
  carregarParametrosAno,
  salvarEntradaManual,
  salvarParametrosAno,
} from '@/services/workbook';

interface Props {
  dados: ApresentacaoFechamentoDados;
  /** Sem permissão, mostra os valores sem campos editáveis. */
  podeEditar: boolean;
  /** Chamado depois de salvar (para recarregar deck e Workbook). */
  onSalvo: () => void;
}

const erroDe = (l: Leitura) => ('erro' in l ? l.erro : null);
const valorDe = (l: Leitura) => ('valor' in l ? l.valor : null);

function Campo({ id, rotulo, valor, onChange, erro, aviso, ajuda, disabled, modo = 'decimal' }: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string | null;
  aviso?: string | null;
  ajuda?: string | null;
  disabled?: boolean;
  modo?: 'decimal' | 'numeric';
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{rotulo}</Label>
      <Input
        id={id}
        inputMode={modo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!erro}
        className={cn('h-11 tabular-nums sm:h-9', erro && 'border-destructive')}
      />
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : aviso ? (
        <p className="flex items-start gap-1 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
          {aviso}
        </p>
      ) : ajuda ? (
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  );
}

/**
 * Valores do fechamento que não vêm do ERP: caixa do extrato (disponível e
 * bloqueado), seguidores das redes e parâmetros do ano. O caixa total do mês
 * é disponível + bloqueado; a diferença para o calculado pelo ERP vira o
 * ajuste ao extrato no Workbook e na apresentação.
 */
export function EntradasFechamento({ dados, podeEditar, onSalvo }: Props) {
  const qc = useQueryClient();
  const competencia = dados.competencia;
  const ano = Number(competencia.slice(0, 4));
  const mes = dados.workbook.meses.find((m) => m.competencia === competencia);
  const caixaCalculado = Number(mes?.valores.caixa_final_calculado ?? mes?.valores.caixa_final ?? 0);

  const entradasQ = useQuery({
    queryKey: ['workbook-entradas', competencia],
    queryFn: () => carregarEntradasManuais(competencia),
  });
  const parametrosQ = useQuery({
    queryKey: ['workbook-parametros-ano', ano],
    queryFn: () => carregarParametrosAno(ano),
  });

  const [disponivel, setDisponivel] = useState('');
  const [bloqueado, setBloqueado] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [meta, setMeta] = useState('');
  const [limite, setLimite] = useState('');
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    const e = entradasQ.data;
    if (!e) return;
    const bl = e.bloqueado ?? null;
    setDisponivel(e.caixa_final !== undefined ? paraCampoReais(e.caixa_final - (bl ?? 0)) : '');
    setBloqueado(paraCampoReais(bl));
    setLinkedin(paraCampoInteiro(e.seguidores_linkedin));
    setInstagram(paraCampoInteiro(e.seguidores_instagram));
    setAlterado(false);
  }, [entradasQ.data]);
  useEffect(() => {
    const p = parametrosQ.data;
    setMeta(p ? String(Math.round(p.crescimento_meta * 10000) / 100).replace('.', ',') : '');
    setLimite(p ? paraCampoReais(p.limite_faturamento) : '');
  }, [parametrosQ.data]);

  const editar = (set: (v: string) => void) => (v: string) => {
    set(v);
    setAlterado(true);
  };

  const lDisp = lerReais(disponivel);
  const lBloq = lerReais(bloqueado);
  const lLi = lerInteiro(linkedin);
  const lIg = lerInteiro(instagram);
  const lMeta = lerPercentual(meta);
  const lLim = lerReais(limite);
  const invalido = [lDisp, lBloq, lLi, lIg, lMeta, lLim].some((l) => !l.ok);
  const vDisp = valorDe(lDisp);
  const vBloq = valorDe(lBloq);
  const total = vDisp !== null ? Math.round((vDisp + (vBloq ?? 0)) * 100) / 100 : null;
  const ajuste = total !== null ? Math.round((total - caixaCalculado) * 100) / 100 : null;

  const antLi = useMemo(() => seguidoresAnteriores(dados, 'seguidores_linkedin'), [dados]);
  const antIg = useMemo(() => seguidoresAnteriores(dados, 'seguidores_instagram'), [dados]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (invalido) throw new Error('Corrija os campos marcados.');
      await salvarEntradaManual(competencia, 'caixa_final', total);
      await salvarEntradaManual(competencia, 'bloqueado', vBloq);
      await salvarEntradaManual(competencia, 'seguidores_linkedin', valorDe(lLi));
      await salvarEntradaManual(competencia, 'seguidores_instagram', valorDe(lIg));
      const vMeta = valorDe(lMeta);
      const vLim = valorDe(lLim);
      if (vMeta !== null || vLim !== null) {
        await salvarParametrosAno({
          ano,
          crescimento_meta: vMeta ?? parametrosQ.data?.crescimento_meta ?? 0,
          limite_faturamento: vLim ?? parametrosQ.data?.limite_faturamento ?? 0,
        });
      }
    },
    onSuccess: () => {
      toast.success('Entradas do fechamento salvas.');
      qc.invalidateQueries({ queryKey: ['workbook-entradas', competencia] });
      qc.invalidateQueries({ queryKey: ['workbook-parametros-ano', ano] });
      setAlterado(false);
      onSalvo();
    },
    onError: (e) => toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`),
  });

  const carregando = entradasQ.isLoading || parametrosQ.isLoading;
  const bloqueadoCampos = !podeEditar || carregando || salvar.isPending;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Entradas do fechamento · {nomeMes(competencia)}</h3>
      <p className="mt-1 text-xs text-muted-foreground">O que o ERP não calcula. Vale para o Workbook e para a apresentação.</p>

      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo id="ent-disp" rotulo="Disponível (extrato)" valor={disponivel} onChange={editar(setDisponivel)} erro={erroDe(lDisp)} disabled={bloqueadoCampos} />
          <Campo id="ent-bloq" rotulo="Bloqueado (garantia)" valor={bloqueado} onChange={editar(setBloqueado)} erro={erroDe(lBloq)} disabled={bloqueadoCampos} />
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs tabular-nums">
          {total !== null ? (
            <>
              <div className="flex justify-between gap-2"><span>Caixa no fim do mês</span><span className="font-medium">{formatCurrency(total)}</span></div>
              <div className="flex justify-between gap-2 text-muted-foreground"><span>Calculado pelo ERP</span><span>{formatCurrency(caixaCalculado)}</span></div>
              <div className={cn('flex justify-between gap-2', ajuste ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>
                <span>Ajuste ao extrato</span>
                <span>{ajuste ? formatCurrency(ajuste) : 'nenhum'}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Sem extrato informado: vale o calculado pelo ERP</span>
              <span>{formatCurrency(caixaCalculado)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            id="ent-li"
            rotulo="LinkedIn (seguidores)"
            modo="numeric"
            valor={linkedin}
            onChange={editar(setLinkedin)}
            erro={erroDe(lLi)}
            aviso={avisoSeguidores(valorDe(lLi), antLi)}
            disabled={bloqueadoCampos}
          />
          <Campo
            id="ent-ig"
            rotulo="Instagram (seguidores)"
            modo="numeric"
            valor={instagram}
            onChange={editar(setInstagram)}
            erro={erroDe(lIg)}
            aviso={avisoSeguidores(valorDe(lIg), antIg)}
            disabled={bloqueadoCampos}
          />
        </div>

        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground sm:min-h-0">
            <span>
              Parâmetros de {ano}:{' '}
              {parametrosQ.data
                ? `meta +${String(Math.round(parametrosQ.data.crescimento_meta * 1000) / 10).replace('.', ',')}% · limite ${formatCurrency(parametrosQ.data.limite_faturamento)}`
                : 'não informados'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Campo id="ent-meta" rotulo="Meta (%)" valor={meta} onChange={editar(setMeta)} erro={erroDe(lMeta)} ajuda="Crescimento sobre o ano anterior" disabled={bloqueadoCampos} />
              <Campo id="ent-lim" rotulo="Limite (R$)" valor={limite} onChange={editar(setLimite)} erro={erroDe(lLim)} disabled={bloqueadoCampos} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {podeEditar && (
          <Button size="sm" variant={alterado ? 'default' : 'outline'} className="h-11 w-full sm:h-9" disabled={!alterado || invalido || salvar.isPending || carregando} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {alterado ? 'Salvar entradas' : 'Entradas salvas'}
          </Button>
        )}
      </div>
    </section>
  );
}
