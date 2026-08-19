import { useEffect, useMemo, useRef } from "react";
import { Receipt, Building2, Calculator, ChevronDown, Plus, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { calcularNfse, divergenciaValor, validarNfse, TRIBUTOS_NFSE, type RetencaoNfse, type NfseTributo } from "@/lib/fiscal/nfseCalculo";
import { decimalParaPercentual, percentualParaDecimal } from "@/lib/fiscal/aliquota";
import { formatCurrency } from "@/lib/format";
import { listarRetencoesNfse } from "@/services/fiscal/lifecycle.service";

const NATUREZA_OPTIONS = [
  { value: 1, label: "1 - Tributação no município" }, { value: 2, label: "2 - Tributação fora do município" },
  { value: 3, label: "3 - Isento" }, { value: 4, label: "4 - Imune" },
  { value: 5, label: "5 - Exigibilidade suspensa (judicial)" }, { value: 6, label: "6 - Exigibilidade suspensa (administrativa)" },
];

interface Props { form: Record<string, any>; setForm: (f: Record<string, any>) => void; disabled?: boolean; }
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
function parseRetencoes(raw: unknown): RetencaoNfse[] {
  if (Array.isArray(raw)) return raw as RetencaoNfse[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function NfseFieldsSection({ form, setForm, disabled }: Props) {
  const ledgerCarregado = useRef<string>("");
  const retencoes = useMemo(() => parseRetencoes(form.nfse_retencoes_json), [form.nfse_retencoes_json]);
  const calculo = useMemo(() => calcularNfse({
    valorServicos: num(form.nfse_valor_servicos), valorDeducoes: num(form.nfse_valor_deducoes),
    aliquotaIss: form.nfse_aliquota_iss == null ? null : num(form.nfse_aliquota_iss), retencoes,
  }), [form.nfse_valor_servicos, form.nfse_valor_deducoes, form.nfse_aliquota_iss, retencoes]);
  const importada = form.origem === "xml_importado" || !!form.nfse_layout_origem;
  const issInformado = form.nfse_valor_iss_informado == null ? (importada ? form.nfse_valor_iss : null) : form.nfse_valor_iss_informado;
  const divergenciaIss = divergenciaValor(issInformado == null ? null : num(issInformado), calculo.valorIssCalculado);
  const problemas = validarNfse({
    valorServicos: num(form.nfse_valor_servicos), valorDeducoes: num(form.nfse_valor_deducoes),
    aliquotaIss: form.nfse_aliquota_iss == null ? null : num(form.nfse_aliquota_iss), retencoes,
    valorIssInformado: issInformado == null ? null : num(issInformado),
  });

  useEffect(() => {
    const documentoId = String(form.documento_id || "");
    if (!documentoId || ledgerCarregado.current === documentoId) return;
    ledgerCarregado.current = documentoId;
    let ativo = true;
    void listarRetencoesNfse(documentoId)
      .then((rows) => {
        if (ativo) setForm({ ...form, nfse_retencoes_json: JSON.stringify(rows) });
      })
      .catch(() => { ledgerCarregado.current = ""; });
    return () => { ativo = false; };
    // O ID é estável durante a edição; evita recarregar e sobrescrever alterações locais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.documento_id]);

  // Sincroniza sempre base + valor calculado; mudança isolada da alíquota também entra aqui.
  useEffect(() => {
    const nextBase = calculo.baseCalculo;
    const nextCalc = calculo.valorIssCalculado;
    const nextIss = importada && issInformado != null ? num(issInformado) : nextCalc;
    if (num(form.nfse_valor_base_calculo_iss) !== nextBase || num(form.nfse_valor_iss_calculado) !== nextCalc || num(form.nfse_valor_iss) !== nextIss) {
      setForm({ ...form, nfse_valor_base_calculo_iss: nextBase, nfse_valor_iss_calculado: nextCalc, nfse_valor_iss: nextIss });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculo.baseCalculo, calculo.valorIssCalculado, importada, issInformado]);

  const setRetencoes = (rows: RetencaoNfse[]) => setForm({ ...form, nfse_retencoes_json: JSON.stringify(rows) });
  const updateRet = (idx: number, patch: Partial<RetencaoNfse>) => setRetencoes(retencoes.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const addRetencao = () => setRetencoes([...retencoes, { tributo: "ISS", base_calculo: calculo.baseCalculo, aliquota: form.nfse_aliquota_iss == null ? null : num(form.nfse_aliquota_iss), valor: 0, retido: true, reduz_valor_fornecedor: true, responsavel_recolhimento: "empresa", status: "rascunho", origem: "manual" }]);

  const toggleIssRetido = (checked: boolean) => {
    const idx = retencoes.findIndex((r) => r.tributo === "ISS" && (r.status ?? "rascunho") !== "estornada");
    const rows = [...retencoes];
    if (checked && idx < 0) rows.push({ tributo: "ISS", base_calculo: calculo.baseCalculo, aliquota: form.nfse_aliquota_iss == null ? null : num(form.nfse_aliquota_iss), valor: importada && issInformado != null ? num(issInformado) : calculo.valorIssCalculado, retido: true, reduz_valor_fornecedor: true, responsavel_recolhimento: "empresa", status: "rascunho", origem: importada ? "xml" : "manual" });
    if (idx >= 0) rows[idx] = { ...rows[idx], retido: checked, reduz_valor_fornecedor: checked, responsavel_recolhimento: checked ? "empresa" : "fornecedor" };
    setForm({ ...form, nfse_iss_retido: checked, nfse_retencoes_json: JSON.stringify(rows) });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-accent/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" /><h3 className="font-semibold text-sm">NFS-e</h3>
        {importada && <Badge variant="secondary">Importada · {String(form.nfse_layout_origem || "XML")}{form.nfse_versao_layout ? ` ${form.nfse_versao_layout}` : ""}</Badge>}
        {form.nfse_iss_retido && <Badge variant="outline" className="ml-auto">ISS retido</Badge>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg bg-background p-3 border">
        <div><p className="text-[11px] text-muted-foreground">Serviço bruto</p><p className="font-semibold">{formatCurrency(calculo.valorBruto)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Retenções</p><p className="font-semibold">{formatCurrency(calculo.totalRetencoesFornecedor)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Líquido fornecedor</p><p className="font-semibold text-primary">{formatCurrency(calculo.liquidoFornecedor)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">ISS calculado</p><p className="font-semibold">{formatCurrency(calculo.valorIssCalculado)}</p></div>
      </div>

      {divergenciaIss.divergente && <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0"/><span>ISS do documento ({formatCurrency(num(issInformado))}) diverge do cálculo do ERP ({formatCurrency(calculo.valorIssCalculado)}). O valor importado foi preservado.</span></div>}
      {problemas.filter((p) => p.severidade === "erro").map((p) => <p key={`${p.campo}-${p.mensagem}`} className="text-xs text-destructive">{p.mensagem}</p>)}

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span className="flex items-center gap-2"><Calculator className="h-3.5 w-3.5"/>Valores e ISS</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
        <CollapsibleContent className="pt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Valor dos serviços (R$)</Label><Input type="number" min={0} step="0.01" value={form.nfse_valor_servicos ?? ""} onChange={(e)=>setForm({...form,nfse_valor_servicos:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/></div>
          <div className="space-y-1"><Label>Deduções (R$)</Label><Input type="number" min={0} step="0.01" value={form.nfse_valor_deducoes ?? 0} onChange={(e)=>setForm({...form,nfse_valor_deducoes:Number(e.target.value||0)})} disabled={disabled}/></div>
          <div className="space-y-1"><Label>Base ISS (R$)</Label><Input value={calculo.baseCalculo.toFixed(2)} readOnly className="bg-muted/50 font-mono"/></div>
          <div className="space-y-1"><Label>Alíquota ISS (%)</Label><Input type="number" min={0} max={100} step="0.01" value={decimalParaPercentual(form.nfse_aliquota_iss == null ? null : num(form.nfse_aliquota_iss)) ?? ""} onChange={(e)=>setForm({...form,nfse_aliquota_iss:percentualParaDecimal(e.target.value)})} disabled={disabled} placeholder="5,00"/></div>
          <div className="space-y-1"><Label>{importada ? "ISS informado (R$)" : "ISS calculado (R$)"}</Label><Input value={(importada && issInformado != null ? num(issInformado) : calculo.valorIssCalculado).toFixed(2)} readOnly className="bg-muted/50 font-mono"/></div>
          <div className="rounded-md border bg-background p-2 flex items-center justify-between gap-2"><div><p className="text-xs font-medium">ISS retido</p><p className="text-[10px] text-muted-foreground">Reduz o líquido do prestador.</p></div><Switch checked={!!form.nfse_iss_retido} onCheckedChange={toggleIssRetido} disabled={disabled}/></div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen={retencoes.length > 0}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span>Retenções ({retencoes.length})</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2">
          {retencoes.map((r, idx) => <div key={`${r.id ?? r.tributo}-${idx}`} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end rounded-md border bg-background p-2">
            <div><Label>Tributo</Label><Select value={r.tributo} onValueChange={(v)=>updateRet(idx,{tributo:v as NfseTributo})} disabled={disabled || r.status === "confirmada"}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TRIBUTOS_NFSE.map((t)=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Base</Label><Input type="number" step="0.01" min={0} value={r.base_calculo} onChange={(e)=>updateRet(idx,{base_calculo:Number(e.target.value||0)})} disabled={disabled}/></div>
            <div><Label>Alíquota %</Label><Input type="number" step="0.01" min={0} value={decimalParaPercentual(r.aliquota) ?? ""} onChange={(e)=>updateRet(idx,{aliquota:percentualParaDecimal(e.target.value)})} disabled={disabled}/></div>
            <div><Label>Valor</Label><Input type="number" step="0.01" min={0} value={r.valor} onChange={(e)=>updateRet(idx,{valor:Number(e.target.value||0)})} disabled={disabled}/></div>
            <div><Label>Recolhimento</Label><Select value={r.responsavel_recolhimento} onValueChange={(v)=>updateRet(idx,{responsavel_recolhimento:v as RetencaoNfse["responsavel_recolhimento"]})} disabled={disabled}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="empresa">Empresa</SelectItem><SelectItem value="fornecedor">Prestador</SelectItem><SelectItem value="terceiro">Terceiro</SelectItem><SelectItem value="nao_aplicavel">N/A</SelectItem></SelectContent></Select></div>
            <Button type="button" size="icon" variant="ghost" onClick={()=>setRetencoes(retencoes.filter((_x,i)=>i!==idx))} disabled={disabled || r.status === "confirmada"}><X className="h-4 w-4"/></Button>
          </div>)}
          <Button type="button" variant="outline" size="sm" onClick={addRetencao} disabled={disabled}><Plus className="h-4 w-4 mr-1"/>Adicionar retenção</Button>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5"/>Detalhes fiscais</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Município de prestação</Label><Input value={form.nfse_municipio_prestacao ?? ""} onChange={(e)=>setForm({...form,nfse_municipio_prestacao:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1"><Label>Código LC 116</Label><Input value={form.nfse_codigo_servico_lc116 ?? ""} onChange={(e)=>setForm({...form,nfse_codigo_servico_lc116:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1"><Label>NBS</Label><Input value={form.nfse_nbs ?? ""} onChange={(e)=>setForm({...form,nfse_nbs:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1"><Label>Número RPS</Label><Input value={form.nfse_numero_rps ?? ""} onChange={(e)=>setForm({...form,nfse_numero_rps:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1"><Label>Série RPS</Label><Input value={form.nfse_serie_rps ?? ""} onChange={(e)=>setForm({...form,nfse_serie_rps:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1"><Label>Competência</Label><Input type="date" value={form.nfse_data_competencia ?? ""} onChange={(e)=>setForm({...form,nfse_data_competencia:e.target.value})} disabled={disabled}/></div>
            <div className="space-y-1 md:col-span-3"><Label>Natureza da operação</Label><Select value={form.nfse_natureza_operacao ? String(form.nfse_natureza_operacao) : ""} onValueChange={(v)=>setForm({...form,nfse_natureza_operacao:Number(v)})} disabled={disabled}><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{NATUREZA_OPTIONS.map((o)=><SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1 md:col-span-3"><Label>Descrição do serviço</Label><Input value={form.nfse_descricao_servico ?? ""} onChange={(e)=>setForm({...form,nfse_descricao_servico:e.target.value})} disabled={disabled}/></div>
          </div>
          <div className="flex flex-wrap gap-5"><div className="flex items-center gap-2"><Checkbox id="nfse-simples" checked={!!form.nfse_optante_simples} onCheckedChange={(v)=>setForm({...form,nfse_optante_simples:!!v})} disabled={disabled}/><Label htmlFor="nfse-simples">Simples Nacional</Label></div><div className="flex items-center gap-2"><Checkbox id="nfse-cultural" checked={!!form.nfse_incentivador_cultural} onCheckedChange={(v)=>setForm({...form,nfse_incentivador_cultural:!!v})} disabled={disabled}/><Label htmlFor="nfse-cultural">Incentivador cultural</Label></div></div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
