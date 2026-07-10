/**
 * Registry de formas de pagamento (Épico E — Financeiro Inteligente 2.0).
 *
 * Cada forma pode declarar um fieldset dedicado (campos extras específicos
 * da forma) que grava no jsonb `forma_pagamento_dados`. A UI principal
 * (FinanceiroLancamentoForm) só monta `<PaymentMethodFieldset />` e delega
 * a renderização ao componente cadastrado aqui.
 *
 * Adicionar uma nova forma = registrar um objeto — nenhuma alteração no
 * form principal.
 */

import type { ComponentType } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormaPagamentoCanonica } from "@/lib/financeiro";

export interface PaymentFieldsetProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export interface PaymentMethodDefinition {
  forma: FormaPagamentoCanonica;
  Fieldset: ComponentType<PaymentFieldsetProps>;
}

const set = (
  value: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  key: string,
  v: unknown,
) => onChange({ ...value, [key]: v });

function PixFieldset({ value, onChange }: PaymentFieldsetProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Chave PIX</Label>
        <Input
          value={(value.chave_pix as string) ?? ""}
          onChange={(e) => set(value, onChange, "chave_pix", e.target.value)}
          placeholder="e-mail / CPF / celular / aleatória"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">EndToEnd / txid</Label>
        <Input
          value={(value.txid as string) ?? ""}
          onChange={(e) => set(value, onChange, "txid", e.target.value)}
        />
      </div>
    </div>
  );
}

function BoletoFieldset({ value, onChange }: PaymentFieldsetProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label className="text-xs">Linha digitável</Label>
        <Input
          value={(value.linha_digitavel as string) ?? ""}
          onChange={(e) => set(value, onChange, "linha_digitavel", e.target.value)}
          placeholder="47 dígitos"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Nosso número</Label>
        <Input
          value={(value.nosso_numero as string) ?? ""}
          onChange={(e) => set(value, onChange, "nosso_numero", e.target.value)}
        />
      </div>
    </div>
  );
}

function CartaoDebitoFieldset({ value, onChange }: PaymentFieldsetProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Bandeira</Label>
        <Input
          value={(value.bandeira as string) ?? ""}
          onChange={(e) => set(value, onChange, "bandeira", e.target.value)}
          placeholder="Visa / Mastercard / Elo"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Últimos 4 dígitos</Label>
        <Input
          maxLength={4}
          value={(value.ultimos_4 as string) ?? ""}
          onChange={(e) => set(value, onChange, "ultimos_4", e.target.value.replace(/\D/g, ""))}
        />
      </div>
    </div>
  );
}

function TransferenciaFieldset({ value, onChange }: PaymentFieldsetProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Select
          value={(value.tipo_transferencia as string) ?? ""}
          onValueChange={(v) => set(value, onChange, "tipo_transferencia", v)}
        >
          <SelectTrigger><SelectValue placeholder="TED / DOC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TED">TED</SelectItem>
            <SelectItem value="DOC">DOC</SelectItem>
            <SelectItem value="TRANSF_MESMO_BANCO">Mesmo banco</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Banco destino</Label>
        <Input
          value={(value.banco_destino as string) ?? ""}
          onChange={(e) => set(value, onChange, "banco_destino", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Agência / Conta</Label>
        <Input
          value={(value.agencia_conta as string) ?? ""}
          onChange={(e) => set(value, onChange, "agencia_conta", e.target.value)}
          placeholder="0001 / 12345-6"
        />
      </div>
    </div>
  );
}

function DinheiroFieldset({ value, onChange }: PaymentFieldsetProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Recebido de / entregue a</Label>
      <Input
        value={(value.contraparte as string) ?? ""}
        onChange={(e) => set(value, onChange, "contraparte", e.target.value)}
        placeholder="Nome do responsável"
      />
    </div>
  );
}

const REGISTRY: Partial<Record<FormaPagamentoCanonica, PaymentMethodDefinition>> = {
  pix: { forma: "pix", Fieldset: PixFieldset },
  boleto_dda: { forma: "boleto_dda", Fieldset: BoletoFieldset },
  cartao_debito: { forma: "cartao_debito", Fieldset: CartaoDebitoFieldset },
  transferencia: { forma: "transferencia", Fieldset: TransferenciaFieldset },
  dinheiro: { forma: "dinheiro", Fieldset: DinheiroFieldset },
};

export function PaymentMethodFieldset({
  forma,
  value,
  onChange,
}: {
  forma: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const def = REGISTRY[forma as FormaPagamentoCanonica];
  if (!def) return null;
  const { Fieldset } = def;
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Detalhes de {forma.replace("_", " ")}
      </div>
      <Fieldset value={value ?? {}} onChange={onChange} />
    </div>
  );
}