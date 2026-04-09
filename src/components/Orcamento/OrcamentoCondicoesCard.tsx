import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CondicoesForm {
  quantidade_total: number;
  peso_total: number;
  pagamento: string;
  prazo_pagamento: string;
  prazo_entrega: string;
  frete_tipo: string;
  modalidade: string;
}

interface Props {
  form: CondicoesForm;
  onChange: (field: string, value: any) => void;
}

export function OrcamentoCondicoesCard({ form, onChange }: Props) {
  return (
    <div className="bg-card rounded-xl border shadow-soft p-5">
      <h3 className="font-semibold text-foreground mb-4">Condições Comerciais</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Quantidade Total</Label>
          <div className="h-10 flex items-center px-3 bg-accent/30 rounded-md font-mono text-sm">
            {form.quantidade_total}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Peso Total (kg)</Label>
          <div className="h-10 flex items-center px-3 bg-accent/30 rounded-md font-mono text-sm">
            {form.peso_total.toFixed(2)}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Pagamento</Label>
          <Select value={form.pagamento} onValueChange={(v) => onChange("pagamento", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a_vista">À Vista</SelectItem>
              <SelectItem value="a_prazo">A Prazo</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Prazo</Label>
          <Input value={form.prazo_pagamento} onChange={(e) => onChange("prazo_pagamento", e.target.value)} placeholder="Ex: 30/60/90 dias" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Prazo de Entrega</Label>
          <Input value={form.prazo_entrega} onChange={(e) => onChange("prazo_entrega", e.target.value)} placeholder="Ex: 12 dias úteis" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Frete</Label>
          <Input value={form.frete_tipo} onChange={(e) => onChange("frete_tipo", e.target.value)} placeholder="Ex: CORREIOS (SEDEX)" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select value={form.modalidade} onValueChange={(v) => onChange("modalidade", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FOB">FOB</SelectItem>
              <SelectItem value="CIF">CIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
