/**
 * DANFE em HTML inspirado no layout oficial da SEFAZ (modelo TOTVS).
 *
 * - Usado para PREVIEW na tela (dialog) — não há PDF embed nem print automático.
 * - O download usa `gerarDanfePdf` (vetor jsPDF) — este componente é apenas
 *   para a visualização HTML no dialog.
 *
 * Recebe um `DanfeInput` (mesmo contrato usado pelo módulo Fiscal) e renderiza
 * a estrutura completa: cabeçalho, destinatário, fatura, cálculo do imposto,
 * transportador, produtos, ISSQN e dados adicionais.
 */
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { DanfeInput } from "@/services/fiscal/danfe.service";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtQtd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0,000";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtChave(c?: string | null): string {
  if (!c) return "";
  return c.replace(/\D/g, "").match(/.{1,4}/g)?.join(" ") ?? c;
}
function fmtCnpj(v?: string | null): string {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
}
function fmtData(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
}
function fmtCep(v?: string | null): string {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return v;
}

const FRETE_LABEL: Record<string, string> = {
  "0": "0 - Emitente (CIF)",
  "1": "1 - Destinatário (FOB)",
  "2": "2 - Terceiros",
  "3": "3 - Próprio Remetente",
  "4": "4 - Próprio Destinatário",
  "9": "9 - Sem Frete",
};
const PAG_LABEL: Record<string, string> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão Crédito",
  "04": "Cartão Débito",
  "05": "Crédito Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "16": "Depósito Bancário",
  "17": "PIX",
  "18": "Transferência Bancária",
  "19": "Programa Fidelidade",
  "90": "Sem Pagamento",
  "99": "Outros",
};

export const DANFE_CONTAINER_ID = "danfe-render-root";

export function DanfeRender({ data, containerId = DANFE_CONTAINER_ID }: { data: DanfeInput; containerId?: string }) {
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!data.chave_acesso || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, data.chave_acesso.replace(/\D/g, ""), {
        format: "CODE128C",
        displayValue: false,
        margin: 0,
        height: 50,
        width: 1.6,
      });
    } catch {
      /* noop */
    }
  }, [data.chave_acesso]);

  const homologacao = data.ambiente_emissao === "homologacao" || data.ambiente_emissao === "2";
  const totalProdutos = data.itens.reduce((s, i) => s + (i.valor_total ?? i.quantidade * i.valor_unitario), 0);
  const valorProdutos = data.valor_produtos ?? totalProdutos;

  const cellTitle = "text-[7px] uppercase text-neutral-600 leading-tight";
  const cellValue = "text-[10px] font-semibold text-neutral-900 leading-tight";
  const cell = "border border-neutral-700 px-1.5 py-0.5 align-top";

  return (
    <div
      id={containerId}
      className="bg-white text-neutral-900 font-sans mx-auto"
      style={{ width: "210mm", padding: "6mm", boxSizing: "border-box" }}
    >
      {/* Recibo do destinatário */}
      <table className="w-full border-collapse mb-1" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td className={cell} colSpan={2}>
              <div className={cellTitle}>
                RECEBEMOS DE {data.emitente.razao_social?.toUpperCase()} OS PRODUTOS E SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
              </div>
            </td>
            <td className={cell} rowSpan={2} style={{ width: "30%" }}>
              <div className="text-center">
                <div className="text-[11px] font-bold">NF-e</div>
                <div className="text-[11px] font-semibold mt-1">Nº {data.numero}</div>
                <div className="text-[10px]">Série {data.serie ?? "1"}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td className={cell} style={{ width: "30%" }}>
              <div className={cellTitle}>DATA DE RECEBIMENTO</div>
              <div style={{ height: "14px" }} />
            </td>
            <td className={cell}>
              <div className={cellTitle}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
              <div style={{ height: "14px" }} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cabeçalho: emitente | DANFE | controle do fisco */}
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td className={cell} style={{ width: "40%" }} rowSpan={3}>
              <div className="text-[11px] font-bold leading-tight">
                {data.emitente.razao_social || "—"}
              </div>
              {data.emitente.nome_fantasia && (
                <div className="text-[9px] text-neutral-700">{data.emitente.nome_fantasia}</div>
              )}
              <div className="text-[9px] mt-1 leading-snug">
                {data.emitente.endereco || "—"}
                {data.emitente.cidade && <><br />{data.emitente.cidade}{data.emitente.uf ? ` - ${data.emitente.uf}` : ""}</>}
                {data.emitente.cep && <> · CEP {fmtCep(data.emitente.cep)}</>}
                {data.emitente.telefone && <><br />Fone: {data.emitente.telefone}</>}
              </div>
            </td>
            <td className={cell} style={{ width: "20%" }} rowSpan={3}>
              <div className="text-center">
                <div className="text-[14px] font-bold tracking-wide">DANFE</div>
                <div className="text-[8px] mt-0.5 leading-tight">
                  Documento Auxiliar da<br />Nota Fiscal Eletrônica
                </div>
                <div className="text-[9px] mt-2 text-left flex justify-around gap-2">
                  <span>0 - ENTRADA</span>
                  <span>1 - SAÍDA</span>
                </div>
                <div className="border border-neutral-700 inline-block px-2 py-0.5 text-[10px] font-bold mt-1">
                  {data.tipo === "entrada" ? "0" : "1"}
                </div>
                <div className="text-[10px] font-bold mt-1">Nº {data.numero}</div>
                <div className="text-[9px]">SÉRIE: {data.serie ?? "1"}</div>
                <div className="text-[8px]">PÁGINA 1 DE 1</div>
              </div>
            </td>
            <td className={cell} style={{ width: "40%" }}>
              <div className={cellTitle}>CONTROLE DO FISCO</div>
              {data.chave_acesso ? (
                <canvas ref={barcodeRef} className="w-full" style={{ height: "32px" }} />
              ) : (
                <div style={{ height: "32px" }} />
              )}
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={cellTitle}>CHAVE DE ACESSO</div>
              <div className="text-[9px] font-mono tracking-wider">{fmtChave(data.chave_acesso) || "—"}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className="text-[8px] leading-snug">
                Consulta de autenticidade no portal nacional da NF-e<br />
                www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
              </div>
            </td>
          </tr>

          <tr>
            <td className={cell} colSpan={2}>
              <div className={cellTitle}>NATUREZA DA OPERAÇÃO</div>
              <div className={cellValue}>{data.natureza_operacao || "—"}</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
              <div className={cellValue}>{data.protocolo_autorizacao || "—"}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={cellTitle}>INSCRIÇÃO ESTADUAL</div>
              <div className={cellValue}>{data.emitente.inscricao_estadual || "—"}</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>INSC. ESTADUAL DO SUBST. TRIB.</div>
              <div className={cellValue}>—</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>CNPJ</div>
              <div className={cellValue}>{fmtCnpj(data.emitente.cnpj)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Destinatário */}
      <div className="text-[8px] font-bold mt-1 uppercase">Destinatário / Remetente</div>
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td className={cell} style={{ width: "55%" }}>
              <div className={cellTitle}>NOME / RAZÃO SOCIAL</div>
              <div className={cellValue}>{data.destinatario.nome || "—"}</div>
            </td>
            <td className={cell} style={{ width: "25%" }}>
              <div className={cellTitle}>CNPJ / CPF</div>
              <div className={cellValue}>{fmtCnpj(data.destinatario.cpf_cnpj)}</div>
            </td>
            <td className={cell} style={{ width: "20%" }}>
              <div className={cellTitle}>DATA DE EMISSÃO</div>
              <div className={cellValue}>{fmtData(data.data_emissao)}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={cellTitle}>ENDEREÇO</div>
              <div className={cellValue}>
                {[
                  data.destinatario.endereco,
                  data.destinatario.numero_endereco ? `Nº ${data.destinatario.numero_endereco}` : null,
                  data.destinatario.complemento,
                ].filter(Boolean).join(" · ") || "—"}
              </div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>BAIRRO / CEP</div>
              <div className={cellValue}>
                {[data.destinatario.bairro, fmtCep(data.destinatario.cep)].filter(Boolean).join(" · ") || "—"}
              </div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>DATA SAÍDA / ENTRADA</div>
              <div className={cellValue}>{data.data_saida_entrada ? fmtData(data.data_saida_entrada) : "—"}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={cellTitle}>MUNICÍPIO / FONE</div>
              <div className={cellValue}>
                {[data.destinatario.cidade, data.destinatario.telefone].filter(Boolean).join(" · ") || "—"}
              </div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>UF</div>
              <div className={cellValue}>{data.destinatario.uf || "—"}</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>INSCRIÇÃO ESTADUAL / IND.</div>
              <div className={cellValue}>
                {[data.destinatario.inscricao_estadual, data.destinatario.indicador_ie ? `IND ${data.destinatario.indicador_ie}` : null].filter(Boolean).join(" · ") || "—"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Fatura / Duplicatas */}
      {(data.fatura || (data.duplicatas && data.duplicatas.length > 0)) && (
        <>
          <div className="text-[8px] font-bold mt-1 uppercase">Fatura / Duplicatas</div>
          <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
            <tbody>
              {data.fatura && (
                <tr>
                  <td className={cell}>
                    <div className={cellTitle}>FATURA</div>
                    <div className={cellValue}>{data.fatura.numero || "—"}</div>
                  </td>
                  <td className={cell}>
                    <div className={cellTitle}>VALOR ORIGINAL</div>
                    <div className={cellValue + " text-right"}>{fmt(data.fatura.valor_original ?? 0)}</div>
                  </td>
                  <td className={cell}>
                    <div className={cellTitle}>DESCONTO</div>
                    <div className={cellValue + " text-right"}>{fmt(data.fatura.valor_desconto ?? 0)}</div>
                  </td>
                  <td className={cell}>
                    <div className={cellTitle}>VALOR LÍQUIDO</div>
                    <div className={cellValue + " text-right"}>{fmt(data.fatura.valor_liquido ?? 0)}</div>
                  </td>
                </tr>
              )}
              {data.duplicatas?.map((d, i) => (
                <tr key={i}>
                  <td className={cell}>
                    <div className={cellTitle}>DUPLICATA</div>
                    <div className={cellValue}>{d.numero || String(i + 1)}</div>
                  </td>
                  <td className={cell} colSpan={2}>
                    <div className={cellTitle}>VENCIMENTO</div>
                    <div className={cellValue}>{fmtData(d.vencimento)}</div>
                  </td>
                  <td className={cell}>
                    <div className={cellTitle}>VALOR</div>
                    <div className={cellValue + " text-right"}>{fmt(d.valor)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Cálculo do imposto */}
      <div className="text-[8px] font-bold mt-1 uppercase">Cálculo do Imposto</div>
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            {[
              ["BASE DE CÁLC. DO ICMS", fmt(data.base_icms ?? 0)],
              ["VALOR DO ICMS", fmt(data.icms_valor ?? 0)],
              ["BASE DE CÁLC. ICMS ST", fmt(data.base_icms_st ?? 0)],
              ["VALOR ICMS ST", fmt(data.icms_st_valor ?? 0)],
              ["V. IMP. IMPORTAÇÃO", fmt(data.valor_ii ?? 0)],
              ["VALOR DO FCP", fmt(data.valor_fcp ?? 0)],
              ["VALOR DO PIS", fmt(data.pis_valor ?? 0)],
              ["V. TOTAL DE PRODUTOS", fmt(valorProdutos)],
            ].map(([t, v]) => (
              <td key={t} className={cell}>
                <div className={cellTitle}>{t}</div>
                <div className={cellValue + " text-right"}>{v}</div>
              </td>
            ))}
          </tr>
          <tr>
            {[
              ["VALOR DO FRETE", fmt(data.frete_valor ?? 0)],
              ["VALOR DO SEGURO", fmt(data.valor_seguro ?? 0)],
              ["DESCONTO", fmt(data.desconto_valor ?? 0)],
              ["OUTRAS DESP.", fmt(data.outras_despesas ?? 0)],
              ["VALOR DO IPI", fmt(data.ipi_valor ?? 0)],
              ["V. APROX. DO TRIBUTO", fmt(data.valor_total_tributos ?? 0)],
              ["VALOR DA COFINS", fmt(data.cofins_valor ?? 0)],
              ["V. TOTAL DA NOTA", fmt(data.valor_total)],
            ].map(([t, v], idx) => (
              <td key={t} className={cell}>
                <div className={cellTitle}>{t}</div>
                <div className={(idx === 7 ? "text-[11px] font-bold" : cellValue) + " text-right"}>{v}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Transportador (placeholder) */}
      <div className="text-[8px] font-bold mt-1 uppercase">Transportador / Volumes Transportados</div>
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td className={cell} style={{ width: "40%" }}>
              <div className={cellTitle}>RAZÃO SOCIAL</div>
              <div className={cellValue}>{data.transportador?.razao_social || "—"}</div>
            </td>
            <td className={cell} style={{ width: "15%" }}>
              <div className={cellTitle}>FRETE POR CONTA</div>
              <div className="text-[8px]">{FRETE_LABEL[data.modalidade_frete ?? "9"] ?? data.modalidade_frete ?? "—"}</div>
            </td>
            <td className={cell} style={{ width: "10%" }}>
              <div className={cellTitle}>CÓD. ANTT</div>
              <div className={cellValue}>{data.transportador?.antt || "—"}</div>
            </td>
            <td className={cell} style={{ width: "10%" }}>
              <div className={cellTitle}>PLACA</div>
              <div className={cellValue}>{data.transportador?.placa || "—"}</div>
            </td>
            <td className={cell} style={{ width: "5%" }}>
              <div className={cellTitle}>UF</div>
              <div className={cellValue}>{data.transportador?.uf_placa || "—"}</div>
            </td>
            <td className={cell} style={{ width: "20%" }}>
              <div className={cellTitle}>CNPJ / CPF</div>
              <div className={cellValue}>{fmtCnpj(data.transportador?.cnpj_cpf)}</div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={cellTitle}>ENDEREÇO</div>
              <div className={cellValue}>{data.transportador?.endereco || "—"}</div>
            </td>
            <td className={cell} colSpan={3}>
              <div className={cellTitle}>MUNICÍPIO</div>
              <div className={cellValue}>{data.transportador?.cidade || "—"}</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>UF</div>
              <div className={cellValue}>{data.transportador?.uf || "—"}</div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>INSCRIÇÃO ESTADUAL</div>
              <div className={cellValue}>{data.transportador?.inscricao_estadual || "—"}</div>
            </td>
          </tr>
          {data.volumes && data.volumes.length > 0 && (
            <tr>
              <td className={cell}>
                <div className={cellTitle}>QTD. / ESPÉCIE</div>
                <div className={cellValue}>
                  {data.volumes.map(v => `${v.quantidade || 0} ${v.especie ?? ""}`).join(" · ")}
                </div>
              </td>
              <td className={cell} colSpan={2}>
                <div className={cellTitle}>MARCA / NUMERAÇÃO</div>
                <div className={cellValue}>
                  {data.volumes.map(v => [v.marca, v.numero].filter(Boolean).join(" ")).join(" · ") || "—"}
                </div>
              </td>
              <td className={cell} colSpan={2}>
                <div className={cellTitle}>PESO BRUTO</div>
                <div className={cellValue + " text-right"}>{fmt(data.volumes.reduce((s, v) => s + (v.peso_bruto ?? 0), 0))}</div>
              </td>
              <td className={cell}>
                <div className={cellTitle}>PESO LÍQUIDO</div>
                <div className={cellValue + " text-right"}>{fmt(data.volumes.reduce((s, v) => s + (v.peso_liquido ?? 0), 0))}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Produtos */}
      <div className="text-[8px] font-bold mt-1 uppercase">Dados do Produto / Serviço</div>
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <thead>
          <tr className="bg-neutral-200">
            {[
              ["CÓDIGO", "10%"],
              ["DESCRIÇÃO DO PRODUTO / SERVIÇO", "32%"],
              ["NCM/SH", "7%"],
              ["CST", "4%"],
              ["CFOP", "5%"],
              ["UN", "4%"],
              ["QTD.", "6%"],
              ["VLR. UNIT.", "8%"],
              ["VLR. TOTAL", "9%"],
              ["V. ICMS", "5%"],
              ["V. IPI", "5%"],
              ["ALÍQ. ICMS", "5%"],
            ].map(([t, w]) => (
              <th key={t} className={cell + " text-[7px] font-bold uppercase"} style={{ width: w as string }}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.itens.length === 0 && (
            <tr>
              <td className={cell + " text-center text-[9px] italic text-neutral-500"} colSpan={12}>
                Sem itens.
              </td>
            </tr>
          )}
          {data.itens.map((it, idx) => {
            const total = it.valor_total ?? it.quantidade * it.valor_unitario;
            return (
              <tr key={idx}>
                <td className={cell + " text-[9px]"}>{it.codigo || "—"}</td>
                <td className={cell + " text-[9px]"}>{it.descricao || "—"}</td>
                <td className={cell + " text-[9px] text-center"}>{it.ncm || "—"}</td>
                <td className={cell + " text-[9px] text-center"}>{it.cst || "—"}</td>
                <td className={cell + " text-[9px] text-center"}>{it.cfop || "—"}</td>
                <td className={cell + " text-[9px] text-center"}>{it.unidade || "—"}</td>
                <td className={cell + " text-[9px] text-right tabular-nums"}>{fmtQtd(it.quantidade)}</td>
                <td className={cell + " text-[9px] text-right tabular-nums"}>{fmt(it.valor_unitario)}</td>
                <td className={cell + " text-[9px] text-right tabular-nums font-semibold"}>{fmt(total)}</td>
                <td className={cell + " text-[9px] text-right tabular-nums"}>{fmt(it.valor_icms ?? 0)}</td>
                <td className={cell + " text-[9px] text-right tabular-nums"}>{fmt(it.valor_ipi ?? 0)}</td>
                <td className={cell + " text-[9px] text-right tabular-nums"}>{fmt(it.aliquota_icms ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagamentos */}
      {data.pagamentos && data.pagamentos.length > 0 && (
        <>
          <div className="text-[8px] font-bold mt-1 uppercase">Pagamentos</div>
          <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
            <tbody>
              {data.pagamentos.map((p, i) => (
                <tr key={i}>
                  <td className={cell}>
                    <div className={cellTitle}>FORMA</div>
                    <div className={cellValue}>{PAG_LABEL[p.forma ?? ""] ?? p.forma ?? "—"}</div>
                  </td>
                  <td className={cell}>
                    <div className={cellTitle}>VALOR</div>
                    <div className={cellValue + " text-right"}>{fmt(p.valor)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Dados adicionais */}
      <div className="text-[8px] font-bold mt-1 uppercase">Dados Adicionais</div>
      <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td className={cell} style={{ width: "70%", minHeight: "30mm" }}>
              <div className={cellTitle}>INFORMAÇÕES COMPLEMENTARES</div>
              <div className="text-[8px] whitespace-pre-wrap leading-snug" style={{ minHeight: "20mm" }}>
                {data.observacoes || ""}
              </div>
            </td>
            <td className={cell}>
              <div className={cellTitle}>RESERVADO AO FISCO</div>
              <div style={{ minHeight: "20mm" }} />
            </td>
          </tr>
        </tbody>
      </table>

      {homologacao && (
        <div className="mt-1 text-center text-[10px] font-bold text-amber-700 border border-amber-600 py-1">
          AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}
    </div>
  );
}
