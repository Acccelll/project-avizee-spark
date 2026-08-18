import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { gunzipSync } from "https://esm.sh/fflate@0.8.2";
import { buildCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string,string> = buildCorsHeaders(null);
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const enabled=()=>["true","1","yes","sim"].includes((Deno.env.get("CTE_DISTDFE_ENABLED")??"").trim().toLowerCase());
const endpoint=(amb:"1"|"2")=>amb==="2"?"https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx":"https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx";

function tag(xml:string,name:string):string|null{const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));return m?.[1]?.trim()??null;}
function montarMensagem(cnpj:string,amb:"1"|"2",ultNSU:string){return `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>${amb}</tpAmb><cUFAutor>91</cUFAutor><CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>${String(ultNSU||"0").padStart(15,"0")}</ultNSU></distNSU></distDFeInt>`;}
function soapEnvelope(mensagem:string){return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe"><cteDadosMsg>${mensagem}</cteDadosMsg></cteDistDFeInteresse></soap12:Body></soap12:Envelope>`;}
function parseDocs(xmlSoap:string){
  const ret=tag(xmlSoap,"retDistDFeInt")??xmlSoap; const docs:Array<{nsu:string;schema:string;xml:string;chave?:string;resumo:Record<string,unknown>}> = [];
  const re=/<docZip\s+([^>]+)>([\s\S]*?)<\/docZip>/g; let m:RegExpExecArray|null;
  while((m=re.exec(ret))!==null){
    const nsu=m[1].match(/NSU="(\d+)"/)?.[1]??""; const schema=m[1].match(/schema="([^"]+)"/)?.[1]??"";
    try{
      const bin=Uint8Array.from(atob(m[2].trim()),c=>c.charCodeAt(0)); const xml=new TextDecoder("utf-8").decode(gunzipSync(bin));
      const chave=(xml.match(/Id="CTe(\d{44})"/i)||xml.match(/<chCTe>(\d{44})<\/chCTe>/i))?.[1];
      docs.push({nsu,schema,xml,chave,resumo:{cnpjEmitente:tag(xml,"CNPJ")??undefined,nomeEmitente:tag(xml,"xNome")??undefined,valorTotal:Number(tag(xml,"vTPrest")??0)||undefined,dataEmissao:tag(xml,"dhEmi")??undefined,numero:tag(xml,"nCT")??undefined,serie:tag(xml,"serie")??undefined}});
    }catch{/* doc inválido é ignorado; cursor ainda vem da resposta oficial */}
  }
  return {cStat:tag(ret,"cStat")??"",xMotivo:tag(ret,"xMotivo")??"",ultNSU:tag(ret,"ultNSU")??"0",maxNSU:tag(ret,"maxNSU")??"0",docs};
}

Deno.serve(async(req)=>{
  corsHeaders=buildCorsHeaders(req.headers.get("origin"));
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const auth=req.headers.get("Authorization")??""; if(!auth)return json({sucesso:false,erro:"Não autenticado"},401);
    const body=await req.json().catch(()=>({})); const action=body.action??"consultar-nsu";
    const pUrl=Deno.env.get("SEFAZ_MTLS_PROXY_URL")?.trim()||""; const pSecret=Deno.env.get("SEFAZ_MTLS_PROXY_SECRET")?.trim()||"";
    if(action==="status")return json({sucesso:true,enabled:enabled(),configured:enabled()&&!!pUrl&&!!pSecret,hasProxyUrl:!!pUrl,hasProxySecret:!!pSecret,endpointProducao:endpoint("1"),endpointHomologacao:endpoint("2"),observacao:"CT-e usa cursor próprio e permanece desligado até CTE_DISTDFE_ENABLED=true."});
    if(!enabled())return json({sucesso:false,disabled:true,erro:"Distribuição automática de CT-e desativada por feature flag."},200);
    if(!pUrl||!pSecret)return json({sucesso:false,erro:"Proxy mTLS não configurado."},200);
    if(action!=="consultar-nsu")return json({sucesso:false,erro:"Ação inválida."},400);

    const supabaseUrl=Deno.env.get("SUPABASE_URL")!; const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient=createClient(supabaseUrl,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:cfg,error:cfgErr}=await userClient.from("empresa_config").select("cnpj").limit(1).maybeSingle();
    if(cfgErr)throw cfgErr; const cnpj=String(cfg?.cnpj??"").replace(/\D/g,""); if(cnpj.length!==14)return json({sucesso:false,erro:"CNPJ da empresa não configurado."},200);
    const ambiente: "1"|"2"=body.ambiente==="2"?"2":"1"; const ultNSU=String(body.ultNSU??"0").replace(/\D/g,"");
    const mensagem=montarMensagem(cnpj,ambiente,ultNSU); const envelope=soapEnvelope(mensagem);
    const soapAction=Deno.env.get("CTE_DISTDFE_SOAP_ACTION")?.trim()||"";
    const headers:Record<string,string>={"x-proxy-secret":pSecret,"x-target-url":endpoint(ambiente),"Content-Type":soapAction?`application/soap+xml; charset=utf-8; action=\"${soapAction}\"`:"application/soap+xml; charset=utf-8"};
    if(soapAction)headers.soapaction=soapAction;
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),30_000);
    const resp=await fetch(pUrl,{method:"POST",headers,body:envelope,signal:ctrl.signal}); clearTimeout(timer);
    let txt=await resp.text(); let upstream=resp.status;
    if(txt.trimStart().startsWith("{")){try{const w=JSON.parse(txt);if(typeof w.status==="number")upstream=w.status;if(typeof w.body==="string")txt=w.body;}catch{/* raw */}}
    if(upstream>=500||upstream===401)return json({sucesso:false,erro:`Falha de transporte CT-e (HTTP ${upstream}).`},200);
    const parsed=parseDocs(txt); return json({sucesso:true,cnpj,ambiente,...parsed});
  }catch(e){return json({sucesso:false,erro:e instanceof Error?e.message:String(e)},500);}
});
