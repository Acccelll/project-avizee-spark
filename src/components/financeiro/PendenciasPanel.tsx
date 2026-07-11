import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, RefreshCw, CheckCircle2, Check, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useNotasPendentesForma } from "@/hooks/useNotasPendentesForma";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atualizarFinanceiroNota } from "@/services/fiscal/lifecycle.service";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { listCartoesAtivos, type CartaoCredito } from "@/services/cartoesCredito.service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";

interface QuickPayoutRow {
  notaId: string;
  valorTotal: number;
  dataEmissao: string | null;
  onDone: () => void;
}

function addMonths(iso: string, m: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1 + m, d);
  return dt.toISOString().split("T")[0];
}

function QuickPayoutPopover({ notaId, valorTotal, dataEmissao, onDone }: QuickPayoutRow) {
  const invalidate = useInvalidateAfterMutation();
  const [open, setOpen] = useState(false);
  const [forma, setForma] = useState<string>("boleto_dda");
  const [condicao, setCondicao] = useState<"a_vista" | "a_prazo">("a_vista");
  const [nParcelas, setNParcelas] = useState<number>(1);
  const hoje = new Date().toISOString().split("T")[0];
  const [primeiroVenc, setPrimeiroVenc] = useState<string>(dataEmissao || hoje);
  const [saving, setSaving] = useState(false);
  const [cartaoId, setCartaoId] = useState<string>("");
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [cartoesLoading, setCartoesLoading] = useState(false);

  const isCartao = forma === "cartao_credito";

  useEffect(() => {
    if (!open || !isCartao || cartoes.length > 0 || cartoesLoading) return;
    setCartoesLoading(true);
    listCartoesAtivos()
      .then((rows) => setCartoes(rows))
      .catch(notifyError)
      .finally(() => setCartoesLoading(false));
  }, [open, isCartao, cartoes.length, cartoesLoading]);

  const salvar = async () => {
    if (isCartao && !cartaoId) {
      toast.error("Selecione o cartão de crédito.");
      return;
    }
    const total = Number(valorTotal || 0);
    if (!total) {
      toast.error("Valor da nota inválido.");
      return;
    }
    const qtde = condicao === "a_prazo" ? Math.max(1, Number(nParcelas) || 1) : 1;
    const base = Math.round((total / qtde) * 100) / 100;
    const parcelas = Array.from({ length: qtde }, (_, i) => {
      const isLast = i === qtde - 1;
      const valor = isLast
        ? Math.round((total - base * (qtde - 1)) * 100) / 100
        : base;
      const vencimento =
        qtde === 1
          ? (condicao === "a_prazo" ? primeiroVenc : (dataEmissao || hoje))
          : addMonths(primeiroVenc, i);
      return { numero: i + 1, vencimento, valor };
    });
    setSaving(true);
    try {
      if (isCartao) {
        // Persistimos o cartão escolhido na NF — a RPC lê `cartao_id` da nota.
        const { error: upErr } = await supabase
          .from("notas_fiscais")
          .update({ cartao_id: cartaoId })
          .eq("id", notaId);
        if (upErr) throw upErr;
      }
      await atualizarFinanceiroNota({
        notaId,
        formaPagamento: forma,
        condicaoPagamento: isCartao && qtde > 1 ? "a_prazo" : condicao,
        parcelas: parcelas as never,
      });
      toast.success("Pagamento definido e lançamentos gerados.");
      await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      setOpen(false);
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Check className="h-3 w-3" /> Definir
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold">Definir pagamento</p>
          <p className="text-[11px] text-muted-foreground">
            Total: {formatCurrency(Number(valorTotal || 0))}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Forma</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="boleto_dda">Boleto/DDA</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
              <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isCartao ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Cartão *</Label>
              <Select value={cartaoId} onValueChange={setCartaoId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={cartoesLoading ? "Carregando…" : "Selecione o cartão"} />
                </SelectTrigger>
                <SelectContent>
                  {cartoes.length === 0 ? (
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      Nenhum cartão ativo.
                    </div>
                  ) : cartoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}{c.ultimos4 ? ` ····${c.ultimos4}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nº Parcelas</Label>
              <Input
                type="number"
                min={1}
                max={48}
                value={nParcelas}
                onChange={(e) => setNParcelas(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Vencimentos seguirão a fatura do cartão.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Condição</Label>
              <Select value={condicao} onValueChange={(v) => setCondicao(v as "a_vista" | "a_prazo")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="a_prazo">A prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {condicao === "a_prazo" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    value={nParcelas}
                    onChange={(e) => setNParcelas(Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">1º Venc.</Label>
                  <Input
                    type="date"
                    value={primeiroVenc}
                    onChange={(e) => setPrimeiroVenc(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </>
        )}
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={salvar}
          disabled={saving || (isCartao && !cartaoId)}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Confirmar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatCnpj(doc: string | null | undefined): string {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

export function PendenciasPanel({ open, onClose }: Props) {
  const { data: notas = [], isLoading, refetch, isFetching } = useNotasPendentesForma();
  const navigate = useNavigate();

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Pendências de pagamento
                {notas.length > 0 && (
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    {notas.length}
                  </Badge>
                )}
              </SheetTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                title="Atualizar"
                aria-label="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <SheetDescription>
              NFs de entrada que geram financeiro mas estão sem forma de pagamento. Clique em
              <strong> Definir</strong> para resolver cada pendência.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
          ) : notas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold">Tudo em dia!</h3>
              <p className="text-sm text-muted-foreground">
                Não há notas fiscais de entrada aguardando forma de pagamento.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {notas.map((nota) => {
                const nome =
                  nota.fornecedores?.nome_razao_social || "Fornecedor desconhecido";
                return (
                  <div
                    key={nota.id}
                    className="rounded-lg border bg-card p-3 hover:border-warning/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-medium text-sm truncate">{nome}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatCnpj(nota.fornecedores?.cpf_cnpj)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground pt-0.5">
                          {nota.numero && (
                            <span className="font-mono">NF {nota.numero}</span>
                          )}
                          {nota.data_emissao && (
                            <span>
                              {new Date(nota.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-mono font-semibold text-sm">
                          {formatCurrency(Number(nota.valor_total || 0))}
                        </span>
                        <QuickPayoutPopover
                          notaId={nota.id}
                          valorTotal={Number(nota.valor_total || 0)}
                          dataEmissao={nota.data_emissao}
                          onDone={() => refetch()}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 text-[10px] text-muted-foreground"
                          onClick={() => {
                            onClose();
                            navigate(`/fiscal/${nota.id}/editar`);
                          }}
                        >
                          <FileText className="h-3 w-3" /> Editar NF
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                {notas.length} nota(s) · exibindo até 100
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}