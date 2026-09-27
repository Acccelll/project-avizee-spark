import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ProductAutocomplete } from "@/components/ui/ProductAutocomplete";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { AlertTriangle, ClipboardPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { getOrcamentoStatusLabel } from "@/lib/comercialWorkflow";
import { listClientesAtivosOrcamento, listProdutosAtivosComFornecedores } from "@/services/orcamentos.service";
import { buscarPedidosDuplicados, type PedidoDuplicado } from "@/services/comercial/pedidoOrcamento.service";
import {
  CANAIS_PEDIDO_DIRETO,
  CANAL_LABEL,
  avisoNumeroMercadoLivre,
  criarPedidoDireto,
  pedidoObrigatorio,
  rotuloNumeroPedido,
  totalItens,
  ultimosPrecosDoCliente,
  type CanalPedidoDireto,
} from "@/services/comercial/pedidoDireto.service";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Recebe o id do orçamento criado. */
  onDone?: (orcamentoId: string) => void;
}

interface LinhaItem {
  key: number;
  produtoId: string;
  quantidade: string;
  preco: string;
}

const hoje = () => new Date().toISOString().slice(0, 10);
let seq = 0;
const novaLinha = (): LinhaItem => ({ key: ++seq, produtoId: "", quantidade: "1", preco: "" });
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

/**
 * "Novo pedido": pedido que chega sem proposta (WhatsApp, Mercado Livre,
 * OC por e-mail, telefone). Cria o orçamento já como Pedido, em aberto.
 */
export function NovoPedidoDialog({ open, onClose, onDone }: Props) {
  const qc = useQueryClient();
  const [canal, setCanal] = useState<CanalPedidoDireto>("whatsapp");
  const [clienteId, setClienteId] = useState("");
  const [pedido, setPedido] = useState("");
  const [dataPedido, setDataPedido] = useState(hoje());
  const [previsao, setPrevisao] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([novaLinha()]);
  const [frete, setFrete] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [duplicados, setDuplicados] = useState<PedidoDuplicado[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["orcamento-form", "clientes-ativos"],
    queryFn: () => listClientesAtivosOrcamento(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["orcamento-form", "produtos-ativos"],
    queryFn: () => listProdutosAtivosComFornecedores(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const { data: ultimosPrecos } = useQuery({
    queryKey: ["pedido-direto", "ultimos-precos", clienteId],
    queryFn: () => ultimosPrecosDoCliente(clienteId),
    enabled: open && !!clienteId,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    setCanal("whatsapp");
    setClienteId("");
    setPedido("");
    setDataPedido(hoje());
    setPrevisao("");
    setLinhas([novaLinha()]);
    setFrete("");
    setObservacoes("");
    setAnexo(null);
    setDuplicados([]);
  }, [open]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const produtoPorId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const clienteOptions = useMemo(
    () =>
      clientes.map((c) => ({
        id: c.id,
        label: c.nome_razao_social,
        sublabel: c.cpf_cnpj || "sem documento",
        rightMeta: c.cidade ? `${c.cidade}/${c.uf || ""}` : undefined,
        searchTerms: [c.nome_razao_social, c.nome_fantasia, c.cpf_cnpj].filter(Boolean) as string[],
      })),
    [clientes],
  );

  const precoSugerido = (produtoId: string) =>
    ultimosPrecos?.get(produtoId) ?? Number(produtoPorId.get(produtoId)?.preco_venda ?? 0);

  const itens = linhas
    .filter((l) => l.produtoId && num(l.quantidade) > 0)
    .map((l) => {
      const p = produtoPorId.get(l.produtoId);
      return {
        produtoId: l.produtoId,
        codigo: p?.codigo_interno ?? null,
        descricao: p?.nome ?? "",
        unidade: p?.unidade_medida ?? null,
        quantidade: num(l.quantidade),
        valorUnitario: num(l.preco),
      };
    });
  const valorItens = totalItens(itens);
  const total = valorItens + Math.max(num(frete), 0);

  const numeroPedido = pedido.trim();
  const avisoMl = canal === "mercado_livre" ? avisoNumeroMercadoLivre(numeroPedido) : null;

  useEffect(() => {
    if (!open || !numeroPedido || (!clienteId && canal !== "mercado_livre")) {
      setDuplicados([]);
      return;
    }
    let ativo = true;
    const t = setTimeout(() => {
      buscarPedidosDuplicados({
        orcamentoId: null,
        clienteId: clienteId || null,
        clienteCpfCnpj: cliente?.cpf_cnpj ?? null,
        pedidoCliente: numeroPedido,
        qualquerCliente: canal === "mercado_livre",
      })
        .then((rows) => ativo && setDuplicados(rows))
        .catch(() => ativo && setDuplicados([]));
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [numeroPedido, clienteId, canal, open, cliente?.cpf_cnpj]);

  const faltando = [
    !clienteId && "cliente",
    pedidoObrigatorio(canal) && !numeroPedido && (canal === "mercado_livre" ? "nº da venda" : "nº da OC"),
    itens.length === 0 && "pelo menos um item",
  ].filter(Boolean) as string[];

  const atualizarLinha = (key: number, patch: Partial<LinhaItem>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const escolherProduto = (key: number, produtoId: string) => {
    const preco = precoSugerido(produtoId);
    atualizarLinha(key, { produtoId, preco: preco ? String(preco) : "" });
  };

  const handleSalvar = async () => {
    if (faltando.length) return;
    setSalvando(true);
    try {
      const res = await criarPedidoDireto({
        clienteId,
        canal,
        itens,
        pedidoCliente: numeroPedido || null,
        dataPedido,
        previsaoDespacho: previsao || null,
        freteValor: Math.max(num(frete), 0),
        observacoes,
        anexo,
      });
      const ref = res.pedido_cliente && res.pedido_cliente !== res.numero ? ` · pedido ${res.pedido_cliente}` : "";
      toast.success(`Pedido ${res.numero} (${CANAL_LABEL[canal]}) registrado${ref}.`);
      void qc.invalidateQueries({ queryKey: ["orcamentos"] });
      onDone?.(res.id);
      onClose();
    } catch (err) {
      notifyError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && !salvando && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPlus className="h-4 w-4" /> Novo pedido
            </DialogTitle>
            <DialogDescription>
              Pedido que chegou sem proposta. Ele entra direto em Pedidos em aberto, com número ORC gerado ao salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Canal</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Canal do pedido">
                {CANAIS_PEDIDO_DIRETO.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={canal === c}
                    size="sm"
                    variant={canal === c ? "default" : "outline"}
                    className="min-h-11 sm:min-h-0"
                    onClick={() => setCanal(c)}
                  >
                    {CANAL_LABEL[c]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <AutocompleteSearch
                options={clienteOptions}
                value={clienteId}
                onChange={setClienteId}
                placeholder={canal === "mercado_livre" ? "Buscar comprador por nome ou CPF…" : "Buscar por nome ou CNPJ…"}
                onCreateNew={() => setQuickAddOpen(true)}
                createNewLabel={canal === "mercado_livre" ? "Cadastrar comprador" : "Cadastrar novo cliente"}
              />
              {cliente && (
                <p className="text-xs text-muted-foreground">
                  {cliente.cpf_cnpj || "sem documento"}
                  {cliente.cidade ? ` · ${cliente.cidade}/${cliente.uf || ""}` : ""}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="novo-pedido-numero" className="text-xs">{rotuloNumeroPedido(canal)}</Label>
                <Input
                  id="novo-pedido-numero"
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  placeholder={canal === "mercado_livre" ? "2000…" : canal === "email" ? "Ex.: 4500120465" : "Sem número: usa o ORC"}
                  className="font-mono"
                  inputMode={canal === "mercado_livre" ? "numeric" : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-pedido-data" className="text-xs">Data do pedido</Label>
                <Input id="novo-pedido-data" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-pedido-previsao" className="text-xs">Previsão de despacho (opcional)</Label>
                <Input id="novo-pedido-previsao" type="date" value={previsao} min={dataPedido} onChange={(e) => setPrevisao(e.target.value)} />
              </div>
            </div>
            {avisoMl && <p className="-mt-3 text-xs text-warning">{avisoMl}</p>}
            {duplicados.length > 0 && (
              <div className="-mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Já existe o pedido {numeroPedido} em{" "}
                  {duplicados.map((d) => `${d.numero} (${getOrcamentoStatusLabel(d.status)})`).join(", ")}. Confira se não é duplicado.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Itens</Label>
              <div className="space-y-2">
                {linhas.map((l) => {
                  const subtotal = num(l.quantidade) * num(l.preco);
                  return (
                    <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_7rem_auto] sm:items-center sm:border-0 sm:p-0">
                      <ProductAutocomplete
                        products={produtos}
                        value={l.produtoId}
                        onChange={(id) => escolherProduto(l.key, id)}
                        placeholder="Buscar produto…"
                        className="col-span-2 sm:col-span-1"
                      />
                      <Input
                        aria-label="Quantidade"
                        inputMode="decimal"
                        value={l.quantidade}
                        onChange={(e) => atualizarLinha(l.key, { quantidade: e.target.value })}
                        placeholder="Qtd"
                      />
                      <Input
                        aria-label="Preço unitário"
                        inputMode="decimal"
                        value={l.preco}
                        onChange={(e) => atualizarLinha(l.key, { preco: e.target.value })}
                        placeholder="Preço"
                      />
                      <span className="self-center text-right text-sm tabular-nums">{formatCurrency(subtotal)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="min-h-11 sm:min-h-0"
                        aria-label="Remover item"
                        disabled={linhas.length === 1}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 gap-1.5 sm:min-h-0"
                onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
              {clienteId && ultimosPrecos && ultimosPrecos.size > 0 && (
                <p className="text-xs text-muted-foreground">O preço sugerido é o último praticado para este cliente; sem histórico, o da tabela.</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="novo-pedido-frete" className="text-xs">Frete (opcional)</Label>
                <Input id="novo-pedido-frete" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="novo-pedido-anexo" className="text-xs">Anexo (opcional): print da conversa, PDF da OC</Label>
                <Input id="novo-pedido-anexo" type="file" accept=".pdf,image/*" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-pedido-obs" className="text-xs">Observações (opcional)</Label>
              <Textarea id="novo-pedido-obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {itens.length} {itens.length === 1 ? "item" : "itens"}
                {num(frete) > 0 ? ` + frete ${formatCurrency(num(frete))}` : ""}
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:items-center">
            {faltando.length > 0 && (
              <p className={cn("mr-auto text-xs text-muted-foreground")}>Falta: {faltando.join(", ")}.</p>
            )}
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={() => void handleSalvar()} disabled={salvando || faltando.length > 0} className="gap-1.5">
              <ClipboardPlus className="h-4 w-4" /> {salvando ? "Registrando…" : "Registrar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddClientModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(id) => {
          void qc.invalidateQueries({ queryKey: ["orcamento-form", "clientes-ativos"] });
          setClienteId(id);
          setQuickAddOpen(false);
        }}
        defaults={canal === "mercado_livre" ? { tipo_pessoa: "F" } : undefined}
      />
    </>
  );
}
