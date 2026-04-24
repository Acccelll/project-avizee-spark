import { forwardRef } from "react";
import type { OrcamentoItem } from "./OrcamentoItemsGrid";

interface ClienteSnapshot {
  nome_razao_social: string; nome_fantasia: string; cpf_cnpj: string;
  inscricao_estadual: string; email: string; telefone: string; celular: string;
  contato: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; cep: string; codigo: string;
}
interface EmpresaSnapshot {
  razao_social?: string; nome_fantasia?: string; cnpj?: string;
  inscricao_estadual?: string; logo_url?: string; logradouro?: string;
  numero?: string; bairro?: string; cidade?: string; uf?: string;
  cep?: string; telefone?: string; email?: string; site?: string;
}
interface Props {
  numero: string; data: string; cliente: ClienteSnapshot; items: OrcamentoItem[];
  totalProdutos: number; desconto: number; impostoSt: number; impostoIpi: number;
  freteValor: number; outrasDespesas: number; valorTotal: number;
  quantidadeTotal: number; pesoTotal: number; pagamento: string;
  prazoPagamento: string; prazoEntrega: string; freteTipo: string;
  modalidade: string; observacoes: string; empresa?: EmpresaSnapshot;
}

/**
 * Template de orçamento alinhado à identidade de marca AviZee.
 * Paleta: ink #151514 / wine #690500 / orange #b2592c / cream #fffaed.
 * Tipografia: Montserrat, com tabular-nums em valores monetários.
 */
export const OrcamentoPdfTemplateBrand = forwardRef<HTMLDivElement, Props>(({
  numero, data, cliente, items, totalProdutos, desconto, impostoSt, impostoIpi,
  freteValor, outrasDespesas, valorTotal, quantidadeTotal, pesoTotal,
  pagamento, prazoPagamento, prazoEntrega, freteTipo, modalidade, observacoes, empresa,
}, ref) => {
  const INK = "#151514";
  const WINE = "#690500";
  const ORANGE = "#b2592c";
  const CREAM = "#fffaed";
  const BORDER = "#e8e1d2";

  const fmtMoney = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "");
  const numeroDisplay = (numero || "").replace(/^ORC/i, "");
  const paymentLabel: Record<string, string> = {
    a_vista: "À VISTA", a_prazo: "A PRAZO", boleto: "BOLETO",
    cartao: "CARTÃO", pix: "PIX", transferencia: "TRANSFERÊNCIA",
  };

  const realItems = items.filter(i => i.produto_id);
  const empresaNome = empresa?.razao_social || "AVIZEE EQUIPAMENTOS LTDA";
  const enderecoLinha = [empresa?.logradouro, empresa?.numero, empresa?.bairro].filter(Boolean).join(", ") || "RUA ADA CAROLINE SCARANO, 259 - JOAO ARANHA";
  const cidadeLinha = `${[empresa?.cidade, empresa?.uf].filter(Boolean).join(" - ") || "PAULÍNIA - SP"} • CEP: ${empresa?.cep || "13145-794"}`;
  const cnpjLinha = `CNPJ: ${empresa?.cnpj || "53.078.538/0001-85"}`;
  const foneLinha = `${empresa?.telefone || "(19) 99898-2930"}${empresa?.email ? ` • ${empresa.email}` : ""}`;

  const tabular: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' };

  return (
    <div ref={ref} style={{
      width: "210mm", minHeight: "297mm", padding: "0",
      fontFamily: "'Montserrat', sans-serif", fontSize: "10.5px",
      color: INK, background: "#fff", boxSizing: "border-box",
    }}>
      {/* HEADER — barra escura com logo + número */}
      <div style={{ background: INK, color: CREAM, padding: "14mm 12mm 10mm", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ background: CREAM, padding: "8px 12px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={empresa?.logo_url || "/images/logoavizee.png"} alt={empresa?.nome_fantasia || "AviZee"} style={{ maxHeight: "44px", maxWidth: "150px", objectFit: "contain", display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "2px", color: ORANGE, fontWeight: 600 }}>PROPOSTA COMERCIAL</div>
            <div style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "0.5px", marginTop: "2px" }}>Orçamento</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9px", letterSpacing: "1.5px", color: "#cdbfa3", fontWeight: 500 }}>Nº</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: CREAM, ...tabular, lineHeight: 1 }}>{numeroDisplay}</div>
          <div style={{ fontSize: "10px", marginTop: "6px", color: "#cdbfa3" }}>Emitido em <span style={{ color: CREAM, fontWeight: 600 }}>{formatDate(data)}</span></div>
        </div>
      </div>

      {/* Faixa fina laranja */}
      <div style={{ height: "4px", background: ORANGE }} />

      {/* Conteúdo */}
      <div style={{ padding: "8mm 12mm 12mm" }}>
        {/* Cards Empresa + Cliente */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
          {/* Empresa */}
          <div style={{ background: CREAM, borderLeft: `3px solid ${WINE}`, padding: "8px 12px", fontSize: "9.5px", lineHeight: 1.55 }}>
            <div style={{ fontSize: "8px", letterSpacing: "1.5px", color: WINE, fontWeight: 700, marginBottom: "3px" }}>EMITENTE</div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: INK, marginBottom: "2px" }}>{empresaNome}</div>
            <div style={{ color: "#3d3d3a" }}>{enderecoLinha}</div>
            <div style={{ color: "#3d3d3a" }}>{cidadeLinha}</div>
            <div style={{ color: "#3d3d3a" }}>{cnpjLinha}</div>
            <div style={{ color: "#3d3d3a" }}>{foneLinha}</div>
          </div>
          {/* Cliente */}
          <div style={{ background: CREAM, borderLeft: `3px solid ${ORANGE}`, padding: "8px 12px", fontSize: "9.5px", lineHeight: 1.55 }}>
            <div style={{ fontSize: "8px", letterSpacing: "1.5px", color: ORANGE, fontWeight: 700, marginBottom: "3px" }}>
              CLIENTE {cliente.codigo ? <span style={{ color: "#7a6a48", fontWeight: 500 }}>• Cód. {cliente.codigo}</span> : null}
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: INK, marginBottom: "2px" }}>{cliente.nome_razao_social || "—"}</div>
            {cliente.nome_fantasia && <div style={{ color: "#3d3d3a", fontStyle: "italic" }}>{cliente.nome_fantasia}</div>}
            <div style={{ color: "#3d3d3a" }}>{[cliente.logradouro, cliente.numero].filter(Boolean).join(", ") || "—"}{cliente.bairro ? ` • ${cliente.bairro}` : ""}</div>
            <div style={{ color: "#3d3d3a" }}>{[cliente.cidade, cliente.uf].filter(Boolean).join(" - ") || "—"}{cliente.cep ? ` • CEP ${cliente.cep}` : ""}</div>
            <div style={{ color: "#3d3d3a" }}>
              CNPJ/CPF: {cliente.cpf_cnpj || "—"}{cliente.inscricao_estadual ? ` • IE: ${cliente.inscricao_estadual}` : ""}
            </div>
            <div style={{ color: "#3d3d3a" }}>
              {cliente.contato ? `${cliente.contato} • ` : ""}{cliente.telefone || cliente.celular || "—"}{cliente.email ? ` • ${cliente.email}` : ""}
            </div>
          </div>
        </div>

        {/* Itens */}
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "8px", letterSpacing: "1.5px", color: WINE, fontWeight: 700, marginBottom: "4px", paddingLeft: "2px" }}>ITENS DO ORÇAMENTO</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: `1px solid ${BORDER}` }}>
            <thead>
              <tr style={{ background: INK, color: CREAM }}>
                <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "11%", background: INK, color: CREAM }}>CÓDIGO</th>
                <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", background: INK, color: CREAM }}>DESCRIÇÃO</th>
                <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "10%", background: INK, color: CREAM }}>VARIAÇÃO</th>
                <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "6%", background: INK, color: CREAM }}>QTD</th>
                <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "6%", background: INK, color: CREAM }}>UN</th>
                <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "13%", background: INK, color: CREAM }}>UNITÁRIO</th>
                <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, fontSize: "9px", letterSpacing: "0.5px", width: "14%", background: INK, color: CREAM }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {realItems.map((item, idx) => (
                <tr key={`r-${idx}`} style={{ background: idx % 2 === 0 ? "#fff" : CREAM, borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600, color: WINE, ...tabular }}>{item.codigo_snapshot}</td>
                  <td style={{ padding: "6px 8px", color: INK }}>{item.descricao_snapshot}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#3d3d3a" }}>{item.variacao || "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", ...tabular, fontWeight: 600 }}>{item.quantidade || ""}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#3d3d3a" }}>{item.unidade}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...tabular, color: "#3d3d3a" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...tabular, fontWeight: 700, color: INK }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
                </tr>
              ))}
              {realItems.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#a0967e", fontStyle: "italic" }}>Nenhum item adicionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Resumo: linhas de totais à esquerda + card destaque à direita */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.85fr", gap: "10px", marginBottom: "10px" }}>
          {/* Esquerda: condições / metadados */}
          <div style={{ border: `1px solid ${BORDER}`, padding: "10px 12px", fontSize: "10px", lineHeight: 1.7 }}>
            <div style={{ fontSize: "8px", letterSpacing: "1.5px", color: WINE, fontWeight: 700, marginBottom: "5px" }}>CONDIÇÕES COMERCIAIS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "12px" }}>
              <div><span style={{ color: "#7a6a48" }}>Pagamento</span><br /><b>{paymentLabel[pagamento] || pagamento || "—"}</b></div>
              <div><span style={{ color: "#7a6a48" }}>Prazo Pagto.</span><br /><b>{prazoPagamento || "—"}</b></div>
              <div><span style={{ color: "#7a6a48" }}>Prazo Entrega</span><br /><b>{prazoEntrega || "—"}</b></div>
              <div><span style={{ color: "#7a6a48" }}>Frete</span><br /><b>{freteTipo || "—"}</b></div>
              <div><span style={{ color: "#7a6a48" }}>Modalidade</span><br /><b>{modalidade || "—"}</b></div>
              <div><span style={{ color: "#7a6a48" }}>Qtd / Peso</span><br /><b style={tabular}>{quantidadeTotal} / {pesoTotal.toFixed(2)} kg</b></div>
            </div>
          </div>
          {/* Direita: card valor total */}
          <div style={{ background: INK, color: CREAM, padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontSize: "9.5px", lineHeight: 1.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>Total Produtos</span><span style={tabular}>{fmtMoney(totalProdutos)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>(−) Desconto</span><span style={tabular}>{fmtMoney(desconto)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>(+) ST</span><span style={tabular}>{fmtMoney(impostoSt)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>(+) IPI</span><span style={tabular}>{fmtMoney(impostoIpi)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>(+) Frete</span><span style={tabular}>{fmtMoney(freteValor)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#cdbfa3" }}>(+) Outras</span><span style={tabular}>{fmtMoney(outrasDespesas)}</span></div>
            </div>
            <div style={{ borderTop: `1px solid ${ORANGE}`, marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "10px", letterSpacing: "1.5px", color: ORANGE, fontWeight: 700 }}>VALOR TOTAL</span>
              <span style={{ fontSize: "20px", fontWeight: 700, color: CREAM, ...tabular }}>{fmtMoney(valorTotal)}</span>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <div style={{ fontSize: "8px", letterSpacing: "1.5px", color: WINE, fontWeight: 700, marginBottom: "4px" }}>OBSERVAÇÕES</div>
          <div style={{ border: `1px solid ${BORDER}`, background: CREAM, padding: "10px 12px", fontSize: "9.5px", whiteSpace: "pre-wrap", minHeight: "55px", color: "#3d3d3a", lineHeight: 1.55 }}>
            {observacoes || "—"}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", fontSize: "8.5px", color: "#7a6a48", letterSpacing: "0.3px" }}>
          <span>{empresaNome} • {cnpjLinha}</span>
          <span>Documento gerado eletronicamente</span>
        </div>
      </div>
    </div>
  );
});

OrcamentoPdfTemplateBrand.displayName = "OrcamentoPdfTemplateBrand";
