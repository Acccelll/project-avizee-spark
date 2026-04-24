/**
 * Hook que encapsula toda a lógica de estado e operações do simulador de frete.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
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

export interface UseFreteSimuladorProps {
  orcamentoId: string | null;
  clienteId: string;
  cepDestino: string;
  pesoTotal: number;
  valorMercadoria: number;
  simulacaoId?: string | null;
  onSelect: (payload: FreteSelecaoPayload) => void;
}

export function useFreteSimulador({
  orcamentoId,
  clienteId,
  cepDestino,
  pesoTotal,
  valorMercadoria,
  simulacaoId: simulacaoIdProp,
  onSelect,
}: UseFreteSimuladorProps) {
  const [volumes, setVolumes] = useState(1);
  const [alturaCm, setAlturaCm] = useState(15);
  const [larguraCm, setLarguraCm] = useState(10);
  const [comprimentoCm, setComprimentoCm] = useState(30);

  const [simulacaoId, setSimulacaoId] = useState<string | null>(simulacaoIdProp || null);
  const [opcoes, setOpcoes] = useState<FreteOpcaoLocal[]>([]);
  const [opcaoSelecionadaId, setOpcaoSelecionadaId] = useState<string | null>(null);
  const [desatualizado, setDesatualizado] = useState(false);

  const lastPesoRef = useRef(pesoTotal);
  const lastCepRef = useRef(cepDestino);

  const [loadingCorreios, setLoadingCorreios] = useState(false);
  const [loadingTransp, setLoadingTransp] = useState(false);
  const [salvandoOpcao, setSalvandoOpcao] = useState(false);
  const [cepOrigem, setCepOrigem] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [clienteTransp, setClienteTransp] = useState<ClienteTransportadoraComTransportadora[]>([]);

  const [transpForm, setTranspForm] = useState<Record<string, {
    valor: string; prazo: string; servico: string; obs: string;
  }>>({});
  const [manualForm, setManualForm] = useState({
    servico: '', modalidade: '', prazo: '', valor: '', obs: '',
  });

  const [caixas, setCaixas] = useState<CaixaEmbalagem[]>([]);
  const [gerenciarCaixasOpen, setGerenciarCaixasOpen] = useState(false);
  const [novaCaixa, setNovaCaixa] = useState({ nome: '', altura: '', largura: '', comprimento: '', peso: '' });
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);
  const [editandoCaixaId, setEditandoCaixaId] = useState<string | null>(null);
  const [pesoCaixaUnit, setPesoCaixaUnit] = useState<number>(0);

  // Load CEP and boxes
  useEffect(() => {
    getEmpresaCepOrigem()
      .then(setCepOrigem)
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
    listarCaixasEmbalagem().then(setCaixas).catch(() => {});
  }, []);

  // Load client carriers
  useEffect(() => {
    if (!clienteId) { setClienteTransp([]); return; }
    setLoadingTransp(true);
    getClienteTransportadoras(clienteId)
      .then(setClienteTransp)
      .catch(() => setClienteTransp([]))
      .finally(() => setLoadingTransp(false));
  }, [clienteId]);

  // Load existing simulation
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
          id: o.id, simulacao_id: o.simulacao_id, transportadora_id: o.transportadora_id,
          fonte: o.fonte as FreteOpcaoLocal['fonte'], servico: o.servico, codigo: o.codigo,
          modalidade: o.modalidade, prazo_dias: o.prazo_dias, valor_frete: o.valor_frete,
          valor_adicional: o.valor_adicional, valor_total: o.valor_total,
          selecionada: o.selecionada, observacoes: o.observacoes,
        }));
        setOpcoes(opcoesCarregadas);
        const selecionada = opcoesCarregadas.find((o) => o.selecionada);
        if (selecionada?.id) setOpcaoSelecionadaId(selecionada.id);
      })
      .catch((err) => {
        console.error('[FreteSimulador] falha ao carregar simulação salva:', err);
        toast.warning('Não foi possível carregar a simulação de frete salva.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId]);

  // Detect stale simulation
  useEffect(() => {
    const pesoMudou = lastPesoRef.current !== pesoTotal;
    const cepMudou = lastCepRef.current !== cepDestino;
    if ((pesoMudou || cepMudou) && opcoes.length > 0) setDesatualizado(true);
    lastPesoRef.current = pesoTotal;
    lastCepRef.current = cepDestino;
  }, [pesoTotal, cepDestino, opcoes.length]);

  const garantirSimulacao = useCallback(async (): Promise<string | null> => {
    if (!orcamentoId) { toast.warning('Salve o orçamento antes de simular o frete.'); return null; }
    const cepDest = (cepDestino || '').replace(/\D/g, '');
    if (cepOrigem.length !== 8) { toast.error('Configure o CEP da empresa em Administração → Empresa.'); return null; }
    if (cepDest.length !== 8) { toast.error('O cliente selecionado não possui CEP válido.'); return null; }
    if (pesoTotal <= 0) { toast.error('Adicione itens com peso para simular o frete.'); return null; }
    try {
      const id = await criarOuAtualizarSimulacao(
        { origemTipo: 'orcamento', origemId: orcamentoId, clienteId: clienteId || null, cepOrigem, cepDestino: cepDest, pesoTotal, valorMercadoria, volumes, alturaCm, larguraCm, comprimentoCm },
        simulacaoId,
      );
      setSimulacaoId(id);
      setDesatualizado(false);
      return id;
    } catch (err) {
      console.error('[FreteSimulador] garantirSimulacao:', err);
      toast.error('Erro ao criar simulação de frete.');
      return null;
    }
  }, [orcamentoId, clienteId, cepDestino, cepOrigem, pesoTotal, valorMercadoria, volumes, alturaCm, larguraCm, comprimentoCm, simulacaoId]);

  const handleConsultarCorreios = async () => {
    const simId = await garantirSimulacao();
    if (!simId) return;
    setLoadingCorreios(true);
    try {
      const cepDest = (cepDestino || '').replace(/\D/g, '');
      const result = await consultarCorreios({ cepOrigem, cepDestino: cepDest, peso: pesoTotal, comprimento: comprimentoCm, altura: alturaCm, largura: larguraCm });
      // Aceita tanto valores oficiais quanto fallback de estimativa (servico contém "(estimativa)")
      const validas = result.filter((o) => (!o.erro || o.valor > 0) && o.valor > 0);
      if (validas.length === 0) { toast.warning('Nenhuma opção de frete disponível para este destino.'); return; }
      const isEstimativa = validas.some((o) => /estimativa/i.test(o.servico || ''));
      const salvas = await salvarOpcoesCorreios(simId, validas);
      const novasOpcoes: FreteOpcaoLocal[] = salvas.map((s) => ({
        id: s.id, simulacao_id: s.simulacao_id, transportadora_id: s.transportadora_id,
        fonte: s.fonte as FreteOpcaoLocal['fonte'], servico: s.servico, codigo: s.codigo,
        modalidade: s.modalidade, prazo_dias: s.prazo_dias, valor_frete: s.valor_frete,
        valor_adicional: s.valor_adicional, valor_total: s.valor_total, selecionada: s.selecionada, observacoes: s.observacoes,
      }));
      setOpcoes((prev) => [...prev.filter((o) => o.fonte !== 'correios'), ...novasOpcoes]);
      if (isEstimativa) {
        toast.warning(`${validas.length} opção(ões) estimadas — credenciais Correios indisponíveis ou serviço fora do ar.`);
      } else {
        toast.success(`${validas.length} opção(ões) dos Correios encontrada(s).`);
      }
    } catch (err) {
      console.error('[frete-correios]', err);
      toast.error('Erro ao consultar Correios: ' + (err instanceof Error ? err.message : 'Tente novamente'));
    } finally {
      setLoadingCorreios(false);
    }
  };

  const handleSalvarTransportadora = async (vt: ClienteTransportadoraComTransportadora) => {
    const form = transpForm[vt.id];
    if (!form?.valor || Number(form.valor) <= 0) { toast.error('Informe o valor do frete.'); return; }
    const simId = await garantirSimulacao();
    if (!simId) return;
    setSalvandoOpcao(true);
    try {
      const salva = await salvarOpcaoTransportadora({
        simulacaoId: simId, transportadoraId: vt.transportadora_id,
        servico: form.servico || null, modalidade: vt.modalidade,
        prazoDias: form.prazo ? Number(form.prazo) : null, valorFrete: Number(form.valor), observacoes: form.obs || null,
      });
      const nomeTransp = vt.transportadoras.nome_fantasia || vt.transportadoras.nome_razao_social;
      setOpcoes((prev) => [...prev, {
        id: salva.id, simulacao_id: salva.simulacao_id, transportadora_id: salva.transportadora_id,
        fonte: 'cliente_vinculada', servico: salva.servico, codigo: null, modalidade: salva.modalidade,
        prazo_dias: salva.prazo_dias, valor_frete: salva.valor_frete, valor_adicional: salva.valor_adicional,
        valor_total: salva.valor_total, selecionada: false, observacoes: salva.observacoes, transportadora_nome: nomeTransp,
      }]);
      setTranspForm((prev) => ({ ...prev, [vt.id]: { valor: '', prazo: '', servico: '', obs: '' } }));
      toast.success(`Proposta de ${nomeTransp} adicionada.`);
    } catch (err) {
      console.error('[frete-transp]', err);
      toast.error('Erro ao salvar proposta.');
    } finally {
      setSalvandoOpcao(false);
    }
  };

  const handleSalvarManual = async () => {
    if (!manualForm.valor || Number(manualForm.valor) <= 0) { toast.error('Informe o valor do frete manual.'); return; }
    const simId = await garantirSimulacao();
    if (!simId) return;
    setSalvandoOpcao(true);
    try {
      const salva = await salvarOpcaoManual({
        simulacaoId: simId, servico: manualForm.servico || null, modalidade: manualForm.modalidade || null,
        prazoDias: manualForm.prazo ? Number(manualForm.prazo) : null, valorFrete: Number(manualForm.valor), observacoes: manualForm.obs || null,
      });
      setOpcoes((prev) => [...prev, {
        id: salva.id, simulacao_id: salva.simulacao_id, transportadora_id: null,
        fonte: 'manual', servico: salva.servico, codigo: null, modalidade: salva.modalidade,
        prazo_dias: salva.prazo_dias, valor_frete: salva.valor_frete, valor_adicional: salva.valor_adicional,
        valor_total: salva.valor_total, selecionada: false, observacoes: salva.observacoes,
      }]);
      setManualForm({ servico: '', modalidade: '', prazo: '', valor: '', obs: '' });
      toast.success('Opção manual adicionada.');
    } catch (err) {
      console.error('[frete-manual]', err);
      toast.error('Erro ao salvar frete manual.');
    } finally {
      setSalvandoOpcao(false);
    }
  };

  const handleRemoverOpcao = async (opcao: FreteOpcaoLocal) => {
    if (!opcao.id) return;
    if (opcao.selecionada) { toast.warning('Não é possível remover a opção selecionada. Selecione outra primeiro.'); return; }
    try {
      await removerOpcao(opcao.id);
      setOpcoes((prev) => prev.filter((o) => o.id !== opcao.id));
    } catch { toast.error('Erro ao remover opção.'); }
  };

  const handleSelecionarOpcao = async (opcao: FreteOpcaoLocal) => {
    if (!opcao.id || !simulacaoId || !orcamentoId) { toast.warning('Salve o orçamento antes de selecionar um frete.'); return; }
    const dims: SimulacaoDimensoes = { volumes, altura_cm: alturaCm, largura_cm: larguraCm, comprimento_cm: comprimentoCm };
    try {
      await selecionarOpcaoFrete(simulacaoId, opcao.id, orcamentoId, opcao, dims);
      setOpcoes((prev) => prev.map((o) => ({ ...o, selecionada: o.id === opcao.id })));
      setOpcaoSelecionadaId(opcao.id);
      const freteTipo = opcao.fonte === 'correios' ? `CORREIOS (${opcao.servico || ''})` : opcao.transportadora_nome || opcao.servico || 'MANUAL';
      const payload: FreteSelecaoPayload = {
        freteValor: opcao.valor_total, freteTipo, prazoEntrega: opcao.prazo_dias ? `${opcao.prazo_dias} dias` : '',
        modalidade: opcao.modalidade, transportadoraId: opcao.transportadora_id || null,
        origemFrete: opcao.fonte, servicoFrete: opcao.servico || null, prazoEntregaDias: opcao.prazo_dias,
        freteSimulacaoId: simulacaoId, volumes, alturaCm, larguraCm, comprimentoCm,
      };
      onSelect(payload);
      toast.success('Frete selecionado!');
    } catch (err) {
      console.error('[frete-selecionar]', err);
      toast.error('Erro ao selecionar frete.');
    }
  };

  const handleSelecionarCaixa = (caixaId: string) => {
    const caixa = caixas.find((c) => c.id === caixaId);
    if (!caixa) return;
    setAlturaCm(caixa.altura_cm);
    setLarguraCm(caixa.largura_cm);
    setComprimentoCm(caixa.comprimento_cm);
    setPesoCaixaUnit(caixa.peso_kg ?? 0);
  };

  const handleAdicionarCaixa = async () => {
    if (!novaCaixa.nome.trim()) { toast.error('Informe o nome da caixa.'); return; }
    if (!novaCaixa.altura || !novaCaixa.largura || !novaCaixa.comprimento) { toast.error('Preencha todas as dimensões.'); return; }
    setSalvandoCaixa(true);
    try {
      const dadosBase = {
        nome: novaCaixa.nome.trim(),
        altura_cm: Number(novaCaixa.altura),
        largura_cm: Number(novaCaixa.largura),
        comprimento_cm: Number(novaCaixa.comprimento),
        peso_kg: novaCaixa.peso ? Number(String(novaCaixa.peso).replace(',', '.')) : null,
      };
      let atualizadas: CaixaEmbalagem[];
      if (editandoCaixaId) {
        atualizadas = caixas.map((c) => (c.id === editandoCaixaId ? { ...c, ...dadosBase } : c));
      } else {
        atualizadas = [...caixas, { id: crypto.randomUUID(), ...dadosBase }];
      }
      await salvarCaixasEmbalagem(atualizadas);
      setCaixas(atualizadas);
      setNovaCaixa({ nome: '', altura: '', largura: '', comprimento: '', peso: '' });
      setEditandoCaixaId(null);
      toast.success(editandoCaixaId ? `Caixa "${dadosBase.nome}" atualizada.` : `Caixa "${dadosBase.nome}" cadastrada.`);
    } catch { toast.error('Erro ao salvar caixa.'); }
    finally { setSalvandoCaixa(false); }
  };

  const handleEditarCaixa = (id: string) => {
    const caixa = caixas.find((c) => c.id === id);
    if (!caixa) return;
    setEditandoCaixaId(id);
    setNovaCaixa({
      nome: caixa.nome,
      altura: String(caixa.altura_cm ?? ''),
      largura: String(caixa.largura_cm ?? ''),
      comprimento: String(caixa.comprimento_cm ?? ''),
      peso: caixa.peso_kg != null ? String(caixa.peso_kg) : '',
    });
  };

  const handleCancelarEdicaoCaixa = () => {
    setEditandoCaixaId(null);
    setNovaCaixa({ nome: '', altura: '', largura: '', comprimento: '', peso: '' });
  };

  const handleRemoverCaixa = async (id: string) => {
    try {
      const atualizadas = caixas.filter((c) => c.id !== id);
      await salvarCaixasEmbalagem(atualizadas);
      setCaixas(atualizadas);
      if (editandoCaixaId === id) handleCancelarEdicaoCaixa();
      toast.success('Caixa removida.');
    } catch { toast.error('Erro ao remover caixa.'); }
  };

  const cepDestinoClean = (cepDestino || '').replace(/\D/g, '');
  const canSimulate = !loadingConfig && cepOrigem.length === 8 && cepDestinoClean.length === 8 && pesoTotal > 0;

  const opcoesCorreios = opcoes.filter((o) => o.fonte === 'correios');
  const opcoesTransp = opcoes.filter((o) => o.fonte === 'cliente_vinculada');
  const opcoesManual = opcoes.filter((o) => o.fonte === 'manual');

  const transpFormFor = (vtId: string) => transpForm[vtId] || { valor: '', prazo: '', servico: '', obs: '' };

  return {
    // Dimensions
    volumes, setVolumes, alturaCm, setAlturaCm, larguraCm, setLarguraCm, comprimentoCm, setComprimentoCm,
    // State
    opcoes, opcaoSelecionadaId, desatualizado, loadingCorreios, loadingTransp, salvandoOpcao, cepOrigem, loadingConfig,
    clienteTransp, cepDestinoClean, canSimulate,
    // Categorized options
    opcoesCorreios, opcoesTransp, opcoesManual,
    // Forms
    transpForm, setTranspForm, transpFormFor, manualForm, setManualForm,
    // Caixas
    caixas, gerenciarCaixasOpen, setGerenciarCaixasOpen, novaCaixa, setNovaCaixa, salvandoCaixa,
    editandoCaixaId, pesoCaixaUnit, setPesoCaixaUnit,
    // Handlers
    handleConsultarCorreios, handleSalvarTransportadora, handleSalvarManual,
    handleRemoverOpcao, handleSelecionarOpcao,
    handleSelecionarCaixa, handleAdicionarCaixa, handleRemoverCaixa,
    handleEditarCaixa, handleCancelarEdicaoCaixa,
  };
}

export type { FreteOpcaoLocal, CaixaEmbalagem, ClienteTransportadoraComTransportadora, FreteSelecaoPayload };
