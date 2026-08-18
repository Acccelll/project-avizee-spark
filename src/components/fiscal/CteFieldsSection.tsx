import { useEffect, useMemo, useState } from "react";
import { Truck, MapPin, Users, PackageSearch, DollarSign, Plus, X, ChevronDown, CircleCheck, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UF_OPTIONS } from "@/constants/brasil";
import { formatCurrency } from "@/lib/format";

const TIPO_OPTIONS=[{value:"normal",label:"Normal"},{value:"complemento_valores",label:"Complemento de valores"},{value:"anulacao",label:"Anulação"},{value:"substituto",label:"Substituto"}];
const MODAL_OPTIONS=[{value:"rodoviario",label:"Rodoviário"},{value:"aereo",label:"Aéreo"},{value:"aquaviario",label:"Aquaviário"},{value:"ferroviario",label:"Ferroviário"},{value:"dutoviario",label:"Dutoviário"},{value:"multimodal",label:"Multimodal"}];
const TOMADOR_OPTIONS=[{value:0,label:"Remetente"},{value:1,label:"Expedidor"},{value:2,label:"Recebedor"},{value:3,label:"Destinatário"},{value:4,label:"Outros"}];
interface Props { form:Record<string,any>; setForm:(f:Record<string,any>)=>void; disabled?:boolean; }
interface RefResumo { chave?:string; status?:"localizada"|"nao_localizada"|"divergente"; nfe_id?:string|null; numero?:string|null; valor_total?:number|null; }
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
function parseRefs(v:unknown):RefResumo[]{if(typeof v!=="string"||!v)return[];try{const p=JSON.parse(v);return Array.isArray(p)?p:[]}catch{return[];}}

export function CteFieldsSection({form,setForm,disabled}:Props){
  const [chaveInput,setChaveInput]=useState("");
  const chaves:string[]=Array.isArray(form.cte_chave_nfe_ref)?form.cte_chave_nfe_ref:[];
  const refs=useMemo(()=>parseRefs(form.cte_referencias_json),[form.cte_referencias_json]);
  const localizadas=refs.filter((r)=>r.status==="localizada").length;
  const pendentes=refs.filter((r)=>r.status!=="localizada").length;
  const tomador=form.cte_tomador_tipo;
  useEffect(()=>{if(!form.cte_modal)setForm({...form,cte_modal:"rodoviario"});/* eslint-disable-next-line react-hooks/exhaustive-deps */},[]);
  const addChave=()=>{const v=chaveInput.replace(/\D/g,"");if(v.length!==44)return;if(!chaves.includes(v))setForm({...form,cte_chave_nfe_ref:[...chaves,v]});setChaveInput("");};
  const removeChave=(k:string)=>setForm({...form,cte_chave_nfe_ref:chaves.filter((c)=>c!==k)});
  const participante=(prefix:string,label:string,comUf=true)=><div className="space-y-2"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p><div className="grid grid-cols-1 md:grid-cols-4 gap-2"><Input placeholder="CNPJ/CPF" value={form[`${prefix}_doc`]??""} onChange={(e)=>setForm({...form,[`${prefix}_doc`]:e.target.value})} disabled={disabled}/><Input className="md:col-span-2" placeholder="Razão social" value={form[`${prefix}_razao_social`]??""} onChange={(e)=>setForm({...form,[`${prefix}_razao_social`]:e.target.value})} disabled={disabled}/>{comUf&&<Select value={form[`${prefix}_uf`]??""} onValueChange={(v)=>setForm({...form,[`${prefix}_uf`]:v})} disabled={disabled}><SelectTrigger><SelectValue placeholder="UF"/></SelectTrigger><SelectContent>{UF_OPTIONS.map((u)=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>}</div></div>;

  return <div className="space-y-4 rounded-lg border bg-accent/20 p-4">
    <div className="flex flex-wrap items-center gap-2"><Truck className="h-4 w-4 text-primary"/><h3 className="font-semibold text-sm">{form.tipo_documento==="cte_os"?"CT-e OS":"CT-e"}</h3>{form.origem==="xml_importado"&&<Badge variant="secondary">Importado de XML</Badge>}{chaves.length>0&&<Badge variant={pendentes?"outline":"secondary"} className="ml-auto">{localizadas}/{refs.length||chaves.length} NF-e localizadas</Badge>}</div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border bg-background p-3">
      <div><p className="text-[11px] text-muted-foreground">Valor do serviço</p><p className="font-semibold">{formatCurrency(num(form.cte_valor_prestacao||form.valor_total))}</p></div>
      <div><p className="text-[11px] text-muted-foreground">{form.tipo==="entrada"?"Líquido a pagar":"Valor a receber"}</p><p className="font-semibold text-primary">{formatCurrency(num(form.cte_valor_receber||form.cte_valor_prestacao))}</p></div>
      <div><p className="text-[11px] text-muted-foreground">Percurso</p><p className="font-medium text-sm">{form.cte_municipio_inicio||"—"}/{form.cte_municipio_inicio_uf||"—"} → {form.cte_municipio_fim||"—"}/{form.cte_municipio_fim_uf||"—"}</p></div>
      <div><p className="text-[11px] text-muted-foreground">Modal</p><p className="font-medium capitalize">{String(form.cte_modal||"—")}</p></div>
    </div>

    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span className="flex items-center gap-2"><PackageSearch className="h-3.5 w-3.5"/>NF-e transportadas ({chaves.length})</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-2">
        {refs.length>0&&refs.map((r)=><div key={r.chave} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs"><div className="flex items-center gap-2">{r.status==="localizada"?<CircleCheck className="h-4 w-4 text-success"/>:<AlertTriangle className="h-4 w-4 text-amber-600"/>}<div><p className="font-mono">{r.chave}</p><p className="text-muted-foreground">{r.status==="localizada"?`NF ${r.numero||"—"}${r.valor_total!=null?` · ${formatCurrency(Number(r.valor_total))}`:""}`:"Ainda não localizada no ERP — rateio ficará pendente"}</p></div></div></div>)}
        <div className="flex gap-2"><Input value={chaveInput} onChange={(e)=>setChaveInput(e.target.value.replace(/\D/g,"").slice(0,44))} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();addChave();}}} placeholder="Chave NF-e (44 dígitos)" disabled={disabled} className="font-mono"/><Button type="button" variant="outline" size="icon" onClick={addChave} disabled={disabled||chaveInput.length!==44}><Plus className="h-4 w-4"/></Button></div>
        {chaves.map((k)=>!refs.some((r)=>r.chave===k)&&<div key={k} className="flex items-center gap-2"><Badge variant="outline" className="font-mono font-normal">{k}</Badge><Button type="button" size="icon" variant="ghost" onClick={()=>removeChave(k)} disabled={disabled}><X className="h-3.5 w-3.5"/></Button></div>)}
      </CollapsibleContent>
    </Collapsible>

    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5"/>Valores</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
      <CollapsibleContent className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3"><div className="space-y-1"><Label>Valor da prestação (R$)</Label><Input type="number" min={0} step="0.01" value={form.cte_valor_prestacao??""} onChange={(e)=>setForm({...form,cte_valor_prestacao:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/></div><div className="space-y-1"><Label>{form.tipo==="entrada"?"Líquido a pagar (R$)":"Valor a receber (R$)"}</Label><Input type="number" min={0} step="0.01" value={form.cte_valor_receber??""} onChange={(e)=>setForm({...form,cte_valor_receber:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/></div></CollapsibleContent>
    </Collapsible>

    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"><span>Detalhes fiscais</span><ChevronDown className="h-4 w-4"/></CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div><Label>Tipo CT-e</Label><Select value={form.cte_tipo??"normal"} onValueChange={(v)=>setForm({...form,cte_tipo:v})} disabled={disabled}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIPO_OPTIONS.map((o)=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Modal</Label><Select value={form.cte_modal||"rodoviario"} onValueChange={(v)=>setForm({...form,cte_modal:v})} disabled={disabled}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MODAL_OPTIONS.map((o)=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div><Label>CFOP</Label><Input value={form.cte_cfop??""} onChange={(e)=>setForm({...form,cte_cfop:e.target.value})} disabled={disabled}/></div><div><Label>CST ICMS</Label><Input value={form.cte_icms_cst??""} onChange={(e)=>setForm({...form,cte_icms_cst:e.target.value})} disabled={disabled}/></div><div><Label>Base ICMS</Label><Input type="number" step="0.01" value={form.cte_icms_base??""} onChange={(e)=>setForm({...form,cte_icms_base:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/></div><div><Label>Alíquota ICMS (%)</Label><Input type="number" step="0.01" value={form.cte_icms_aliquota==null?"":num(form.cte_icms_aliquota)*100} onChange={(e)=>setForm({...form,cte_icms_aliquota:e.target.value===""?null:Number(e.target.value)/100})} disabled={disabled}/></div><div><Label>Valor ICMS</Label><Input type="number" step="0.01" value={form.cte_icms_valor??""} onChange={(e)=>setForm({...form,cte_icms_valor:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/></div><div className="md:col-span-4"><Label>Natureza da operação</Label><Input value={form.cte_natureza_operacao??""} onChange={(e)=>setForm({...form,cte_natureza_operacao:e.target.value})} disabled={disabled}/></div></div>

        <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4"/>Percurso</div><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><Input placeholder="Município início" value={form.cte_municipio_inicio??""} onChange={(e)=>setForm({...form,cte_municipio_inicio:e.target.value})} disabled={disabled}/><Select value={form.cte_municipio_inicio_uf??""} onValueChange={(v)=>setForm({...form,cte_municipio_inicio_uf:v})} disabled={disabled}><SelectTrigger><SelectValue placeholder="UF"/></SelectTrigger><SelectContent>{UF_OPTIONS.map((u)=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select><Input placeholder="Município fim" value={form.cte_municipio_fim??""} onChange={(e)=>setForm({...form,cte_municipio_fim:e.target.value})} disabled={disabled}/><Select value={form.cte_municipio_fim_uf??""} onValueChange={(v)=>setForm({...form,cte_municipio_fim_uf:v})} disabled={disabled}><SelectTrigger><SelectValue placeholder="UF"/></SelectTrigger><SelectContent>{UF_OPTIONS.map((u)=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div></div>

        <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4"/>Tomador e participantes</div><div><Label>Quem paga o frete</Label><Select value={tomador!=null?String(tomador):""} onValueChange={(v)=>setForm({...form,cte_tomador_tipo:Number(v)})} disabled={disabled}><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{TOMADOR_OPTIONS.map((o)=><SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent></Select></div>{tomador===4&&<div className="grid grid-cols-1 md:grid-cols-2 gap-2"><Input placeholder="CNPJ/CPF do tomador" value={form.cte_tomador_outros_doc??""} onChange={(e)=>setForm({...form,cte_tomador_outros_doc:e.target.value})} disabled={disabled}/><Input placeholder="Razão social do tomador" value={form.cte_tomador_outros_razao_social??""} onChange={(e)=>setForm({...form,cte_tomador_outros_razao_social:e.target.value})} disabled={disabled}/></div>}{participante("cte_remetente","Remetente")}{participante("cte_destinatario","Destinatário")}{participante("cte_expedidor","Expedidor",false)}{participante("cte_recebedor","Recebedor",false)}</div>

        <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-medium"><PackageSearch className="h-4 w-4"/>Carga</div><div className="grid grid-cols-1 md:grid-cols-3 gap-2"><Input placeholder="Produto predominante" value={form.cte_produto_predominante??""} onChange={(e)=>setForm({...form,cte_produto_predominante:e.target.value})} disabled={disabled}/><Input type="number" placeholder="Quantidade" value={form.cte_quantidade??""} onChange={(e)=>setForm({...form,cte_quantidade:e.target.value===""?null:Number(e.target.value)})} disabled={disabled}/><Input placeholder="Unidade" value={form.cte_unidade_medida??""} onChange={(e)=>setForm({...form,cte_unidade_medida:e.target.value})} disabled={disabled}/></div></div>
      </CollapsibleContent>
    </Collapsible>
  </div>;
}
