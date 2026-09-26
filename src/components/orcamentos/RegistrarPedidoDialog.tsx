import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { getOrcamentoStatusLabel } from "@/lib/comercialWorkflow";
import {
  atualizarPedidoOrcamento,
  buscarPedidosDuplicados,
  registrarPedidoOrcamento,
  sugerirPrevisaoDespacho,
  type PedidoDuplicado,
} from "@/services/comercial/pedidoOrcamento.service";

export interface RegistrarPedidoOrcamento {
  id: string;
  numero: string;
  cliente_id: string | null;
  clienteNome?: string | null;
  clienteCpfCnpj?: string | null;
  valor_total: number | null;
  prazo_entrega_dias?: number | null;
  pedido_cliente?: string | null;
  data_pedido_cliente?: string | null;
  previsao_despacho?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  orcamento: RegistrarPedidoOrcamento | null;
  /** "editar" altera só os dados de um pedido já registrado. */
  modo?: "registrar" | "editar";
  onDone?: () => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Janela "Registrar pedido do cliente": o orçamento vira o pedido com o
 * número do pedido/OC do cliente (ou o próprio número do orçamento).
 */
export function RegistrarPedidoDialog({ open, onClose, orcamento, modo = "registrar", onDone }: Props) {
  const [pedido, setPedido] = useState("");
  const [usarOrc, setUsarOrc] = useState(false);
  const [dataPedido, setDataPedido] = useState(hoje());
  const [previsao, setPrevisao] = useState("");
  const [previsaoTocada, setPrevisaoTocada] = useState(false);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [duplicados, setDuplicados] = useState<PedidoDuplicado[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !orcamento) return;
    const pedidoAtual = orcamento.pedido_cliente ?? "";
    const semNumero = modo === "editar" && pedidoAtual === orcamento.numero;
    setPedido(semNumero ? "" : pedidoAtual);
    setUsarOrc(semNumero);
    const data = orcamento.data_pedido_cliente || hoje();
    setDataPedido(data);
    setPrevisao(orcamento.previsao_despacho || (modo === "registrar" ? sugerirPrevisaoDespacho(data, orcamento.prazo_entrega_dias) : ""));
    setPrevisaoTocada(modo === "editar");
    setAnexo(null);
    setDuplicados([]);
  }, [open, orcamento, modo]);

  // Enquanto o usuário não mexe na previsão, ela acompanha a data do pedido.
  useEffect(() => {
    if (!open || previsaoTocada || !orcamento) return;
    setPrevisao(sugerirPrevisaoDespacho(dataPedido, orcamento.prazo_entrega_dias));
  }, [dataPedido, previsaoTocada, open, orcamento]);

  const referencia = usarOrc ? orcamento?.numero ?? "" : pedido.trim();

  useEffect(() => {
    if (!open || !orcamento || !referencia) {
      setDuplicados([]);
      return;
    }
    let ativo = true;
    const t = setTimeout(() => {
      buscarPedidosDuplicados({
        orcamentoId: orcamento.id,
        clienteId: orcamento.cliente_id,
        clienteCpfCnpj: orcamento.clienteCpfCnpj ?? null,
        pedidoCliente: referencia,
      })
        .then((rows) => ativo && setDuplicados(rows))
        .catch(() => ativo && setDuplicados([]));
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [referencia, open, orcamento]);

  const faltaNumero = !usarOrc && !pedido.trim();

  const handleConfirmar = async () => {
    if (!orcamento || faltaNumero) return;
    setSalvando(true);
    try {
      const input = {
        orcamentoId: orcamento.id,
        pedidoCliente: usarOrc ? null : pedido,
        dataPedido,
        previsaoDespacho: previsao || null,
        anexo,
      };
      if (modo === "editar") {
        await atualizarPedidoOrcamento(input);
        toast.success(`Dados do pedido ${referencia} atualizados.`);
      } else {
        const res = await registrarPedidoOrcamento(input);
        toast.success(`${orcamento.numero} agora é o pedido ${res.pedido_cliente}.`);
        if (res.versoes_substituidas?.length) {
          toast.info(`Versão anterior encerrada: ${res.versoes_substituidas.join(", ")}.`);
        }
      }
      onDone?.();
      onClose();
    } catch (err) {
      notifyError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !salvando && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {modo === "editar" ? "Editar dados do pedido" : "Registrar pedido do cliente"}
          </DialogTitle>
          <DialogDescription>
            {orcamento
              ? `${orcamento.numero}${orcamento.clienteNome ? ` · ${orcamento.clienteNome}` : ""} · ${formatCurrency(Number(orcamento.valor_total || 0))}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="pedido-cliente" className="text-xs">Nº do pedido do cliente / OC</Label>
              <Input
                id="pedido-cliente"
                value={usarOrc ? orcamento?.numero ?? "" : pedido}
                onChange={(e) => setPedido(e.target.value)}
                disabled={usarOrc}
                placeholder="Ex.: 4500120465"
                className="h-9 font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pedido-data" className="text-xs">Data do pedido</Label>
              <Input id="pedido-data" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pedido-previsao" className="text-xs">Previsão de despacho</Label>
              <Input
                id="pedido-previsao"
                type="date"
                value={previsao}
                onChange={(e) => {
                  setPrevisaoTocada(true);
                  setPrevisao(e.target.value);
                }}
                className="h-9"
              />
            </div>
          </div>
          {!previsaoTocada && orcamento?.prazo_entrega_dias ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              Previsão sugerida: data do pedido + {orcamento.prazo_entrega_dias} dias de prazo de entrega.
            </p>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox id="pedido-usar-orc" checked={usarOrc} onCheckedChange={(v) => setUsarOrc(v === true)} />
            Cliente não enviou número — usar <span className="font-mono">{orcamento?.numero}</span> como referência
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="pedido-anexo" className="text-xs">
              {modo === "editar" ? "Trocar anexo do pedido (opcional)" : "Anexar pedido do cliente (opcional)"}
            </Label>
            <Input
              id="pedido-anexo"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
              className="h-9"
            />
          </div>

          {duplicados.length > 0 && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                Já existe o pedido <span className="font-mono font-semibold">{referencia}</span> para este cliente em{" "}
                {duplicados.map((d) => `${d.numero} (${getOrcamentoStatusLabel(d.status)})`).join(", ")}. Confira se não é duplicado.
              </p>
            </div>
          )}

          {modo === "registrar" && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• O orçamento passa para <strong className="text-foreground">Pedido</strong> e os itens ficam travados.</li>
              <li>• Entra na carteira do relatório Pedidos a Faturar.</li>
              <li>• Nenhuma nota fiscal é emitida.</li>
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={salvando || faltaNumero || !orcamento}>
            {salvando ? "Salvando..." : modo === "editar" ? "Salvar" : "Registrar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
