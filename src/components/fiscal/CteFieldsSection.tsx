import { useEffect, useState } from "react";
import { Truck, MapPin, Users, PackageSearch, DollarSign, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { UF_OPTIONS } from "@/constants/brasil";

const TIPO_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "complemento_valores", label: "Complemento de valores" },
  { value: "anulacao", label: "Anulação" },
  { value: "substituto", label: "Substituto" },
];

const MODAL_OPTIONS = [
  { value: "rodoviario", label: "Rodoviário" },
  { value: "aereo", label: "Aéreo" },
  { value: "aquaviario", label: "Aquaviário" },
  { value: "ferroviario", label: "Ferroviário" },
  { value: "dutoviario", label: "Dutoviário" },
  { value: "multimodal", label: "Multimodal" },
];

const TOMADOR_OPTIONS = [
  { value: 0, label: "0 - Remetente" },
  { value: 1, label: "1 - Expedidor" },
  { value: 2, label: "2 - Recebedor" },
  { value: 3, label: "3 - Destinatário" },
  { value: 4, label: "4 - Outros" },
];

interface Props {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  disabled?: boolean;
}

export function CteFieldsSection({ form, setForm, disabled }: Props) {
  const [chaveInput, setChaveInput] = useState("");
  const chaves: string[] = Array.isArray(form.cte_chave_nfe_ref) ? form.cte_chave_nfe_ref : [];

  // Pré-seleciona modal "rodoviário" quando ainda não houver valor —
  // maioria dos CT-es em NF de entrada são de transporte rodoviário.
  useEffect(() => {
    if (!form.cte_modal) {
      setForm({ ...form, cte_modal: "rodoviario" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addChave = () => {
    const v = chaveInput.replace(/\D/g, "");
    if (v.length !== 44) return;
    if (chaves.includes(v)) { setChaveInput(""); return; }
    setForm({ ...form, cte_chave_nfe_ref: [...chaves, v] });
    setChaveInput("");
  };

  const removeChave = (k: string) => {
    setForm({ ...form, cte_chave_nfe_ref: chaves.filter((c) => c !== k) });
  };

  const tomador = form.cte_tomador_tipo;

  return (
    <div className="space-y-4 rounded-lg border bg-accent/20 p-4">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Dados CT-e</h3>
      </div>

      {/* Identificação CT-e */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span>Identificação</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo de CT-e</Label>
            <Select value={form.cte_tipo ?? "normal"} onValueChange={(v) => setForm({ ...form, cte_tipo: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Modal de transporte *</Label>
            <Select value={form.cte_modal || "rodoviario"} onValueChange={(v) => setForm({ ...form, cte_modal: v })} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {MODAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>CFOP</Label>
            <Input
              value={form.cte_cfop ?? ""}
              onChange={(e) => setForm({ ...form, cte_cfop: e.target.value })}
              disabled={disabled}
              placeholder="ex: 5353"
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">5351–5360 (estadual) / 6351–6360 (interestadual)</p>
          </div>
          <div className="space-y-1">
            <Label>Natureza da operação</Label>
            <Input
              value={form.cte_natureza_operacao ?? ""}
              onChange={(e) => setForm({ ...form, cte_natureza_operacao: e.target.value })}
              disabled={disabled}
              placeholder="ex: Prestação de serviço de transporte"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Percurso */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Percurso</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label>Município de início</Label>
            <Input value={form.cte_municipio_inicio ?? ""} onChange={(e) => setForm({ ...form, cte_municipio_inicio: e.target.value })} disabled={disabled} />
          </div>
          <div className="space-y-1">
            <Label>UF</Label>
            <Select value={form.cte_municipio_inicio_uf ?? ""} onValueChange={(v) => setForm({ ...form, cte_municipio_inicio_uf: v })} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label>Município de fim</Label>
            <Input value={form.cte_municipio_fim ?? ""} onChange={(e) => setForm({ ...form, cte_municipio_fim: e.target.value })} disabled={disabled} />
          </div>
          <div className="space-y-1">
            <Label>UF</Label>
            <Select value={form.cte_municipio_fim_uf ?? ""} onValueChange={(v) => setForm({ ...form, cte_municipio_fim_uf: v })} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tomador */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Tomador do frete</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="space-y-1">
            <Label>Quem paga o frete</Label>
            <Select
              value={tomador != null ? String(tomador) : ""}
              onValueChange={(v) => setForm({ ...form, cte_tomador_tipo: Number(v) })}
              disabled={disabled}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {TOMADOR_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">O tomador é responsável pelo pagamento do serviço de transporte.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Participantes */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span>Participantes</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remetente</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="CNPJ/CPF" value={form.cte_remetente_doc ?? ""} onChange={(e) => setForm({ ...form, cte_remetente_doc: e.target.value })} disabled={disabled} />
              <Input placeholder="Razão social" className="sm:col-span-2" value={form.cte_remetente_razao_social ?? ""} onChange={(e) => setForm({ ...form, cte_remetente_razao_social: e.target.value })} disabled={disabled} />
              <Select value={form.cte_remetente_uf ?? ""} onValueChange={(v) => setForm({ ...form, cte_remetente_uf: v })} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-24"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Destinatário</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="CNPJ/CPF" value={form.cte_destinatario_doc ?? ""} onChange={(e) => setForm({ ...form, cte_destinatario_doc: e.target.value })} disabled={disabled} />
              <Input placeholder="Razão social" className="sm:col-span-2" value={form.cte_destinatario_razao_social ?? ""} onChange={(e) => setForm({ ...form, cte_destinatario_razao_social: e.target.value })} disabled={disabled} />
              <Select value={form.cte_destinatario_uf ?? ""} onValueChange={(v) => setForm({ ...form, cte_destinatario_uf: v })} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-24"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {tomador === 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expedidor</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="CNPJ/CPF" value={form.cte_expedidor_doc ?? ""} onChange={(e) => setForm({ ...form, cte_expedidor_doc: e.target.value })} disabled={disabled} />
                <Input placeholder="Razão social" className="sm:col-span-2" value={form.cte_expedidor_razao_social ?? ""} onChange={(e) => setForm({ ...form, cte_expedidor_razao_social: e.target.value })} disabled={disabled} />
              </div>
            </div>
          )}

          {tomador === 2 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recebedor</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="CNPJ/CPF" value={form.cte_recebedor_doc ?? ""} onChange={(e) => setForm({ ...form, cte_recebedor_doc: e.target.value })} disabled={disabled} />
                <Input placeholder="Razão social" className="sm:col-span-2" value={form.cte_recebedor_razao_social ?? ""} onChange={(e) => setForm({ ...form, cte_recebedor_razao_social: e.target.value })} disabled={disabled} />
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Carga */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><PackageSearch className="h-3.5 w-3.5" /> Carga transportada</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-3">
              <Label>Produto predominante</Label>
              <Input value={form.cte_produto_predominante ?? ""} onChange={(e) => setForm({ ...form, cte_produto_predominante: e.target.value })} disabled={disabled} placeholder="ex: Eletrodomésticos" />
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input type="number" step="0.0001" value={form.cte_quantidade ?? ""} onChange={(e) => setForm({ ...form, cte_quantidade: e.target.value === "" ? null : Number(e.target.value) })} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Input value={form.cte_unidade_medida ?? ""} onChange={(e) => setForm({ ...form, cte_unidade_medida: e.target.value })} disabled={disabled} placeholder="KG, M3, UN..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chaves NF-e das mercadorias transportadas</Label>
            <div className="flex gap-2">
              <Input
                value={chaveInput}
                onChange={(e) => setChaveInput(e.target.value.replace(/\D/g, "").slice(0, 44))}
                placeholder="44 dígitos"
                className="font-mono"
                disabled={disabled}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChave(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addChave} disabled={disabled || chaveInput.replace(/\D/g, "").length !== 44}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chaves.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma chave informada.</span>}
              {chaves.map((k) => (
                <Badge key={k} variant="outline" className="font-mono text-[10px] gap-1 pr-1">
                  …{k.slice(-12)}
                  <button type="button" onClick={() => removeChave(k)} className="hover:bg-destructive/10 rounded p-0.5" aria-label="Remover chave">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Valores */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Valores do frete</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Valor da prestação (R$)</Label>
            <Input type="number" step="0.01" value={form.cte_valor_prestacao ?? ""} onChange={(e) => setForm({ ...form, cte_valor_prestacao: e.target.value === "" ? null : Number(e.target.value) })} disabled={disabled} />
          </div>
          <div className="space-y-1">
            <Label>Valor a receber (R$)</Label>
            <Input type="number" step="0.01" value={form.cte_valor_receber ?? ""} onChange={(e) => setForm({ ...form, cte_valor_receber: e.target.value === "" ? null : Number(e.target.value) })} disabled={disabled} />
            <p className="text-[11px] text-muted-foreground">Pode diferir se houver retenções.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}