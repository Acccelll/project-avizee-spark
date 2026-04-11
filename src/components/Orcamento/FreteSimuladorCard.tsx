import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  carregarOpcoesSimulacao,
  carregarSimulacaoPorOrigem,
  consultarCorreios,
  criarOuAtualizarSimulacao,
  getClienteTransportadoras,
  getEmpresaCepOrigem,
  salvarOpcoesSimulacao,
  selecionarOpcaoFrete,
  type ClienteTransportadoraPreferencial,
  type FreteSimulacaoOpcao,
} from "@/services/freteSimulacao.service";

interface FreteSimuladorCardProps {
  origemId: string;
  orcamentoId?: string;
  clienteId?: string;
  cepDestino?: string;
  pesoTotal: number;
  valorMercadoria: number;
  freteSimulacaoId?: string | null;
  initialVolumes?: number | null;
  initialAlturaCm?: number | null;
  initialLarguraCm?: number | null;
  initialComprimentoCm?: number | null;
  onFreteSelecionado: (payload: {
    valor: number;
    tipo: string;
    prazo: string;
    modalidade?: string | null;
    origemFrete: "correios" | "cliente_vinculada" | "manual";
    servicoFrete?: string | null;
    prazoDias?: number | null;
    transportadoraId?: string | null;
    freteSimulacaoId: string;
    volumes: number;
    alturaCm: number | null;
    larguraCm: number | null;
    comprimentoCm: number | null;
  }) => void;
}

export function FreteSimuladorCard({
  origemId,
  orcamentoId,
  clienteId,
  cepDestino,
  pesoTotal,
  valorMercadoria,
  freteSimulacaoId,
  initialVolumes,
  initialAlturaCm,
  initialLarguraCm,
  initialComprimentoCm,
  onFreteSelecionado,
}: FreteSimuladorCardProps) {
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingCorreios, setLoadingCorreios] = useState(false);
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [cepOrigem, setCepOrigem] = useState("");
  const [transportadoras, setTransportadoras] = useState<ClienteTransportadoraPreferencial[]>([]);
  const [simulacaoId, setSimulacaoId] = useState<string | null>(freteSimulacaoId || null);
  const [opcoes, setOpcoes] = useState<FreteSimulacaoOpcao[]>([]);
  const [desatualizada, setDesatualizada] = useState(false);

  const [volumes, setVolumes] = useState(initialVolumes && initialVolumes > 0 ? initialVolumes : 1);
  const [altura, setAltura] = useState(initialAlturaCm ?? 15);
  const [largura, setLargura] = useState(initialLarguraCm ?? 10);
  const [comprimento, setComprimento] = useState(initialComprimentoCm ?? 30);

  const [manualServico, setManualServico] = useState("");
  const [manualModalidade, setManualModalidade] = useState("");
  const [manualPrazo, setManualPrazo] = useState<number>(0);
  const [manualValor, setManualValor] = useState<number>(0);
  const [manualObs, setManualObs] = useState("");
  const [transportadoraEscolhida, setTransportadoraEscolhida] = useState<string>("");

  const cepDestinoClean = (cepDestino || "").replace(/\D/g, "");

  const canQuote = useMemo(() => (
    cepOrigem.length === 8 && cepDestinoClean.length === 8 && pesoTotal > 0
  ), [cepOrigem, cepDestinoClean, pesoTotal]);

  const reloadOpcoes = async (id: string) => {
    const data = await carregarOpcoesSimulacao(id);
    setOpcoes(data);
  };

  const ensureSimulacao = async () => {
    const sim = await criarOuAtualizarSimulacao({
      origem_tipo: "orcamento",
      origem_id: origemId,
      cliente_id: clienteId || null,
      cep_origem: cepOrigem || null,
      cep_destino: cepDestinoClean || null,
      peso_total: pesoTotal > 0 ? pesoTotal : null,
      volumes,
      altura_cm: altura,
      largura_cm: largura,
      comprimento_cm: comprimento,
      valor_mercadoria: valorMercadoria,
      status: desatualizada ? "desatualizada" : "rascunho",
    });
    setSimulacaoId(sim.id);
    return sim.id;
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoadingBase(true);
        const [empresaCep, vinculos] = await Promise.all([
          getEmpresaCepOrigem(),
          clienteId ? getClienteTransportadoras(clienteId) : Promise.resolve([]),
        ]);
        setCepOrigem(empresaCep);
        setTransportadoras(vinculos);

        let currentId = freteSimulacaoId || null;
        if (!currentId) {
          const existente = await carregarSimulacaoPorOrigem("orcamento", origemId);
          currentId = existente?.id || null;
        }
        if (currentId) {
          setSimulacaoId(currentId);
          await reloadOpcoes(currentId);
        }
      } catch (error) {
        toast.error("Erro ao carregar simulador de frete");
      } finally {
        setLoadingBase(false);
      }
    };

    bootstrap();
  }, [clienteId, origemId, freteSimulacaoId]);

  useEffect(() => {
    setDesatualizada(true);
  }, [pesoTotal, clienteId, cepDestinoClean, volumes, altura, largura, comprimento]);

  const handleConsultarCorreios = async () => {
    if (!canQuote) {
      if (cepOrigem.length !== 8) return toast.error("Configure CEP de origem válido na empresa.");
      if (cepDestinoClean.length !== 8) return toast.error("Cliente sem CEP válido para simulação.");
      if (pesoTotal <= 0) return toast.error("Peso total deve ser maior que zero para simular.");
      return;
    }

    try {
      setLoadingCorreios(true);
      const id = await ensureSimulacao();
      const result = await consultarCorreios({
        cepOrigem,
        cepDestino: cepDestinoClean,
        peso: pesoTotal,
        comprimento,
        altura,
        largura,
      });

      const validas = result.filter((o) => !o.erro && o.valor > 0);
      if (!validas.length) {
        toast.warning("Correios sem opções para os dados informados.");
        return;
      }

      await salvarOpcoesSimulacao(id, validas.map((o) => ({
        fonte: "correios",
        servico: o.servico,
        codigo: o.codigo,
        prazo_dias: o.prazo,
        valor_frete: o.valor,
        valor_total: o.valor,
        payload_raw: o,
      })));
      await reloadOpcoes(id);
      setDesatualizada(false);
      toast.success("Cotações dos Correios adicionadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar Correios");
    } finally {
      setLoadingCorreios(false);
    }
  };

  const handleAdicionarManual = async (fonte: "manual" | "cliente_vinculada") => {
    if (manualValor <= 0) {
      toast.error("Informe valor de frete válido.");
      return;
    }
    if (fonte === "cliente_vinculada" && !transportadoraEscolhida) {
      toast.error("Selecione uma transportadora vinculada.");
      return;
    }
    try {
      setSalvandoManual(true);
      const id = await ensureSimulacao();
      await salvarOpcoesSimulacao(id, [{
        fonte,
        transportadora_id: fonte === "cliente_vinculada" ? (transportadoraEscolhida || null) : null,
        servico: manualServico || null,
        modalidade: manualModalidade || null,
        prazo_dias: manualPrazo || null,
        valor_frete: manualValor,
        valor_total: manualValor,
        observacoes: manualObs || null,
      }]);
      await reloadOpcoes(id);
      setDesatualizada(false);
      toast.success("Opção de frete adicionada.");
    } catch (error) {
      toast.error("Erro ao salvar opção manual");
    } finally {
      setSalvandoManual(false);
    }
  };

  const handleSelecionarOpcao = async (opcao: FreteSimulacaoOpcao) => {
    if (!simulacaoId) return;

    try {
      if (orcamentoId) {
        await selecionarOpcaoFrete(simulacaoId, opcao.id, orcamentoId, {
          volumes,
          altura_cm: altura,
          largura_cm: largura,
          comprimento_cm: comprimento,
        });
      }

      const tipo = opcao.fonte === "correios"
        ? `CORREIOS (${opcao.servico || "Serviço"})`
        : (opcao.servico || "FRETE");

      onFreteSelecionado({
        valor: opcao.valor_total,
        tipo,
        prazo: opcao.prazo_dias ? `${opcao.prazo_dias} dias` : "",
        modalidade: opcao.modalidade,
        origemFrete: opcao.fonte,
        servicoFrete: opcao.servico,
        prazoDias: opcao.prazo_dias,
        transportadoraId: opcao.transportadora_id,
        freteSimulacaoId: simulacaoId,
        volumes,
        alturaCm: altura,
        larguraCm: largura,
        comprimentoCm: comprimento,
      });
      await reloadOpcoes(simulacaoId);
      toast.success("Opção de frete selecionada.");
    } catch {
      toast.error("Erro ao selecionar opção de frete.");
    }
  };

  if (loadingBase) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando simulador de frete...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" /> Simulador de Frete
        </CardTitle>
        <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
          <p><strong>Origem:</strong> {cepOrigem || "não configurado"}</p>
          <p><strong>Destino:</strong> {cepDestinoClean || "não informado"}</p>
          <p><strong>Peso total:</strong> {pesoTotal.toFixed(3)} kg</p>
        </div>
        {desatualizada && <Badge variant="secondary" className="w-fit">Simulação desatualizada</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          <div><Label className="text-xs">Volumes</Label><Input type="number" min={1} value={volumes} onChange={(e) => setVolumes(Math.max(1, Number(e.target.value) || 1))} /></div>
          <div><Label className="text-xs">Altura (cm)</Label><Input type="number" min={1} value={altura} onChange={(e) => setAltura(Number(e.target.value) || 1)} /></div>
          <div><Label className="text-xs">Largura (cm)</Label><Input type="number" min={1} value={largura} onChange={(e) => setLargura(Number(e.target.value) || 1)} /></div>
          <div><Label className="text-xs">Comprimento (cm)</Label><Input type="number" min={1} value={comprimento} onChange={(e) => setComprimento(Number(e.target.value) || 1)} /></div>
        </div>

        <Tabs defaultValue="correios">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="correios">Correios</TabsTrigger>
            <TabsTrigger value="transportadoras">Transportadoras</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="correios" className="space-y-3">
            <Button onClick={handleConsultarCorreios} disabled={loadingCorreios} variant="outline" className="gap-2">
              {loadingCorreios && <Loader2 className="h-4 w-4 animate-spin" />} Consultar Correios
            </Button>
          </TabsContent>

          <TabsContent value="transportadoras" className="space-y-3">
            <div className="space-y-2">
              {transportadoras.map((t) => (
                <div key={t.id} className="border rounded-md p-2 text-sm">
                  <p className="font-medium">{t.transportadora_nome}</p>
                  <p className="text-xs text-muted-foreground">Prioridade {t.prioridade ?? "-"} • Modalidade {t.modalidade || "-"} • Prazo médio {t.prazo_medio || "-"}</p>
                </div>
              ))}
            </div>
            <Select value={transportadoraEscolhida} onValueChange={setTransportadoraEscolhida}>
              <SelectTrigger><SelectValue placeholder="Selecione a transportadora" /></SelectTrigger>
              <SelectContent>
                {transportadoras.map((t) => (
                  <SelectItem key={t.transportadora_id} value={t.transportadora_id}>{t.transportadora_nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleAdicionarManual("cliente_vinculada")} disabled={salvandoManual}>Adicionar proposta vinculada</Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-2">
            <Input placeholder="Serviço/descrição" value={manualServico} onChange={(e) => setManualServico(e.target.value)} />
            <Input placeholder="Modalidade" value={manualModalidade} onChange={(e) => setManualModalidade(e.target.value)} />
            <Input type="number" placeholder="Prazo (dias)" value={manualPrazo} onChange={(e) => setManualPrazo(Number(e.target.value) || 0)} />
            <Input type="number" placeholder="Valor" value={manualValor} onChange={(e) => setManualValor(Number(e.target.value) || 0)} />
            <Textarea placeholder="Observação" value={manualObs} onChange={(e) => setManualObs(e.target.value)} />
            <Button onClick={() => handleAdicionarManual("manual")} disabled={salvandoManual}>Adicionar frete manual</Button>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          {opcoes.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              onClick={() => handleSelecionarOpcao(opcao)}
              className={`w-full border rounded-md p-3 text-left ${opcao.selecionada ? "border-primary bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{opcao.servico || "Frete"}</p>
                  <p className="text-xs text-muted-foreground">
                    Fonte: {opcao.fonte === "correios" ? "Correios" : opcao.fonte === "cliente_vinculada" ? "Transportadora vinculada" : "Manual"}
                    {opcao.prazo_dias ? ` • ${opcao.prazo_dias} dias` : ""}
                  </p>
                </div>
                <span className="font-semibold text-sm">{formatCurrency(opcao.valor_total)}</span>
              </div>
            </button>
          ))}
          {!opcoes.length && <p className="text-xs text-muted-foreground">Nenhuma opção cadastrada para esta simulação.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
