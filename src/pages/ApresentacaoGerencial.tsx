import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, EyeOff, Loader2, Lock, Settings2, Stamp } from 'lucide-react';
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
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { NOME_VERSAO, ultimoMesFechado, versaoSugerida, versoesDisponiveis } from '@/lib/apresentacao/fechamento/base';
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
import { HistoricoVersoes } from '@/components/apresentacao/fechamento/HistoricoVersoes';
import { AutomacaoDialog } from '@/components/apresentacao/fechamento/AutomacaoDialog';

const WorkbookEntradasFechamentoDialog = lazy(() =>
  import('@/components/financeiro/WorkbookEntradasFechamentoDialog').then((m) => ({ default: m.WorkbookEntradasFechamentoDialog })),
);

const MESES_NO_SELETOR = 24;

function semOcultos(e: EdicoesDeck): EdicoesDeck {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { ...v, oculto: undefined }]));
}

export default function ApresentacaoGerencial() {
  const { can } = useCan();
  const qc = useQueryClient();
  const canVisualizar = can('apresentacao:visualizar');
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
  const [entradasOpen, setEntradasOpen] = useState(false);
  const [automacaoOpen, setAutomacaoOpen] = useState(false);
  const salvarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Salvamentos em fila: o primeiro cria o rascunho e os seguintes usam o id dele.
  const filaSalvar = useRef<Promise<void>>(Promise.resolve());
  const rascunhoRef = useRef<string | null>(null);

  const dadosQ = useQuery({
    queryKey: ['apresentacao-fechamento-dados', competencia],
    queryFn: () => buscarDadosApresentacao(competencia),
    enabled: canVisualizar,
    staleTime: 60_000,
  });
  const trabalhoQ = useQuery({
    queryKey: ['apresentacao-fechamento-trabalho', competencia, versao],
    queryFn: () => obterTrabalho(competencia, versao),
    enabled: canVisualizar,
  });
  const historicoQ = useQuery({ queryKey: ['apresentacao-fechamento-historico'], queryFn: listarHistorico, enabled: canVisualizar });

  // Carrega as edições do rascunho ao trocar de mês ou versão.
  useEffect(() => {
    const t = trabalhoQ.data;
    if (!t) return;
    rascunhoRef.current = t.rascunho?.id ?? null;
    setEdicoes(t.rascunho?.slides_json?.edicoes ?? {});
  }, [trabalhoQ.data]);

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
          const novo = !rascunhoRef.current;
          const id = await salvarEdicoes(comp, ver, prox, rascunhoRef.current);
          rascunhoRef.current = id;
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

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!dadosQ.data) throw new Error('Dados ainda não carregados.');
      if (salvarTimer.current) clearTimeout(salvarTimer.current);
      await filaSalvar.current;
      const deck = aplicarEdicoes(montarDeck(dadosQ.data, versao), edicoes);
      const blob = await gerarArquivoDeck(deck);
      await marcarComoFinal(deck, edicoes, blob, rascunhoRef.current);
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
      <ModulePage title="Apresentação de fechamento">
        <div className="rounded-md border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">Sem permissão para visualizar.</div>
      </ModulePage>
    );
  }

  const versoes = versoesDisponiveis(competencia);
  const carregando = dadosQ.isLoading || trabalhoQ.isLoading;
  const finalSalvo = trabalhoQ.data?.final;

  return (
    <>
      <ModulePage
        title="Apresentação de fechamento"
        subtitle={deckTela ? `${deckTela.periodo} · ${deckTela.slides.length} slides` : undefined}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={competencia} onValueChange={trocarCompetencia}>
              <SelectTrigger className="h-9 w-[190px]" aria-label="Mês do fechamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>{mesAnoExtenso(m).replace(/^./, (x) => x.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {versoes.length > 1 && (
              <ToggleGroup type="single" value={versao} onValueChange={(v) => v && setVersao(v as VersaoApresentacao)} variant="outline" size="sm" aria-label="Versão">
                {versoes.map((v) => <ToggleGroupItem key={v} value={v} className="h-9 px-3">{NOME_VERSAO[v]}</ToggleGroupItem>)}
              </ToggleGroup>
            )}
            {canFinal && !congelado && (
              <Button variant="outline" size="sm" className="h-9" disabled={!deckTela || finalizar.isPending} onClick={() => setConfirmarFinal(true)}>
                <Stamp className="mr-1 h-4 w-4" />
                Marcar como final
              </Button>
            )}
            {canBaixar && (
              <Button size="sm" className="h-9" disabled={!deckTela || baixar.isPending} onClick={() => baixar.mutate()}>
                {baixar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Baixar apresentação
              </Button>
            )}
            {canConfig && (
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Geração automática" onClick={() => setAutomacaoOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      >
        {dadosQ.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            Não foi possível carregar os dados de {mesAnoExtenso(competencia)}: {dadosQ.error instanceof Error ? dadosQ.error.message : String(dadosQ.error)}
          </div>
        ) : carregando || !deckTela || !slideAtual ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {congelado && finalSalvo && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Versão final de {new Date(finalSalvo.aprovado_em ?? finalSalvo.updated_at).toLocaleDateString('pt-BR')}: números e textos congelados.
                </span>
                {canEditar && (
                  <Button variant="outline" size="sm" disabled={reabrir.isPending} onClick={() => reabrir.mutate()}>
                    Editar nova versão
                  </Button>
                )}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-3">
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
              </div>
              <aside className="space-y-4">
                {dadosQ.data && <PendenciasFechamento dados={dadosQ.data} onInformar={can('workbook:visualizar') ? () => setEntradasOpen(true) : undefined} />}
                {originalAtual && (
                  <EditorSlide
                    original={originalAtual}
                    edicao={edicoes[originalAtual.codigo]}
                    disabled={congelado || !canEditar}
                    onChange={(e) => editar(originalAtual.codigo, e)}
                  />
                )}
                <HistoricoVersoes
                  itens={(historicoQ.data ?? []).slice(0, 8)}
                  canDownload={canBaixar}
                  onDownload={async (r) => {
                    try {
                      const blob = await baixarArquivo(r.arquivo_path!);
                      baixarBlob(blob, r.competencia && r.versao ? nomeArquivoDeck({ competencia: r.competencia, versao: r.versao }) : `apresentacao_${r.id.slice(0, 8)}.pptx`);
                    } catch (e) {
                      toast.error(`Falha no download: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }}
                />
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

      {entradasOpen && (
        <Suspense fallback={null}>
          <WorkbookEntradasFechamentoDialog
            open={entradasOpen}
            onOpenChange={(v) => {
              setEntradasOpen(v);
              if (!v) qc.invalidateQueries({ queryKey: ['apresentacao-fechamento-dados', competencia] });
            }}
          />
        </Suspense>
      )}
      {canConfig && <AutomacaoDialog open={automacaoOpen} onOpenChange={setAutomacaoOpen} />}
    </>
  );
}
