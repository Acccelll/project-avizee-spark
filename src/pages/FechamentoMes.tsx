import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, EyeOff, FileSpreadsheet, Loader2, Lock, Settings2, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { NOME_VERSAO, ultimoMesFechado, versaoSugerida, versoesDisponiveis } from '@/lib/apresentacao/fechamento/base';
import { nomeArquivoWorkbook } from '@/lib/workbook/fechamento/v2/nome';
import { mesAnoExtenso, somarMeses } from '@/lib/apresentacao/fechamento/formato';
import { aplicarEdicoes, montarDeck, nomeArquivoDeck } from '@/lib/apresentacao/fechamento/modelo';
import type { Deck, EdicaoSlide, EdicoesDeck, VersaoApresentacao } from '@/lib/apresentacao/fechamento/tipos';
import {
  baixarArquivo,
  baixarBlob,
  buscarDadosApresentacao,
  gerarArquivoDeck,
  listarHistorico,
  marcarComoFinal,
  obterTrabalho,
  reabrirRascunho,
  salvarEdicoes,
} from '@/services/apresentacaoFechamentoService';
import { SlideView } from '@/components/apresentacao/fechamento/SlideView';
import { EditorSlide } from '@/components/apresentacao/fechamento/EditorSlide';
import { PendenciasFechamento } from '@/components/apresentacao/fechamento/PendenciasFechamento';
import { HistoricoArquivos, type ItemHistorico } from '@/components/apresentacao/fechamento/HistoricoArquivos';
import { EntradasFechamento } from '@/components/apresentacao/fechamento/EntradasFechamento';
import { AutomacaoDialog } from '@/components/apresentacao/fechamento/AutomacaoDialog';
import { downloadGeracao, gerarWorkbook, listarWorkbooksFechamento, obterTemplateFechamento } from '@/services/workbook';

const MESES_NO_SELETOR = 24;

function semOcultos(e: EdicoesDeck): EdicoesDeck {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { ...v, oculto: undefined }]));
}

/**
 * Fechamento do mês: entradas do fechamento, pendências, a apresentação
 * (prévia e edição) e os downloads da apresentação e do Workbook.
 */
export default function FechamentoMes() {
  const { can } = useCan();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canApresentacao = can('apresentacao:visualizar');
  const canWorkbook = can('workbook:visualizar');
  const canVisualizar = canApresentacao || canWorkbook;
  const canBaixarWorkbook = can('workbook:exportar');
  const canEntradas = can('workbook:exportar');
  const canBaixar = can('apresentacao:gerar') || can('apresentacao:download');
  const canEditar = can('apresentacao:editar_comentarios');
  const canFinal = can('apresentacao:aprovar');
  const canConfig = can('apresentacao:gerenciar_templates');

  const ultimo = ultimoMesFechado();
  const meses = useMemo(() => Array.from({ length: MESES_NO_SELETOR }, (_, i) => somarMeses(ultimo, -i)), [ultimo]);
  const [competencia, setCompetencia] = useState(ultimo);
  const [versao, setVersao] = useState<VersaoApresentacao>(versaoSugerida(ultimo));
  const [selecionado, setSelecionado] = useState('capa');
  const [edicoes, setEdicoes] = useState<EdicoesDeck>({});
  const [confirmarFinal, setConfirmarFinal] = useState(false);
  const [automacaoOpen, setAutomacaoOpen] = useState(false);
  const salvarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Salvamentos em fila: o primeiro cria o rascunho e os seguintes usam o id dele.
  // O id fica guardado por competência + versão, para que um salvamento pendente
  // de outro mês ou versão nunca grave no rascunho errado.
  const filaSalvar = useRef<Promise<void>>(Promise.resolve());
  const rascunhos = useRef<Record<string, string>>({});
  const chave = (c: string, v: VersaoApresentacao) => `${c}|${v}`;

  const dadosQ = useQuery({
    queryKey: ['apresentacao-fechamento-dados', competencia],
    queryFn: () => buscarDadosApresentacao(competencia),
    enabled: canVisualizar,
    staleTime: 60_000,
  });
  const trabalhoQ = useQuery({
    queryKey: ['apresentacao-fechamento-trabalho', competencia, versao],
    queryFn: () => obterTrabalho(competencia, versao),
    enabled: canApresentacao,
  });
  const historicoQ = useQuery({ queryKey: ['apresentacao-fechamento-historico'], queryFn: listarHistorico, enabled: canApresentacao });
  const workbooksQ = useQuery({ queryKey: ['workbook-fechamento-geracoes'], queryFn: () => listarWorkbooksFechamento(), enabled: canWorkbook });

  // Carrega as edições do rascunho ao trocar de mês ou versão.
  useEffect(() => {
    const t = trabalhoQ.data;
    if (!t) return;
    const k = chave(competencia, versao);
    if (t.rascunho?.id) rascunhos.current[k] = t.rascunho.id;
    else delete rascunhos.current[k];
    setEdicoes(t.rascunho?.slides_json?.edicoes ?? {});
    // `trabalhoQ.data` é sempre do mês e da versão atuais (a chave da consulta inclui os dois).
  }, [trabalhoQ.data, competencia, versao]);

  const congelado = !!trabalhoQ.data?.final && !trabalhoQ.data?.rascunho;
  const deckFinalSalvo: Deck | null = congelado ? trabalhoQ.data?.final?.data_origem_json?.deck ?? null : null;

  const deckBase = useMemo(() => (dadosQ.data ? montarDeck(dadosQ.data, versao) : null), [dadosQ.data, versao]);
  const deckTela = useMemo(() => deckFinalSalvo ?? (deckBase ? aplicarEdicoes(deckBase, semOcultos(edicoes)) : null), [deckFinalSalvo, deckBase, edicoes]);

  const slideAtual = deckTela?.slides.find((s) => s.codigo === selecionado) ?? deckTela?.slides[0];
  const numeroAtual = slideAtual ? (deckTela?.slides.indexOf(slideAtual) ?? 0) + 1 : 1;
  const originalAtual = deckBase?.slides.find((s) => s.codigo === slideAtual?.codigo);

  const trocarCompetencia = (c: string) => {
    setCompetencia(c);
    setVersao(versaoSugerida(c));
    setSelecionado('capa');
  };

  const editar = (codigo: string, e: EdicaoSlide | undefined) => {
    const prox = { ...edicoes };
    if (e) prox[codigo] = e;
    else delete prox[codigo];
    setEdicoes(prox);
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    const comp = competencia;
    const ver = versao;
    salvarTimer.current = setTimeout(() => {
      filaSalvar.current = filaSalvar.current
        .then(async () => {
          const k = chave(comp, ver);
          const novo = !rascunhos.current[k];
          const id = await salvarEdicoes(comp, ver, prox, rascunhos.current[k] ?? null);
          rascunhos.current[k] = id;
          if (novo) qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-trabalho', comp, ver] });
        })
        .catch((err) => {
          toast.error(`Não foi possível salvar a edição: ${err instanceof Error ? err.message : String(err)}`);
        });
    }, 600);
  };

  const baixar = useMutation({
    mutationFn: async () => {
      const final = trabalhoQ.data?.final;
      if (congelado && final?.arquivo_path) return { blob: await baixarArquivo(final.arquivo_path), deck: { competencia, versao } };
      if (!dadosQ.data) throw new Error('Dados ainda não carregados.');
      // Monta de novo para a capa sair com a data e a hora do download.
      const deck = aplicarEdicoes(montarDeck(dadosQ.data, versao), edicoes);
      return { blob: await gerarArquivoDeck(deck), deck };
    },
    onSuccess: ({ blob, deck }) => baixarBlob(blob, nomeArquivoDeck(deck)),
    onError: (e) => toast.error(`Falha ao gerar a apresentação: ${e instanceof Error ? e.message : String(e)}`),
  });

  const baixarWorkbook = useMutation({
    mutationFn: async () => {
      if (!dadosQ.data) throw new Error('Dados ainda não carregados.');
      const dados = dadosQ.data;
      const template = await obterTemplateFechamento();
      if (!template) {
        // Modelo ainda não registrado no banco: gera sem guardar no histórico.
        const { gerarWorkbookFechamentoV2 } = await import('@/lib/workbook/fechamento/v2');
        return { blob: await gerarWorkbookFechamentoV2(dados), competencia: dados.competencia };
      }
      const { blob } = await gerarWorkbook(
        {
          templateId: template.id,
          templateCodigo: template.codigo,
          competenciaInicial: `${dados.competencia}-01`,
          competenciaFinal: `${dados.competencia}-01`,
          modoGeracao: 'fechado',
          abasSelecionadas: [],
        },
        user?.id,
        { dadosFechamento: dados },
      );
      return { blob, competencia: dados.competencia };
    },
    // O nome segue o mês gerado, mesmo que a tela tenha mudado de mês no meio.
    onSuccess: ({ blob, competencia: gerada }) => {
      baixarBlob(blob, nomeArquivoWorkbook(gerada));
      qc.invalidateQueries({ queryKey: ['workbook-fechamento-geracoes'] });
    },
    onError: (e) => toast.error(`Falha ao gerar o Workbook: ${e instanceof Error ? e.message : String(e)}`),
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!dadosQ.data) throw new Error('Dados ainda não carregados.');
      if (salvarTimer.current) clearTimeout(salvarTimer.current);
      await filaSalvar.current;
      const deck = aplicarEdicoes(montarDeck(dadosQ.data, versao), edicoes);
      const blob = await gerarArquivoDeck(deck);
      await marcarComoFinal(deck, edicoes, blob, rascunhos.current[chave(competencia, versao)] ?? null);
      return { blob, deck };
    },
    onSuccess: () => {
      toast.success('Versão final gravada no histórico.');
      qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-trabalho', competencia, versao] });
      qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-historico'] });
      setConfirmarFinal(false);
    },
    onError: (e) => toast.error(`Falha ao marcar como final: ${e instanceof Error ? e.message : String(e)}`),
  });

  const reabrir = useMutation({
    mutationFn: async () => reabrirRascunho(trabalhoQ.data!.final!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-trabalho', competencia, versao] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!canVisualizar) {
    return (
      <ModulePage title="Fechamento do mês">
        <div className="rounded-md border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">Sem permissão para visualizar.</div>
      </ModulePage>
    );
  }

  const versoes = versoesDisponiveis(competencia);
  const carregando = dadosQ.isLoading || (canApresentacao && trabalhoQ.isLoading);
  const finalSalvo = trabalhoQ.data?.final;

  const historico: ItemHistorico[] = [
    ...(canApresentacao ? historicoQ.data ?? [] : []).slice(0, 8).map((r): ItemHistorico => ({
      id: r.id,
      competencia: r.competencia ?? r.competencia_inicial?.slice(0, 7) ?? null,
      data: r.aprovado_em ?? r.updated_at ?? r.created_at,
      extensao: 'pptx',
      etiquetas: r.versao
        ? [{ texto: NOME_VERSAO[r.versao], destaque: true }, ...(r.is_final ? [{ texto: 'Final' }] : [])]
        : [{ texto: 'Modelo antigo' }],
      detalhe: r.total_slides ? `${r.total_slides} slides` : undefined,
      onDownload: canBaixar && r.arquivo_path
        ? async () => {
            try {
              const blob = await baixarArquivo(r.arquivo_path!);
              baixarBlob(blob, r.competencia && r.versao ? nomeArquivoDeck({ competencia: r.competencia, versao: r.versao }) : `apresentacao_${r.id.slice(0, 8)}.pptx`);
            } catch (e) {
              toast.error(`Falha no download: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        : undefined,
    })),
    ...(workbooksQ.data ?? []).slice(0, 6).map((g): ItemHistorico => {
      const comp = g.competencia_final?.slice(0, 7) ?? null;
      return {
        id: g.id,
        competencia: comp,
        data: g.gerado_em ?? g.created_at,
        extensao: 'xlsx',
        etiquetas: [{ texto: 'Workbook', destaque: true }, ...(g.workbook_templates?.versao === '1.0' ? [{ texto: 'Modelo anterior' }] : [])],
        onDownload: canWorkbook
          ? async () => {
              try {
                baixarBlob(await downloadGeracao(g), comp ? nomeArquivoWorkbook(comp) : `workbook_${g.id.slice(0, 8)}.xlsx`);
              } catch (e) {
                toast.error(`Falha no download: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          : undefined,
      };
    }),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      <ModulePage
        title="Fechamento do mês"
        subtitle={deckTela ? `${deckTela.periodo} · apresentação com ${deckTela.slides.length} slides e Workbook com 12 abas` : undefined}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={competencia} onValueChange={trocarCompetencia}>
              <SelectTrigger className="h-11 w-[190px] sm:h-9" aria-label="Mês do fechamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>{mesAnoExtenso(m).replace(/^./, (x) => x.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canApresentacao && versoes.length > 1 && (
              <ToggleGroup type="single" value={versao} onValueChange={(v) => v && setVersao(v as VersaoApresentacao)} variant="outline" size="sm" aria-label="Versão">
                {versoes.map((v) => <ToggleGroupItem key={v} value={v} className="h-11 px-3 sm:h-9">{NOME_VERSAO[v]}</ToggleGroupItem>)}
              </ToggleGroup>
            )}
            {canApresentacao && canFinal && !congelado && (
              <Button variant="outline" size="sm" className="h-11 sm:h-9" disabled={!deckTela || finalizar.isPending} onClick={() => setConfirmarFinal(true)}>
                <Stamp className="mr-1 h-4 w-4" />
                Marcar como final
              </Button>
            )}
            {canBaixarWorkbook && (
              <Button variant="outline" size="sm" className="h-11 sm:h-9" disabled={!dadosQ.data || baixarWorkbook.isPending} onClick={() => baixarWorkbook.mutate()}>
                {baixarWorkbook.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
                Baixar Workbook
              </Button>
            )}
            {canApresentacao && canBaixar && (
              <Button size="sm" className="h-11 sm:h-9" disabled={!deckTela || baixar.isPending} onClick={() => baixar.mutate()}>
                {baixar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Baixar apresentação
              </Button>
            )}
            {(canConfig || canWorkbook) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Mais opções">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canConfig && <DropdownMenuItem onSelect={() => setAutomacaoOpen(true)}>Geração automática da apresentação</DropdownMenuItem>}
                  {canWorkbook && (
                    <DropdownMenuItem asChild>
                      <Link to="/relatorios/workbook-gerencial/modelo-antigo">Workbook gerencial (modelo antigo)</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      >
        {dadosQ.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            Não foi possível carregar os dados de {mesAnoExtenso(competencia)}: {dadosQ.error instanceof Error ? dadosQ.error.message : String(dadosQ.error)}
          </div>
        ) : carregando || !dadosQ.data || (canApresentacao && (!deckTela || !slideAtual)) ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {canApresentacao && congelado && finalSalvo && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Apresentação final de {new Date(finalSalvo.aprovado_em ?? finalSalvo.updated_at).toLocaleDateString('pt-BR')}: números e textos congelados.
                </span>
                {canEditar && (
                  <Button variant="outline" size="sm" disabled={reabrir.isPending} onClick={() => reabrir.mutate()}>
                    Editar nova versão
                  </Button>
                )}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-3">
                {canApresentacao && deckTela && slideAtual ? (
                  <>
                    <SlideView deck={deckTela} slide={slideAtual} numero={numeroAtual} className="w-full rounded-md border shadow-sm" />
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                      {deckTela.slides.map((s, i) => {
                        const oculto = !!edicoes[s.codigo]?.oculto && !congelado;
                        return (
                          <button
                            key={s.codigo}
                            type="button"
                            onClick={() => setSelecionado(s.codigo)}
                            className={cn(
                              'group relative rounded-md border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              s.codigo === slideAtual.codigo ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/30',
                              oculto && 'opacity-40',
                            )}
                            aria-label={`Slide ${i + 1}: ${s.rotulo}`}
                          >
                            <SlideView deck={deckTela} slide={s} numero={i + 1} className="pointer-events-none w-full rounded-t-md" />
                            <span className="flex items-center gap-1 truncate px-2 py-1 text-xs">
                              {oculto && <EyeOff className="h-3 w-3 shrink-0" />}
                              {i + 1}. {s.rotulo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                    O Workbook de {mesAnoExtenso(competencia)} sai com 12 abas (Resumo, Resultado, Faturamento, Caixa, Despesas, Clientes,
                    Estados, Capital de giro, Estoque, Sócios, Redes e Dados). A prévia da apresentação depende da permissão de apresentação.
                  </div>
                )}
              </div>
              <aside className="space-y-4">
                <PendenciasFechamento dados={dadosQ.data} />
                <EntradasFechamento
                  dados={dadosQ.data}
                  podeEditar={canEntradas}
                  onSalvo={() => qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-dados', competencia] })}
                />
                {canApresentacao && originalAtual && (
                  <EditorSlide
                    original={originalAtual}
                    edicao={edicoes[originalAtual.codigo]}
                    disabled={congelado || !canEditar}
                    onChange={(e) => editar(originalAtual.codigo, e)}
                  />
                )}
                <HistoricoArquivos itens={historico} />
              </aside>
            </div>
          </div>
        )}
      </ModulePage>

      <AlertDialog open={confirmarFinal} onOpenChange={setConfirmarFinal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {deckTela?.periodo ?? ''} como final?</AlertDialogTitle>
            <AlertDialogDescription>
              Os números e os textos desta versão ficam congelados e o .pptx vai para o histórico. Depois, dá para abrir uma nova versão se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizar.isPending}
              onClick={(e) => {
                e.preventDefault();
                finalizar.mutate();
              }}
            >
              {finalizar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Marcar como final
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canConfig && <AutomacaoDialog open={automacaoOpen} onOpenChange={setAutomacaoOpen} />}
    </>
  );
}
