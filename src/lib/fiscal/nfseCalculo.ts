export type NfseTributo="ISS"|"INSS"|"IRRF"|"PIS"|"COFINS"|"CSLL"|"IBS"|"CBS"|"OUTRO";
export type ResponsavelRecolhimento="empresa"|"fornecedor"|"terceiro"|"nao_aplicavel";
export type StatusRetencao="rascunho"|"confirmada"|"estornada"|"cancelada";
export interface RetencaoNfse { id?:string; tributo:NfseTributo; base_calculo:number; aliquota:number|null; valor:number; retido:boolean; reduz_valor_fornecedor:boolean; responsavel_recolhimento:ResponsavelRecolhimento; vencimento?:string|null; status?:StatusRetencao; origem?:string; }
export interface EntradaCalculoNfse { valorServicos:number|null|undefined; valorDeducoes?:number|null; aliquotaIss?:number|null; retencoes?:RetencaoNfse[]; }
export interface ResultadoCalculoNfse { valorServicos:number; valorDeducoes:number; baseCalculo:number; aliquotaIss:number; valorIssCalculado:number; valorBruto:number; totalRetencoesFornecedor:number; totalObrigacoesEmpresa:number; liquidoFornecedor:number; }
export interface ProblemaValidacao { campo:string; severidade:"erro"|"aviso"; mensagem:string; }
export const TRIBUTOS_NFSE:NfseTributo[]=["ISS","INSS","IRRF","PIS","COFINS","CSLL","IBS","CBS"];
const n=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0; const r2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const operacional=(r:RetencaoNfse)=>(r.status??"rascunho") === "rascunho" || r.status === "confirmada";
export function calcularNfse(e:EntradaCalculoNfse):ResultadoCalculoNfse {
  const serv=Math.max(0,n(e.valorServicos)); const ded=Math.max(0,n(e.valorDeducoes)); const base=r2(Math.max(0,serv-ded)); const aliq=Math.max(0,n(e.aliquotaIss));
  const ativos=(e.retencoes??[]).filter(operacional); const red=r2(ativos.filter((x)=>x.retido&&x.reduz_valor_fornecedor).reduce((s,x)=>s+n(x.valor),0)); const obrig=r2(ativos.filter((x)=>x.retido&&x.responsavel_recolhimento === "empresa").reduce((s,x)=>s+n(x.valor),0));
  return { valorServicos:serv, valorDeducoes:ded, baseCalculo:base, aliquotaIss:aliq, valorIssCalculado:r2(base*aliq), valorBruto:serv, totalRetencoesFornecedor:red, totalObrigacoesEmpresa:obrig, liquidoFornecedor:r2(Math.max(0,serv-red)) };
}
export function validarNfse(e:EntradaCalculoNfse & {valorIssInformado?:number|null}):ProblemaValidacao[] {
  const p:ProblemaValidacao[]=[]; const serv=n(e.valorServicos),ded=n(e.valorDeducoes),aliq=e.aliquotaIss;
  if(serv<0)p.push({campo:"nfse_valor_servicos",severidade:"erro",mensagem:"Valor dos serviços não pode ser negativo."});
  if(ded<0||ded>serv)p.push({campo:"nfse_valor_deducoes",severidade:"erro",mensagem:"Deduções devem estar entre zero e o valor dos serviços."});
  if(aliq!==null&&aliq!==undefined&&(n(aliq)<0||n(aliq)>1))p.push({campo:"nfse_aliquota_iss",severidade:"erro",mensagem:"Alíquota deve estar entre 0% e 100%."});
  for(const x of e.retencoes??[])if(n(x.valor)<0)p.push({campo:`retencao_${x.tributo}`,severidade:"erro",mensagem:`Retenção ${x.tributo} não pode ser negativa.`});
  const calc=calcularNfse(e); if(calc.totalRetencoesFornecedor>calc.valorBruto)p.push({campo:"retencoes",severidade:"erro",mensagem:"Retenções não podem superar o valor bruto."});
  if(e.valorIssInformado!==null&&e.valorIssInformado!==undefined&&Math.abs(n(e.valorIssInformado)-calc.valorIssCalculado)>0.02)p.push({campo:"nfse_valor_iss",severidade:"aviso",mensagem:`ISS informado (R$ ${n(e.valorIssInformado).toFixed(2)}) diverge do calculado (R$ ${calc.valorIssCalculado.toFixed(2)}).`});
  return p;
}
export function divergenciaValor(informado:number|null|undefined,calculado:number,tolerancia=.02){ if(informado===null||informado===undefined)return{divergente:false,diferenca:0}; const d=r2(Number(informado)-calculado); return{divergente:Math.abs(d)>tolerancia,diferenca:d}; }
