import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Loader2, Package, Truck, CheckCircle2, AlertTriangle, Plus, Trash2, RefreshCw, Box, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import {
  getEmpresaCepOrigem,
  getClienteTransportadoras,
  criarOuAtualizarSimulacao,
  carregarSimulacaoPorOrigem,
  consultarCorreios,
  salvarOpcoesCorreios,
  salvarOpcaoTransportadora,
  salvarOpcaoManual,
  removerOpcao,
  selecionarOpcaoFrete,
  listarCaixasEmbalagem,
  salvarCaixasEmbalagem,
  type CaixaEmbalagem,
  type FreteOpcaoLocal,
  type ClienteTransportadoraComTransportadora,
  type SimulacaoDimensoes,
  type FreteSelecaoPayload,
} from '@/services/freteSimulacao.service';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------
// Props
// ---------------------------------------------------------------

interface FreteSimuladorCardProps {
  orcamentoId: string | null;
  clienteId: string;
  cepDestino: string;
  pesoTotal: number;
  valorMercadoria: number;
  /** ID de simulação existente ao editar orçamento salvo */
  simulacaoId?: string | null;
  onSelect: (payload: FreteSelecaoPayload) => void;
}

// ---------------------------------------------------------------
// Helpers de exibição
// ---------------------------------------------------------------

function fonteBadge(fonte: FreteOpcaoLocal['fonte']) {
  if (fonte === 'correios') return <Badge variant="secondary">Correios</Badge>;
  if (fonte === 'cliente_vinculada') return <Badge variant="outline">Transportadora</Badge>;
  return <Badge>Manual</Badge>;
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export function FreteSimuladorCard({
  orcamentoId,
  clienteId,
  cepDestino,
  pesoTotal,
  valorMercadoria,
  simulacaoId: simulacaoIdProp,
  onSelect,
}: FreteSimuladorCardProps) {
  // dimensões editáveis
  const [volumes, setVolumes] = useState(1);
  const [alturaCm, setAlturaCm] = useState(15);
  const [larguraCm, setLarguraCm] = useState(10);
  const [comprimentoCm, setComprimentoCm] = useState(30);

  // simulação
  const [simulacaoId, setSimulacaoId] = useState<string | null>(simulacaoIdProp || null);
  const [opcoes, setOpcoes] = useState<FreteOpcaoLocal[]>([]);
  const [opcaoSelecionadaId, setOpcaoSelecionadaId] = useState<string | null>(null);
  const [desatualizado, setDesatualizado] = useState(false);

  // refs para detectar mudança
  const lastPesoRef = useRef(pesoTotal);
  const lastCepRef = useRef(cepDestino);

  // loading states
  const [loadingCorreios, setLoadingCorreios] = useState(false);
  const [loadingTransp, setLoadingTransp] = useState(false);
  const [salvandoOpcao, setSalvandoOpcao] = useState(false);
  const [cepOrigem, setCepOrigem] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);

  // transportadoras do cliente
  const [clienteTransp, setClienteTransp] = useState<ClienteTransportadoraComTransportadora[]>([]);

  // formulários das abas
  const [transpForm, setTranspForm] = useState<Record<string, {
    valor: string; prazo: string; servico: string; obs: string;
  }>>({});
  const [manualForm, setManualForm] = useState({
    servico: '', modalidade: '', prazo: '', valor: '', obs: '',
  });

  // caixas de embalagem (presets)
  const [caixas, setCaixas] = useState<CaixaEmbalagem[]>([]);
  const [gerenciarCaixasOpen, setGerenciarCaixasOpen] = useState(false);
  const [novaCaixa, setNovaCaixa] = useState({ nome: '', altura: '', largura: '', comprimento: '' });
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);

  // ---------------------------------------------------------------
  // Carregar CEP de origem e caixas cadastradas
  // ---------------------------------------------------------------
  useEffect(() => {
    getEmpresaCepOrigem()
      .then(setCepOrigem)
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
    listarCaixasEmbalagem().then(setCaixas).catch(() => {});
  }, []);

  // ---------------------------------------------------------------
  // Carregar transportadoras do cliente
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!clienteId) { setClienteTransp([]); return; }
    setLoadingTransp(true);
    getClienteTransportadoras(clienteId)
      .then(setClienteTransp)
      .catch(() => setClienteTransp([]))
      .finally(() => setLoadingTransp(false));
  }, [clienteId]);

  // ---------------------------------------------------------------
  // Carregar simulação existente (ao editar orçamento salvo)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!orcamentoId) return;
    carregarSimulacaoPorOrigem('orcamento', orcamentoId)
      .then((sim) => {
        if (!sim) return;
        setSimulacaoId(sim.id);
        if (sim.volumes) setVolumes(sim.volumes);
        if (sim.altura_cm) setAlturaCm(sim.altura_cm);
        if (sim.largura_cm) setLarguraCm(sim.largura_cm);
        if (sim.comprimento_cm) setComprimentoCm(sim.comprimento_cm);

        const opcoesCarregadas: FreteOpcaoLocal[] = sim.opcoes.map((o) => ({
          id: o.id,
          simulacao_id: o.simulacao_id,
          transportadora_id: o.transportadora_id,
          fonte: o.fonte as FreteOpcaoLocal['fonte'],
          servico: o.servico,
          codigo: o.codigo,
          modalidade: o.modalidade,
          prazo_dias: o.prazo_dias,
          valor_frete: o.valor_frete,
          valor_adicional: o.valor_adicional,
          valor_total: o.valor_total,
          selecionada: o.selecionada,
          observacoes: o.observacoes,
        }));
        setOpcoes(opcoesCarregadas);
        const selecionada = opcoesCarregadas.find((o) => o.selecionada);
        if (selecionada?.id) setOpcaoSelecionadaId(selecionada.id);
      })
      .catch((err) => {
        logger.error('[FreteSimulador] falha ao carregar simulação salva:', err);
        toast.warning('Não foi possível carregar a simulação de frete salva.');
      });
  }, [orcamentoId]);

  // ---------------------------------------------------------------
  // Detectar simulação desatualizada
  // ---------------------------------------------------------------
  useEffect(() => {
    const pesoMudou = lastPesoRef.current !== pesoTotal;
    const cepMudou = lastCepRef.current !== cepDestino;
    if ((pesoMudou || cepMudou) && opcoes.length > 0) {
      setDesatualizado(true);
    }
    lastPesoRef.current = pesoTotal;
    lastCepRef.current = cepDestino;
  }, [pesoTotal, cepDestino, opcoes.length]);

  // ---------------------------------------------------------------
  // Garantir simulação criada
  // ---------------------------------------------------------------
  const garantirSimulacao = useCallback(async (): Promise<string | null> => {
    if (!orcamentoId) {
      toast.warning('Salve o orçamento antes de simular o frete.');
      return null;
    }
    const cepDest = (cepDestino || '').replace(/\D/g, '');
    if (cepOrigem.length !== 8) {
      toast.error('Configure o CEP da empresa em Administração → Empresa.');
      return null;
    }
    if (cepDest.length !== 8) {
      toast.error('O cliente selecionado não possui CEP válido.');
      return null;
    }
    if (pesoTotal <= 0) {
      toast.error('Adicione itens com peso para simular o frete.');
      return null;
    }

    try {
      const id = await criarOuAtualizarSimulacao(
        {
          origemTipo: 'orcamento',
          origemId: orcamentoId,
          clienteId: clienteId || null,
          cepOrigem,
          cepDestino: cepDest,
          pesoTotal,
          valorMercadoria,
          volumes,
          alturaCm,
          larguraCm,
          comprimentoCm,
        },
        simulacaoId
      );
      setSimulacaoId(id);
      setDesatualizado(false);
      return id;
    } catch (err) {
      logger.error('[FreteSimulador] garantirSimulacao:', err);
      toast.error('Erro ao criar simulação de frete.');
      return null;
    }
  }, [
    orcamentoId, clienteId, cepDestino, cepOrigem, pesoTotal, valorMercadoria,
    volumes, alturaCm, larguraCm, comprimentoCm, simulacaoId,
  ]);

  // ---------------------------------------------------------------
  // Aba Correios: consultar
  // ---------------------------------------------------------------
  const handleConsultarCorreios = async () => {
    const simId = await garantirSimulacao();
    if (!simId) return;

    setLoadingCorreios(true);
    try {
      const cepDest = (cepDestino || '').replace(/\D/g, '');
      const result = await consultarCorreios({
        cepOrigem,
        cepDestino: cepDest,
        peso: pesoTotal,
        comprimento: comprimentoCm,
        altura: alturaCm,
        largura: larguraCm,
      });

      const validas = result.filter((o) => !o.erro && o.valor > 0);
      if (validas.length === 0) {
        toast.warning('Nenhuma opção de frete disponível para este destino.');
        return;
      }

      const salvas = await salvarOpcoesCorreios(simId, validas);
      const novasOpcoes: FreteOpcaoLocal[] = salvas.map((s) => ({
        id: s.id,
        simulacao_id: s.simulacao_id,
        transportadora_id: s.transportadora_id,
        fonte: s.fonte as FreteOpcaoLocal['fonte'],
        servico: s.servico,
        codigo: s.codigo,
        modalidade: s.modalidade,
        prazo_dias: s.prazo_dias,
        valor_frete: s.valor_frete,
        valor_adicional: s.valor_adicional,
        valor_total: s.valor_total,
        selecionada: s.selecionada,
        observacoes: s.observacoes,
      }));

      setOpcoes((prev) => [
        ...prev.filter((o) => o.fonte !== 'correios'),
        ...novasOpcoes,
      ]);
      toast.success(`${validas.length} opção(ões) dos Correios encontrada(s).`);
    } catch (err) {
      logger.error('[frete-correios]', err);
      toast.error('Erro ao consultar Correios: ' + (err instanceof Error ? err.message : 'Tente novamente'));
    } finally {
      setLoadingCorreios(false);
    }
  };

  // ---------------------------------------------------------------
  // Aba Transportadoras: salvar proposta
  // ---------------------------------------------------------------
  const handleSalvarTransportadora = async (vt: ClienteTransportadoraComTransportadora) => {
    const form = transpForm[vt.id];
    if (!form?.valor || Number(form.valor) <= 0) {
      toast.error('Informe o valor do frete.');
      return;
    }
    const simId = await garantirSimulacao();
    if (!simId) return;

    setSalvandoOpcao(true);
    try {
      const salva = await salvarOpcaoTransportadora({
        simulacaoId: simId,
        transportadoraId: vt.transportadora_id,
        servico: form.servico || null,
        modalidade: vt.modalidade,
        prazoDias: form.prazo ? Number(form.prazo) : null,
        valorFrete: Number(form.valor),
        observacoes: form.obs || null,
      });

      const nomeTransp = vt.transportadoras.nome_fantasia || vt.transportadoras.nome_razao_social;

      setOpcoes((prev) => [
        ...prev,
        {
          id: salva.id,
          simulacao_id: salva.simulacao_id,
          transportadora_id: salva.transportadora_id,
          fonte: 'cliente_vinculada',
          servico: salva.servico,
          codigo: null,
          modalidade: salva.modalidade,
          prazo_dias: salva.prazo_dias,
          valor_frete: salva.valor_frete,
          valor_adicional: salva.valor_adicional,
          valor_total: salva.valor_total,
          selecionada: false,
          observacoes: salva.observacoes,
          transportadora_nome: nomeTransp,
        },
      ]);

      setTranspForm((prev) => ({ ...prev, [vt.id]: { valor: '', prazo: '', servico: '', obs: '' } }));
      toast.success(`Proposta de ${nomeTransp} adicionada.`);
    } catch (err) {
      logger.error('[frete-transp]', err);
      toast.error('Erro ao salvar proposta.');
    } finally {
      setSalvandoOpcao(false);
    }
  };

  // ---------------------------------------------------------------
  // Aba Manual: salvar
  // ---------------------------------------------------------------
  const handleSalvarManual = async () => {
    if (!manualForm.valor || Number(manualForm.valor) <= 0) {
      toast.error('Informe o valor do frete manual.');
      return;
    }
    const simId = await garantirSimulacao();
    if (!simId) return;

    setSalvandoOpcao(true);
    try {
      const salva = await salvarOpcaoManual({
        simulacaoId: simId,
        servico: manualForm.servico || null,
        modalidade: manualForm.modalidade || null,
        prazoDias: manualForm.prazo ? Number(manualForm.prazo) : null,
        valorFrete: Number(manualForm.valor),
        observacoes: manualForm.obs || null,
      });

      setOpcoes((prev) => [
        ...prev,
        {
          id: salva.id,
          simulacao_id: salva.simulacao_id,
          transportadora_id: null,
          fonte: 'manual',
          servico: salva.servico,
          codigo: null,
          modalidade: salva.modalidade,
          prazo_dias: salva.prazo_dias,
          valor_frete: salva.valor_frete,
          valor_adicional: salva.valor_adicional,
          valor_total: salva.valor_total,
          selecionada: false,
          observacoes: salva.observacoes,
        },
      ]);

      setManualForm({ servico: '', modalidade: '', prazo: '', valor: '', obs: '' });
      toast.success('Opção manual adicionada.');
    } catch (err) {
      logger.error('[frete-manual]', err);
      toast.error('Erro ao salvar frete manual.');
    } finally {
      setSalvandoOpcao(false);
    }
  };

  // ---------------------------------------------------------------
  // Remover opção (não selecionada)
  // ---------------------------------------------------------------
  const handleRemoverOpcao = async (opcao: FreteOpcaoLocal) => {
    if (!opcao.id) return;
    if (opcao.selecionada) {
      toast.warning('Não é possível remover a opção selecionada. Selecione outra primeiro.');
      return;
    }
    try {
      await removerOpcao(opcao.id);
      setOpcoes((prev) => prev.filter((o) => o.id !== opcao.id));
    } catch {
      toast.error('Erro ao remover opção.');
    }
  };

  // ---------------------------------------------------------------
  // Selecionar opção
  // ---------------------------------------------------------------
  const handleSelecionarOpcao = async (opcao: FreteOpcaoLocal) => {
    if (!opcao.id || !simulacaoId || !orcamentoId) {
      toast.warning('Salve o orçamento antes de selecionar um frete.');
      return;
    }

    const dims: SimulacaoDimensoes = { volumes, altura_cm: alturaCm, largura_cm: larguraCm, comprimento_cm: comprimentoCm };

    try {
      await selecionarOpcaoFrete(simulacaoId, opcao.id, orcamentoId, opcao, dims);

      setOpcoes((prev) => prev.map((o) => ({ ...o, selecionada: o.id === opcao.id })));
      setOpcaoSelecionadaId(opcao.id);

      const freteTipo = opcao.fonte === 'correios'
        ? `CORREIOS (${opcao.servico || ''})`
        : opcao.transportadora_nome || opcao.servico || 'MANUAL';

      const payload: FreteSelecaoPayload = {
        freteValor: opcao.valor_total,
        freteTipo,
        prazoEntrega: opcao.prazo_dias ? `${opcao.prazo_dias} dias` : '',
        modalidade: opcao.modalidade,
        transportadoraId: opcao.transportadora_id || null,
        origemFrete: opcao.fonte,
        servicoFrete: opcao.servico || null,
        prazoEntregaDias: opcao.prazo_dias,
        freteSimulacaoId: simulacaoId,
        volumes,
        alturaCm,
        larguraCm,
        comprimentoCm,
      };
      onSelect(payload);
      toast.success('Frete selecionado!');
    } catch (err) {
      logger.error('[frete-selecionar]', err);
      toast.error('Erro ao selecionar frete.');
    }
  };

  // ---------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------
  const cepDestinoClean = (cepDestino || '').replace(/\D/g, '');
  const canSimulate =
    !loadingConfig &&
    cepOrigem.length === 8 &&
    cepDestinoClean.length === 8 &&
    pesoTotal > 0;

  const opcoesCorreios = opcoes.filter((o) => o.fonte === 'correios');
  const opcoesTransp = opcoes.filter((o) => o.fonte === 'cliente_vinculada');
  const opcoesManual = opcoes.filter((o) => o.fonte === 'manual');

  const transpFormFor = (vtId: string) =>
    transpForm[vtId] || { valor: '', prazo: '', servico: '', obs: '' };

  // ---------------------------------------------------------------
  // Caixas helpers
  // ---------------------------------------------------------------
  const handleSelecionarCaixa = (caixaId: string) => {
    const caixa = caixas.find((c) => c.id === caixaId);
    if (!caixa) return;
    setAlturaCm(caixa.altura_cm);
    setLarguraCm(caixa.largura_cm);
    setComprimentoCm(caixa.comprimento_cm);
  };

  const handleAdicionarCaixa = async () => {
    if (!novaCaixa.nome.trim()) { toast.error('Informe o nome da caixa.'); return; }
    if (!novaCaixa.altura || !novaCaixa.largura || !novaCaixa.comprimento) {
      toast.error('Preencha todas as dimensões.'); return;
    }
    setSalvandoCaixa(true);
    try {
      const nova: CaixaEmbalagem = {
        id: crypto.randomUUID(),
        nome: novaCaixa.nome.trim(),
        altura_cm: Number(novaCaixa.altura),
        largura_cm: Number(novaCaixa.largura),
        comprimento_cm: Number(novaCaixa.comprimento),
      };
      const atualizadas = [...caixas, nova];
      await salvarCaixasEmbalagem(atualizadas);
      setCaixas(atualizadas);
      setNovaCaixa({ nome: '', altura: '', largura: '', comprimento: '' });
      toast.success(`Caixa "${nova.nome}" cadastrada.`);
    } catch {
      toast.error('Erro ao salvar caixa.');
    } finally {
      setSalvandoCaixa(false);
    }
  };

  const handleRemoverCaixa = async (id: string) => {
    try {
      const atualizadas = caixas.filter((c) => c.id !== id);
      await salvarCaixasEmbalagem(atualizadas);
      setCaixas(atualizadas);
    } catch {
      toast.error('Erro ao remover caixa.');
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Simulador de Frete
        </CardTitle>

        {/* Avisos de configuração */}
        {!loadingConfig && cepOrigem.length !== 8 && (
          <p className="text-xs text-destructive mt-1">
            ⚠ CEP de origem não configurado. Vá em Administração → Empresa.
          </p>
        )}
        {!clienteId && (
          <p className="text-xs text-muted-foreground mt-1">
            Selecione um cliente para habilitar o simulador.
          </p>
        )}
        {clienteId && cepDestinoClean.length !== 8 && (
          <p className="text-xs text-muted-foreground mt-1">
            O cliente não possui CEP válido.
          </p>
        )}
        {pesoTotal <= 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Adicione itens com peso para simular o frete.
          </p>
        )}

        {/* Alerta de simulação desatualizada */}
        {desatualizado && opcoes.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1 mt-2">
            <AlertTriangle className="h-3 w-3" />
            Simulação desatualizada. Itens ou destino mudaram.
          </div>
        )}

        {/* Resumo: origem / destino / peso */}
        {cepOrigem.length === 8 && cepDestinoClean.length === 8 && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span>Origem: <strong className="text-foreground">{cepOrigem}</strong></span>
            <span>Destino: <strong className="text-foreground">{cepDestinoClean}</strong></span>
            <span>Peso: <strong className="text-foreground">{pesoTotal.toFixed(3)} kg</strong></span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Dimensões */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Dimensões da embalagem</p>
            <div className="flex items-center gap-1.5">
              {caixas.length > 0 && (
                <Select onValueChange={handleSelecionarCaixa}>
                  <SelectTrigger className="h-7 text-xs w-[160px]">
                    <Box className="h-3 w-3 mr-1 shrink-0" />
                    <SelectValue placeholder="Selecionar caixa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {caixas.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nome} ({c.altura_cm}×{c.largura_cm}×{c.comprimento_cm} cm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Dialog open={gerenciarCaixasOpen} onOpenChange={setGerenciarCaixasOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                    <Settings2 className="h-3 w-3" />
                    {caixas.length === 0 ? 'Cadastrar caixas' : 'Gerenciar'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Box className="h-4 w-4" />
                      Caixas de Embalagem
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Lista de caixas existentes */}
                    {caixas.length > 0 ? (
                      <div className="space-y-1.5">
                        {caixas.map((c) => (
                          <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">{c.nome}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {c.altura_cm} × {c.largura_cm} × {c.comprimento_cm} cm
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoverCaixa(c.id)}
                              title="Remover caixa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma caixa cadastrada.</p>
                    )}
                    <Separator />
                    {/* Formulário nova caixa */}
                    <div>
                      <p className="text-xs font-medium mb-2">Nova caixa</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Nome / Identificação*</Label>
                          <Input
                            placeholder="Ex.: Caixa Pequena"
                            value={novaCaixa.nome}
                            onChange={(e) => setNovaCaixa((p) => ({ ...p, nome: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Altura (cm)*</Label>
                          <Input
                            type="number" min={0} placeholder="0"
                            value={novaCaixa.altura}
                            onChange={(e) => setNovaCaixa((p) => ({ ...p, altura: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Largura (cm)*</Label>
                          <Input
                            type="number" min={0} placeholder="0"
                            value={novaCaixa.largura}
                            onChange={(e) => setNovaCaixa((p) => ({ ...p, largura: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Comprimento (cm)*</Label>
                          <Input
                            type="number" min={0} placeholder="0"
                            value={novaCaixa.comprimento}
                            onChange={(e) => setNovaCaixa((p) => ({ ...p, comprimento: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleAdicionarCaixa}
                        disabled={salvandoCaixa}
                        className="mt-3 gap-1.5"
                      >
                        {salvandoCaixa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Adicionar caixa
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Volumes</Label>
              <Input
                type="number"
                min={1}
                value={volumes}
                onChange={(e) => setVolumes(Math.max(1, Number(e.target.value)))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Altura (cm)</Label>
              <Input
                type="number"
                min={0}
                value={alturaCm}
                onChange={(e) => setAlturaCm(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Largura (cm)</Label>
              <Input
                type="number"
                min={0}
                value={larguraCm}
                onChange={(e) => setLarguraCm(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comprimento (cm)</Label>
              <Input
                type="number"
                min={0}
                value={comprimentoCm}
                onChange={(e) => setComprimentoCm(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="correios">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="correios" className="text-xs">
              Correios {opcoesCorreios.length > 0 && `(${opcoesCorreios.length})`}
            </TabsTrigger>
            <TabsTrigger value="transportadoras" className="text-xs">
              Transportadoras {opcoesTransp.length > 0 && `(${opcoesTransp.length})`}
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              Manual {opcoesManual.length > 0 && `(${opcoesManual.length})`}
            </TabsTrigger>
          </TabsList>

          {/* ---- ABA CORREIOS ---- */}
          <TabsContent value="correios" className="space-y-3 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleConsultarCorreios}
              disabled={loadingCorreios || !canSimulate}
              className="gap-2"
            >
              {loadingCorreios
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Package className="h-3.5 w-3.5" />
              }
              {loadingCorreios ? 'Consultando...' : desatualizado ? 'Reconsultar Correios' : 'Consultar Correios'}
              {desatualizado && !loadingCorreios && <RefreshCw className="h-3.5 w-3.5 text-amber-500" />}
            </Button>

            {opcoesCorreios.length > 0 && (
              <OpcoesList
                opcoes={opcoesCorreios}
                opcaoSelecionadaId={opcaoSelecionadaId}
                onSelect={handleSelecionarOpcao}
                onRemove={handleRemoverOpcao}
              />
            )}
            {opcoesCorreios.length === 0 && !loadingCorreios && (
              <p className="text-xs text-muted-foreground">
                Clique em "Consultar Correios" para buscar opções de frete.
              </p>
            )}
          </TabsContent>

          {/* ---- ABA TRANSPORTADORAS ---- */}
          <TabsContent value="transportadoras" className="space-y-4 mt-3">
            {loadingTransp && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando transportadoras...
              </div>
            )}

            {!loadingTransp && clienteTransp.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Este cliente não possui transportadoras vinculadas.
                Cadastre-as em Cadastros → Clientes → Transportadoras.
              </p>
            )}

            {clienteTransp.map((vt) => {
              const form = transpFormFor(vt.id);
              const nomeTransp = vt.transportadoras.nome_fantasia || vt.transportadoras.nome_razao_social;
              return (
                <div key={vt.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{nomeTransp}</p>
                      <p className="text-xs text-muted-foreground">
                        {vt.modalidade && <span>Modalidade: {vt.modalidade} · </span>}
                        {vt.prazo_medio && <span>Prazo médio: {vt.prazo_medio} · </span>}
                        Prioridade: {vt.prioridade ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$)*</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0,00"
                        value={form.valor}
                        onChange={(e) =>
                          setTranspForm((p) => ({ ...p, [vt.id]: { ...transpFormFor(vt.id), valor: e.target.value } }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prazo (dias)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={form.prazo}
                        onChange={(e) =>
                          setTranspForm((p) => ({ ...p, [vt.id]: { ...transpFormFor(vt.id), prazo: e.target.value } }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Serviço</Label>
                      <Input
                        placeholder="Ex.: Padrão"
                        value={form.servico}
                        onChange={(e) =>
                          setTranspForm((p) => ({ ...p, [vt.id]: { ...transpFormFor(vt.id), servico: e.target.value } }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Obs.</Label>
                      <Input
                        placeholder="—"
                        value={form.obs}
                        onChange={(e) =>
                          setTranspForm((p) => ({ ...p, [vt.id]: { ...transpFormFor(vt.id), obs: e.target.value } }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSalvarTransportadora(vt)}
                    disabled={salvandoOpcao}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar proposta
                  </Button>
                </div>
              );
            })}

            {opcoesTransp.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">Propostas adicionadas</p>
                <OpcoesList
                  opcoes={opcoesTransp}
                  opcaoSelecionadaId={opcaoSelecionadaId}
                  onSelect={handleSelecionarOpcao}
                  onRemove={handleRemoverOpcao}
                />
              </>
            )}
          </TabsContent>

          {/* ---- ABA MANUAL ---- */}
          <TabsContent value="manual" className="space-y-3 mt-3">
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-medium">Nova opção manual</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)*</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0,00"
                    value={manualForm.valor}
                    onChange={(e) => setManualForm((p) => ({ ...p, valor: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prazo (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={manualForm.prazo}
                    onChange={(e) => setManualForm((p) => ({ ...p, prazo: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Serviço / Descrição</Label>
                  <Input
                    placeholder="Ex.: Motoboy"
                    value={manualForm.servico}
                    onChange={(e) => setManualForm((p) => ({ ...p, servico: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modalidade</Label>
                  <Input
                    placeholder="Ex.: Rodoviário"
                    value={manualForm.modalidade}
                    onChange={(e) => setManualForm((p) => ({ ...p, modalidade: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Observação</Label>
                  <Textarea
                    placeholder="—"
                    value={manualForm.obs}
                    onChange={(e) => setManualForm((p) => ({ ...p, obs: e.target.value }))}
                    className="min-h-[60px] text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSalvarManual}
                disabled={salvandoOpcao}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar opção manual
              </Button>
            </div>

            {opcoesManual.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">Opções manuais</p>
                <OpcoesList
                  opcoes={opcoesManual}
                  opcaoSelecionadaId={opcaoSelecionadaId}
                  onSelect={handleSelecionarOpcao}
                  onRemove={handleRemoverOpcao}
                />
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Comparativo geral quando há mais de 1 opção */}
        {opcoes.length > 1 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Comparativo de opções</p>
              <OpcoesList
                opcoes={[...opcoes].sort((a, b) => a.valor_total - b.valor_total)}
                opcaoSelecionadaId={opcaoSelecionadaId}
                onSelect={handleSelecionarOpcao}
                onRemove={handleRemoverOpcao}
                showFonte
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// OpcoesList — sub-componente
// ---------------------------------------------------------------

interface OpcoesListProps {
  opcoes: FreteOpcaoLocal[];
  opcaoSelecionadaId: string | null;
  onSelect: (opcao: FreteOpcaoLocal) => void;
  onRemove: (opcao: FreteOpcaoLocal) => void;
  showFonte?: boolean;
}

function OpcoesList({ opcoes, opcaoSelecionadaId, onSelect, onRemove, showFonte }: OpcoesListProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((opcao) => {
        const selecionada = opcao.id === opcaoSelecionadaId;
        return (
          <div
            key={opcao.id}
            className={`relative flex items-start justify-between rounded-lg border p-3 transition-colors ${
              selecionada
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:bg-accent/40'
            }`}
          >
            <button
              className="flex-1 text-left"
              onClick={() => onSelect(opcao)}
              type="button"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{opcao.servico || 'Frete'}</p>
                {showFonte && fonteBadge(opcao.fonte)}
                {opcao.transportadora_nome && (
                  <span className="text-xs text-muted-foreground">{opcao.transportadora_nome}</span>
                )}
              </div>
              {opcao.modalidade && (
                <p className="text-xs text-muted-foreground">{opcao.modalidade}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {opcao.prazo_dias != null ? `${opcao.prazo_dias} dias` : 'Prazo não informado'}
              </p>
              <p className="text-sm font-bold mt-1">{formatCurrency(opcao.valor_total)}</p>
              {opcao.observacoes && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">{opcao.observacoes}</p>
              )}
            </button>
            <div className="flex flex-col items-end gap-1 ml-2">
              {selecionada && <CheckCircle2 className="h-4 w-4 text-primary" />}
              {!selecionada && opcao.id && (
                <button
                  type="button"
                  onClick={() => onRemove(opcao)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover opção"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
