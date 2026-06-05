import { useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/utils/errorMessages";
import { formatCurrency } from "@/lib/format";
import {
  ParcelasFiscalEditor,
  gerarPlanoParcelas,
  gerarPlanoParcelasCartao,
  type ParcelaPlano,
} from "@/pages/fiscal/components/ParcelasFiscalEditor";
import { listCartoesAtivos, type CartaoCredito } from "@/services/cartoesCredito.service";
import type { NotaFiscal } from "@/types/domain";
import { FORMA_PAGAMENTO_OPTIONS } from "@/lib/financeiro";

interface Props {
  open: boolean;
  onClose: () => void;
  nota: NotaFiscal | null;
  onSaved?: () => void;
}

/**
 * Modal enxuto para definir/alterar a forma de pagamento de uma NF e
 * (re)gerar os lançamentos financeiros via RPC `atualizar_financeiro_nota`.
 *
 * Cartão de crédito tem fluxo dedicado: o usuário só escolhe o cartão e
 * o número de parcelas; os vencimentos saem do ciclo do próprio cartão
 * (dia_fechamento / dia_vencimento). Demais formas usam o
 * `ParcelasFiscalEditor` clássico (à vista / a prazo livre).
 */
export function EditarPagamentoNotaModal({ open, onClose, nota, onSaved }: Props) {
  const total = Number(nota?.valor_total || 0);
  const emissao = nota?.data_emissao || new Date().toISOString().split("T")[0];

  const [forma, setForma] = useState<string>("");
  const [condicao, setCondicao] = useState<"a_vista" | "a_prazo">("a_vista");
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [primeiroVenc, setPrimeiroVenc] = useState("");
  const [intervalo, setIntervalo] = useState(30);
  const [plano, setPlano] = useState<ParcelaPlano[]>([]);
  const [cartaoId, setCartaoId] = useState<string>("");
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [saving, setSaving] = useState(false);

  const isCartaoCredito = forma === "cartao_credito";
  const cartaoSelecionado = useMemo(
    () => cartoes.find((c) => c.id === cartaoId) ?? null,
    [cartoes, cartaoId],
  );

  useEffect(() => {
    if (!open || !nota) return;
    setForma(nota.forma_pagamento || "");
    setCondicao(((nota.condicao_pagamento as "a_vista" | "a_prazo") || "a_vista"));
    setQtdParcelas(1);
    const venc = (() => {
      const d = new Date(emissao + "T00:00:00");
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    })();
    setPrimeiroVenc(venc);
    setIntervalo(30);
    setPlano([]);
    setCartaoId((nota as { cartao_id?: string | null }).cartao_id || "");
    listCartoesAtivos().then(setCartoes).catch(() => {});
  }, [open, nota, emissao]);

  // Preview de parcelas para cartão (derivado, não vai no submit dessa forma)
  const previewCartao = useMemo(() => {
    if (!isCartaoCredito || !cartaoSelecionado || qtdParcelas < 1) return [];
    return gerarPlanoParcelasCartao(
      total,
      qtdParcelas,
      emissao,
      cartaoSelecionado.dia_fechamento,
      cartaoSelecionado.dia_vencimento,
    );
  }, [isCartaoCredito, cartaoSelecionado, qtdParcelas, total, emissao]);

  const handleSave = async () => {
    if (!nota) return;
    if (!forma) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (isCartaoCredito && !cartaoId) {
      toast.error("Selecione o cartão de crédito.");
      return;
    }

    setSaving(true);
    try {
      let parcelasPayload: ParcelaPlano[];
      let condicaoEnviar = condicao;

      if (isCartaoCredito) {
        parcelasPayload = previewCartao;
        condicaoEnviar = qtdParcelas > 1 ? "a_prazo" : "a_vista";
      } else if (condicao === "a_prazo" && qtdParcelas > 1) {
        parcelasPayload =
          plano.length === qtdParcelas
            ? plano
            : gerarPlanoParcelas(total, qtdParcelas, primeiroVenc, intervalo);
      } else {
        parcelasPayload = [
          {
            numero: 1,
            vencimento: condicao === "a_prazo" ? primeiroVenc : emissao,
            valor: total,
          },
        ];
      }

      const { error } = await supabase.rpc("atualizar_financeiro_nota", {
        p_nota_id: nota.id,
        p_forma_pagamento: forma,
        p_condicao_pagamento: condicaoEnviar,
        p_parcelas: parcelasPayload as never,
      });
      if (error) throw error;

      // RPC não recebe cartao_id; grava direto na nota + lançamentos gerados.
      if (isCartaoCredito && cartaoId) {
        await supabase
          .from("notas_fiscais")
          .update({ cartao_id: cartaoId })
          .eq("id", nota.id);
        await supabase
          .from("financeiro_lancamentos")
          .update({ cartao_id: cartaoId })
          .eq("nota_fiscal_id", nota.id)
          .eq("ativo", true)
          .neq("status", "cancelado");
      }

      toast.success("Pagamento atualizado e lançamentos regerados.");
      onSaved?.();
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!nota) return null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Definir pagamento — NF ${nota.numero ?? "—"}`}
      size="md"
      footer={
        <FormModalFooter
          saving={saving}
          isDirty
          onCancel={onClose}
          onSubmit={handleSave}
          mode="edit"
        />
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total da nota</span>
            <span className="font-mono font-semibold">{formatCurrency(total)}</span>
          </div>
          {nota.data_emissao && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Emissão {new Date(emissao + "T00:00:00").toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento *</Label>
            <Select
              value={forma}
              onValueChange={(v) => {
                setForma(v);
                if (v !== "cartao_credito") setCartaoId("");
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCartaoCredito ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Nº de parcelas</Label>
              <Input
                type="number"
                min={1}
                max={36}
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(Math.max(1, Number(e.target.value) || 1))}
                className="h-9"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Condição</Label>
              <Select value={condicao} onValueChange={(v) => setCondicao(v as "a_vista" | "a_prazo")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À Vista</SelectItem>
                  <SelectItem value="a_prazo">A Prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {isCartaoCredito ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cartão *</Label>
              <Select value={cartaoId} onValueChange={setCartaoId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o cartão..." />
                </SelectTrigger>
                <SelectContent>
                  {cartoes.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum cartão ativo cadastrado.
                    </div>
                  ) : (
                    cartoes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.nome}
                          {c.ultimos4 ? ` •••• ${c.ultimos4}` : ""}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {cartaoSelecionado && (
              <div className="rounded-md border bg-muted/20 p-2.5 text-xs text-muted-foreground flex gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Vencimentos calculados pelo ciclo do cartão{" "}
                  <strong>{cartaoSelecionado.nome}</strong> — fecha dia{" "}
                  {cartaoSelecionado.dia_fechamento}, vence dia{" "}
                  {cartaoSelecionado.dia_vencimento}.
                  {qtdParcelas > 1 && (
                    <>
                      {" "}
                      {qtdParcelas}x de {formatCurrency(total / qtdParcelas)}.
                    </>
                  )}
                </span>
              </div>
            )}

            {cartaoSelecionado && previewCartao.length > 0 && (
              <div className="rounded-md border p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview das parcelas
                </p>
                <div className="divide-y text-xs">
                  {previewCartao.map((p) => (
                    <div key={p.numero} className="grid grid-cols-[40px_1fr_auto] py-1.5 gap-2">
                      <span className="font-mono text-muted-foreground">{p.numero}ª</span>
                      <span>{new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      <span className="font-mono font-medium">{formatCurrency(p.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          condicao === "a_prazo" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Nº Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={qtdParcelas}
                  onChange={(e) => setQtdParcelas(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 max-w-[120px]"
                />
              </div>
              <ParcelasFiscalEditor
                total={total}
                qtdParcelas={qtdParcelas}
                dataEmissao={emissao}
                primeiroVencimento={primeiroVenc}
                intervaloDias={intervalo}
                parcelas={plano}
                onPrimeiroVencimentoChange={setPrimeiroVenc}
                onIntervaloChange={setIntervalo}
                onParcelasChange={setPlano}
              />
            </>
          )
        )}
      </div>
    </FormModal>
  );
}
