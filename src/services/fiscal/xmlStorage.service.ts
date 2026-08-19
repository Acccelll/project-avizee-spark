/** Arquivamento idempotente dos XMLs fiscais no bucket `dbavizee`. */
import { supabase } from "@/integrations/supabase/client";
const BUCKET="dbavizee";
export type TipoXmlFiscal="nfe-entrada"|"nfe-saida"|"cte"|"cte-os"|"nfse";
function buildPath(input:{chave:string;tipo:TipoXmlFiscal;dataEmissao?:string|null}):string{
  const normalizada=(input.chave||"").replace(/[^a-zA-Z0-9_-]/g,"");
  const safe=normalizada||`sem-chave-${Date.now()}`; const ref=input.dataEmissao?new Date(input.dataEmissao):new Date(); const data=isNaN(ref.getTime())?new Date():ref;
  return `fiscal/${data.getFullYear()}/${String(data.getMonth()+1).padStart(2,"0")}/${input.tipo}/${safe}.xml`;
}
export async function uploadFiscalXml(input:{chave:string;tipo:TipoXmlFiscal;xmlText:string;dataEmissao?:string|null}):Promise<{path:string}>{
  const path=buildPath(input); const blob=new Blob([input.xmlText],{type:"application/xml"}); const {error}=await supabase.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:"application/xml",cacheControl:"3600"}); if(error)throw new Error(error.message); return{path};
}
/** Compatibilidade com o pipeline NF-e atual. */
export async function uploadNfeXml(input:{chave:string;tipo:"entrada"|"saida";xmlText:string;dataEmissao?:string|null}):Promise<{path:string}>{return uploadFiscalXml({...input,tipo:input.tipo==="entrada"?"nfe-entrada":"nfe-saida"});}
export async function getNfeXmlSignedUrl(path:string,expiresInSec=300):Promise<string>{const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,expiresInSec);if(error)throw new Error(error.message);return data.signedUrl;}
export async function downloadNfeXml(path:string):Promise<Blob>{const {data,error}=await supabase.storage.from(BUCKET).download(path);if(error)throw new Error(error.message);return data;}
export async function triggerDownloadNfeXml(input:{path:string;filename?:string}):Promise<void>{const blob=await downloadNfeXml(input.path);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=input.filename||input.path.split("/").pop()||"documento-fiscal.xml";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
