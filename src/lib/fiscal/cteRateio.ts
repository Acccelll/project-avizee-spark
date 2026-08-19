export type StatusVinculoReferencia="localizada"|"nao_localizada"|"divergente";
export interface ReferenciaCteRateio { nfeChave:string; nfeId:string|null; statusVinculo:StatusVinculoReferencia; valorBaseNfe:number|null; }
export interface LinhaRateio { nfeChave:string; nfeId:string|null; percentualRateio:number; valorRateado:number; status:"aplicado"|"pendente"; }
export interface ResultadoRateio { valorTotalRateio:number; baseTotal:number; podeAplicar:boolean; linhas:LinhaRateio[]; valorAplicado:number; valorPendente:number; }
const r2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
/** Política fail-closed: basta uma referência não resolvida para nenhum rateio ser aplicado. */
export function calcularRateioCte(valor:number,refs:ReferenciaCteRateio[]):ResultadoRateio {
  const total=Math.max(0,Number(valor)||0); const base=refs.reduce((s,r)=>s+Math.max(0,Number(r.valorBaseNfe)||0),0); const pode=refs.length>0&&refs.every((r)=>r.nfeId&&r.statusVinculo==="localizada"&&Number(r.valorBaseNfe)>0)&&base>0;
  let acum=0; const linhas=refs.map((r,i)=>{ const pct=base>0?(Math.max(0,Number(r.valorBaseNfe)||0)/base):(refs.length?1/refs.length:0); const vr=i===refs.length-1?r2(total-acum):r2(total*pct); if(i<refs.length-1)acum+=vr; return{nfeChave:r.nfeChave,nfeId:r.nfeId,percentualRateio:+pct.toFixed(10),valorRateado:vr,status:pode?"aplicado" as const:"pendente" as const}; });
  return{valorTotalRateio:total,baseTotal:r2(base),podeAplicar:pode,linhas,valorAplicado:pode?total:0,valorPendente:pode?0:total};
}
export function resumirVinculos(refs:ReferenciaCteRateio[]){return{total:refs.length,localizadas:refs.filter(r=>r.statusVinculo==="localizada").length,naoLocalizadas:refs.filter(r=>r.statusVinculo==="nao_localizada").length,divergentes:refs.filter(r=>r.statusVinculo==="divergente").length};}
