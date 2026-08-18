import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { interpretarDocumentoServicoXml } from "@/pages/fiscal/hooks/documentoServicoXml";
import { uploadFiscalXml } from "@/services/fiscal/xmlStorage.service";
import { fromUntyped } from "@/lib/supabase/fromUntyped";

export interface CteDistDfeDoc { nsu:string; schema:string; xml:string; chave?:string; resumo?:Record<string,unknown>; }
export interface CteDistDfeResponse { sucesso:boolean; disabled?:boolean; ambiente?:"1"|"2"; cStat?:string; xMotivo?:string; ultNSU?:string; maxNSU?:string; docs?:CteDistDfeDoc[]; erro?:string; }
export interface CteDistDfeStatus { sucesso:boolean; enabled:boolean; configured:boolean; hasProxyUrl:boolean; hasProxySecret:boolean; observacao?:string; }
interface CteSyncRow { ultimo_nsu?:string; max_nsu?:string; bloqueado_ate?:string|null; }
interface CteInboxRow { id?:string; nota_fiscal_id?:string|null; status_processamento?:string; }

export async function obterStatusCteDistDFe():Promise<CteDistDfeStatus>{
  const {data,error}=await supabase.functions.invoke<CteDistDfeStatus>("cte-distdfe",{body:{action:"status"}});
  if(error)throw error; return data ?? {sucesso:false,enabled:false,configured:false,hasProxyUrl:false,hasProxySecret:false};
}

async function materializarDoc(doc:CteDistDfeDoc,ambiente:"1"|"2"):Promise<string|null>{
  if(!doc.chave||doc.chave.length!==44)return null;
  const {data:existente}=await supabase.from("notas_fiscais").select("id").eq("chave_acesso",doc.chave).limit(1).maybeSingle();
  if(existente?.id){
    await fromUntyped("cte_distribuicao").update({nota_fiscal_id:existente.id,status_processamento:"processado",updated_at:new Date().toISOString()}).eq("chave_acesso",doc.chave);
    return existente.id;
  }
  const {data:fornecedores}=await supabase.from("fornecedores").select("id,nome_razao_social,cpf_cnpj").limit(1000);
  const interpretado=interpretarDocumentoServicoXml(doc.xml,(fornecedores??[]) as never);
  if(!interpretado||!(["cte","cte_os"] as string[]).includes(interpretado.tipoDocumento))return null;
  const {path}=await uploadFiscalXml({chave:doc.chave,tipo:interpretado.tipoDocumento==="cte_os"?"cte-os":"cte",xmlText:doc.xml,dataEmissao:interpretado.dataEmissao});
  const payload={...interpretado.form,caminho_xml:path,origem:"sefaz_externa",status:"pendente",status_sefaz:"nao_enviada"};
  const {data:id,error}=await supabase.rpc("salvar_documento_fiscal_completo" as never,{p_nf_id:null,p_payload:payload as unknown as Json,p_itens:[] as unknown as Json} as never);
  if(error)throw error;
  const notaId=String(id||"");
  await fromUntyped("cte_distribuicao").upsert({nsu:doc.nsu,chave_acesso:doc.chave,schema_documento:doc.schema,xml_path:path,resumo:(doc.resumo??{}) as Json,status_processamento:"processado",nota_fiscal_id:notaId||null,ambiente,updated_at:new Date().toISOString()},{onConflict:"empresa_id,chave_acesso"});
  return notaId||null;
}

export async function sincronizarCteDistDFe(opcoes?:{ambiente?:"1"|"2";maxLotes?:number}):Promise<{novos:number;duplicados:number;ultNSU?:string;maxNSU?:string;cStat?:string;xMotivo?:string;disabled?:boolean;erro?:string}>{
  const ambiente=opcoes?.ambiente??"1";
  const {data:sync}=await fromUntyped<CteSyncRow>("cte_distdfe_sync").select("ultimo_nsu,max_nsu,bloqueado_ate").eq("ambiente",ambiente).limit(1).maybeSingle();
  const s=(sync??{}) as CteSyncRow;
  if(s.bloqueado_ate&&new Date(s.bloqueado_ate).getTime()>Date.now())return{novos:0,duplicados:0,erro:"Sincronização CT-e temporariamente bloqueada para evitar consumo indevido."};
  let cursor=s.ultimo_nsu??"0",novos=0,duplicados=0,lastMax=s.max_nsu;
  const max=Math.max(1,Math.min(opcoes?.maxLotes??10,20));
  for(let i=0;i<max;i++){
    const {data,error}=await supabase.functions.invoke<CteDistDfeResponse>("cte-distdfe",{body:{action:"consultar-nsu",ambiente,ultNSU:cursor}});
    if(error)return{novos,duplicados,ultNSU:cursor,maxNSU:lastMax,erro:error.message};
    if(!data?.sucesso)return{novos,duplicados,ultNSU:cursor,maxNSU:lastMax,disabled:data?.disabled,erro:data?.erro,cStat:data?.cStat,xMotivo:data?.xMotivo};
    if(data.cStat==="656"){
      const ate=new Date(Date.now()+60*60_000).toISOString();
      await fromUntyped("cte_distdfe_sync").upsert({ambiente,ultimo_nsu:cursor,max_nsu:data.maxNSU??lastMax??cursor,bloqueado_ate:ate,ultimo_cstat:data.cStat,ultimo_motivo:data.xMotivo,updated_at:new Date().toISOString()},{onConflict:"empresa_id,ambiente"});
      return{novos,duplicados,ultNSU:cursor,maxNSU:data.maxNSU,cStat:data.cStat,xMotivo:data.xMotivo,erro:"Consumo indevido: cursor preservado e circuit breaker ativado."};
    }
    for(const doc of data.docs??[]){
      if(!doc.chave)continue;
      const {data:row}=await fromUntyped<CteInboxRow>("cte_distribuicao").select("id,nota_fiscal_id").eq("chave_acesso",doc.chave).limit(1).maybeSingle();
      if(row){duplicados++;continue;}
      await fromUntyped("cte_distribuicao").insert({nsu:doc.nsu,chave_acesso:doc.chave,schema_documento:doc.schema,resumo:(doc.resumo??{}) as Json,status_processamento:"recebido",ambiente});
      try{await materializarDoc(doc,ambiente);novos++;}catch(e){await fromUntyped("cte_distribuicao").update({status_processamento:"erro",erro:e instanceof Error?e.message:String(e),updated_at:new Date().toISOString()}).eq("chave_acesso",doc.chave);}
    }
    cursor=data.ultNSU??cursor; lastMax=data.maxNSU??lastMax;
    await fromUntyped("cte_distdfe_sync").upsert({ambiente,ultimo_nsu:cursor,max_nsu:lastMax??cursor,ultima_sincronizacao:new Date().toISOString(),bloqueado_ate:null,ultimo_cstat:data.cStat,ultimo_motivo:data.xMotivo,updated_at:new Date().toISOString()},{onConflict:"empresa_id,ambiente"});
    if(!data.maxNSU||cursor===data.maxNSU||data.cStat==="137")break;
  }
  return{novos,duplicados,ultNSU:cursor,maxNSU:lastMax};
}

export async function resumoInboxCte(){
  const {data,error}=await fromUntyped<CteInboxRow>("cte_distribuicao").select("status_processamento"); if(error)throw error;
  const rows=(data??[]) as CteInboxRow[]; return rows.reduce((acc,r)=>{acc.total++;const k=r.status_processamento||"desconhecido";acc[k]=(acc[k]??0)+1;return acc;},{total:0} as Record<string,number>);
}
