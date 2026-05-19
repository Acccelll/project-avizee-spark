import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { ParcelasFiscalEditor, type ParcelaPlano } from "@/pages/fiscal/components/ParcelasFiscalEditor";
import { FiscalImpostosSection } from "@/pages/fiscal/components/FiscalImpostosSection";
import { formatCurrency } from "@/lib/format";
import { calcularFaturasParcelas } from "@/lib/cartaoFatura";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CartaoCredito } from "@/services/cartoesCredito.service";
import { PERIODICIDADE_OPTIONS } from "@/services/recorrencias.service";
import type {
  FornecedorRefMin,
  ClienteRefMin,
  ProdutoRefMin,
  OrdemVendaRefMin,
  ContaContabilRefMin,
} from "@/pages/fiscal/components/NfeCreateFormModal";

/**
 * Corpo do formulário de NF-e — única fonte de markup compartilhada entre o
 * modal de criação (`NfeCreateFormModal`) e a página `NotaFiscalForm`.
 *
 * Mantém o padrão de estado controlado (state vive no pai) para preservar a
 * lógica existente de `Fiscal.tsx` (XML import, totais agregados, gera_financeiro
 * + cartão de crédito). Os botões Cancelar/Salvar continuam no contêiner.
 */
export interface NfeFormBodyProps {
  form: Record<string, string | number | boolean>;
  setForm: (next: Record<string, string | number | boolean>) => void;
  items: GridItem[];
  setItems: (items: GridItem[]) => void;
  itemContaContabil: Record<number, string>;
  setItemContaContabil: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  parcelas: number;
  setParcelas: (n: number) => void;
  primeiroVencimento: string;
  setPrimeiroVencimento: (v: string) => void;
  intervaloDias: number;
  setIntervaloDias: (n: number) => void;
  parcelasPlano: ParcelaPlano[];
  setParcelasPlano: (p: ParcelaPlano[]) => void;
  fornecedores: FornecedorRefMin[];
  clientes: ClienteRefMin[];
  produtos: ProdutoRefMin[];
  ordensVenda: OrdemVendaRefMin[];
  contasContabeis: ContaContabilRefMin[];
  cartoes: CartaoCredito[];
  valorProdutos: number;
  totalImpostos: number;
  totalNF: number;
  xmlOriginInfo: { fornecedorNome: string } | null;
  traducaoLinhasCount: number;
  onAbrirTraducao: () => void;
  onCriarProdutoQuick: () => void;
  /**
   * Quando definido, exibe o botão "Cadastrar novo fornecedor" no autocomplete
   * de Fornecedor (apenas em NFs de entrada). Mesmo padrão de Orçamentos.
   */
  onCriarFornecedorQuick?: () => void;
}

export function NfeFormBody(props: NfeFormBodyProps) {
  const {
    form, setForm, items, setItems,
    itemContaContabil, setItemContaContabil,
    parcelas, setParcelas, primeiroVencimento, setPrimeiroVencimento,
    intervaloDias, setIntervaloDias, parcelasPlano, setParcelasPlano,
    fornecedores, clientes, produtos, ordensVenda,
    contasContabeis, cartoes, valorProdutos, totalImpostos, totalNF,
    xmlOriginInfo, traducaoLinhasCount, onAbrirTraducao, onCriarProdutoQuick,
    onCriarFornecedorQuick,
  } = props;

  const contasContabeisOptions = useMemo(
    () => contasContabeis.map((c) => ({
      id: c.id,
      label: `${c.codigo} - ${c.descricao}`,
      sublabel: c.codigo,
      searchTerms: [c.codigo, c.descricao],
    })),
    [contasContabeis],
  );

  const chaveDigits = String(form.chave_acesso || "").replace(/\D/g, "");
  const chaveInvalid = chaveDigits.length > 0 && chaveDigits.length !== 44;

  return (
    <div className="space-y-5">
      {xmlOriginInfo && traducaoLinhasCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <div>
            <strong>NF importada de XML.</strong> Tradução automática aplicada para <em>{xmlOriginInfo.fornecedorNome}</em>.
            <span className="text-muted-foreground"> Os campos fiscais do XML são preservados.</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onAbrirTraducao}>
            Ver/editar tradução
          </Button>
        </div>
      )}
      <SectionHeader title="Identificação" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="space-y-2"><Label>Tipo</Label>
          <Select value={String(form.tipo)} onValueChange={(v) => setForm({ ...form, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>Modelo</Label>
          <Select value={String(form.modelo_documento || "55")} onValueChange={(v) => setForm({ ...form, modelo_documento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="55">NF-e (Modelo 55)</SelectItem><SelectItem value="65">NFC-e (Modelo 65)</SelectItem><SelectItem value="57">CT-e (Modelo 57)</SelectItem><SelectItem value="67">CT-e OS (Modelo 67)</SelectItem><SelectItem value="nfse">NFS-e (Serviço)</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>Número *</Label><Input value={String(form.numero)} onChange={(e) => setForm({ ...form, numero: e.target.value })} required className="font-mono" /></div>
        <div className="space-y-2"><Label>Série</Label><Input value={String(form.serie)} onChange={(e) => setForm({ ...form, serie: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data Emissão</Label><Input type="date" value={String(form.data_emissao)} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
      </div>
      <div className="col-span-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Chave de Acesso</Label>
          {chaveDigits.length > 0 && (
            <span className={cn("text-[11px] font-mono", chaveDigits.length === 44 ? "text-success" : "text-destructive")}>
              {chaveDigits.length}/44 {chaveDigits.length === 44 ? "✓" : "✗"}
            </span>
          )}
        </div>
        <Input
          value={chaveDigits}
          onChange={(e) => {
            const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 44);
            setForm({ ...form, chave_acesso: onlyDigits });
          }}
          inputMode="numeric"
          maxLength={44}
          placeholder="44 dígitos numéricos"
          className={cn("font-mono text-xs", chaveInvalid && "border-destructive focus-visible:ring-destructive")}
        />
        {chaveInvalid && (
          <p className="text-[11px] text-destructive">
            {44 - chaveDigits.length > 0
              ? `Faltam ${44 - chaveDigits.length} dígitos`
              : `Excede o limite em ${chaveDigits.length - 44} dígitos`}
          </p>
        )}
      </div>
      <SectionHeader title="Partes" />
      <div className="bg-accent/30 rounded-lg p-4 space-y-3">
        {form.tipo === "entrada" ? (
          <><Label className="text-sm font-semibold">Fornecedor</Label><AutocompleteSearch options={fornecedores.map((f) => ({ id: f.id, label: f.nome_razao_social, sublabel: f.cpf_cnpj }))} value={String(form.fornecedor_id)} onChange={(id) => setForm({ ...form, fornecedor_id: id })} placeholder="Buscar fornecedor..." onCreateNew={onCriarFornecedorQuick} createNewLabel="Cadastrar novo fornecedor" /></>
        ) : (
          <><Label className="text-sm font-semibold">Cliente</Label><AutocompleteSearch options={clientes.map((c) => ({ id: c.id, label: c.nome_razao_social, sublabel: c.cpf_cnpj }))} value={String(form.cliente_id)} onChange={(id) => setForm({ ...form, cliente_id: id })} placeholder="Buscar cliente..." /></>
        )}
      </div>
      {form.tipo === "saida" && ordensVenda.length > 0 && (
        <div className="space-y-2"><Label>Pedido (opcional)</Label>
          <Select value={String(form.ordem_venda_id || "none")} onValueChange={(v) => setForm({ ...form, ordem_venda_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Vincular a um Pedido..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{ordensVenda.map((ov) => (<SelectItem key={ov.id} value={ov.id}>{ov.numero} — {ov.clientes?.nome_razao_social || ""}</SelectItem>))}</SelectContent></Select>
        </div>
      )}
      <SectionHeader title="Itens" />
      <ItemsGrid
        items={items}
        onChange={setItems}
        produtos={produtos}
        title="Itens da Nota"
        onCreateProduto={onCriarProdutoQuick}
      />
      {items.length > 0 && contasContabeis.length > 0 && (
        <div className="space-y-2"><Label className="text-sm font-semibold">Conta Contábil por Item</Label>
          <div className="space-y-2 rounded-lg border p-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground min-w-[120px] truncate">{item.descricao || `Item ${idx + 1}`}</span>
                <div className="flex-1">
                  <AutocompleteSearch
                    options={contasContabeisOptions}
                    value={itemContaContabil[idx] || ""}
                    onChange={(v) => setItemContaContabil((prev) => ({ ...prev, [idx]: v }))}
                    placeholder="Buscar conta contábil por código ou descrição..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <SectionHeader title="Tributos" />
      <FiscalImpostosSection
        values={form}
        onChange={(key, value) => setForm({ ...form, [key]: value })}
        modelo={String(form.modelo_documento || "55")}
      />
      <SectionHeader title="Pagamento" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2"><Label>Forma de Pagamento</Label>
          <Select value={String(form.forma_pagamento)} onValueChange={(v) => setForm({ ...form, forma_pagamento: v, cartao_id: v === "cartao_credito" ? form.cartao_id : "" })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="boleto_dda">Boleto/DDA</SelectItem><SelectItem value="cartao_credito">Cartão de Crédito</SelectItem><SelectItem value="cartao_debito">Cartão de Débito</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></SelectContent></Select>
        </div>
        {form.forma_pagamento === "cartao_credito" && (
          <div className="space-y-2"><Label>Cartão *</Label>
            <Select value={String(form.cartao_id || "")} onValueChange={(v) => setForm({ ...form, cartao_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o cartão..." /></SelectTrigger>
              <SelectContent>
                {cartoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{c.ultimos4 ? ` ····${c.ultimos4}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2"><Label>Condição</Label>
          <Select value={String(form.condicao_pagamento)} onValueChange={(v) => setForm({ ...form, condicao_pagamento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a_vista">À Vista</SelectItem><SelectItem value="a_prazo">A Prazo</SelectItem></SelectContent></Select>
        </div>
        {form.condicao_pagamento === "a_prazo" && <div className="space-y-2"><Label>Nº Parcelas</Label><Input type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} /></div>}
      </div>
      <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/20 px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.movimenta_estoque)}
            onChange={(e) => setForm({ ...form, movimenta_estoque: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          Movimenta Estoque
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.gera_financeiro)}
            onChange={(e) => setForm({ ...form, gera_financeiro: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          Gera Financeiro
        </label>
      </div>
      {form.gera_financeiro && (
        <RecorrenciaBlock form={form} setForm={setForm} />
      )}
      {form.condicao_pagamento === "a_prazo" && form.gera_financeiro && !form.recorrente && (
        <ParcelasFiscalEditor
          total={totalNF || Number(form.valor_total)}
          qtdParcelas={parcelas}
          dataEmissao={String(form.data_emissao)}
          primeiroVencimento={primeiroVencimento}
          intervaloDias={intervaloDias}
          parcelas={parcelasPlano}
          onPrimeiroVencimentoChange={setPrimeiroVencimento}
          onIntervaloChange={setIntervaloDias}
          onParcelasChange={setParcelasPlano}
          cartao={
            form.forma_pagamento === "cartao_credito" && form.cartao_id
              ? (() => {
                  const c = cartoes.find((x) => x.id === form.cartao_id);
                  return c ? { dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento } : null;
                })()
              : null
          }
        />
      )}
      {form.forma_pagamento === "cartao_credito" && form.cartao_id && form.gera_financeiro && form.condicao_pagamento === "a_vista" && !form.recorrente && (() => {
        const cartao = cartoes.find((c) => c.id === form.cartao_id);
        if (!cartao) return null;
        const previews = calcularFaturasParcelas(String(form.data_emissao), cartao.dia_fechamento, cartao.dia_vencimento, 1);
        return (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Fatura prevista para este cartão:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {previews.map((p, i) => (
                <li key={i}>
                  Competência {p.competencia} · fecha {p.dataFechamento.toLocaleDateString("pt-BR")} · vence <strong>{p.dataVencimento.toLocaleDateString("pt-BR")}</strong>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
      {contasContabeis.length > 0 && (
        <div className="space-y-2"><Label>Conta Contábil Geral (fallback para itens sem conta)</Label>
          <AutocompleteSearch
            options={contasContabeisOptions}
            value={String(form.conta_contabil_id || "")}
            onChange={(v) => setForm({ ...form, conta_contabil_id: v })}
            placeholder="Buscar conta contábil por código ou descrição..."
          />
        </div>
      )}
      <SectionHeader title="Revisão" />
      <div className="bg-accent/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Produtos:</span><span className="font-mono font-semibold">{formatCurrency(valorProdutos)}</span></div>
        {Number(form.frete_valor || 0) > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Frete:</span><span className="font-mono">{formatCurrency(Number(form.frete_valor))}</span></div>}
        {totalImpostos > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Impostos:</span><span className="font-mono">{formatCurrency(totalImpostos)}</span></div>}
        {Number(form.desconto_valor || 0) > 0 && <div className="flex justify-between items-center text-sm text-destructive"><span>Desconto:</span><span className="font-mono">-{formatCurrency(Number(form.desconto_valor))}</span></div>}
        <div className="flex justify-between items-center text-sm font-bold border-t pt-2"><span>Total da NF:</span><span className="font-mono text-lg">{formatCurrency(totalNF)}</span></div>
        {form.condicao_pagamento === "a_prazo" && parcelas > 1 && <div className="flex justify-between items-center text-xs text-muted-foreground"><span>{parcelas}× de</span><span className="font-mono font-semibold">{formatCurrency(totalNF / parcelas)}</span></div>}
      </div>
      {!form.gera_financeiro && <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">⚠️ "Gera Financeiro" está desmarcado — esta NF <strong>não</strong> gerará lançamentos financeiros ao ser confirmada.</div>}
      <div className="space-y-2"><Label>Observações</Label><Textarea value={String(form.observacoes)} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-baseline gap-2 pb-1 border-b">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}