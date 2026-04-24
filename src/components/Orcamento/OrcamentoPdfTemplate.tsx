import { forwardRef } from "react";
import type { OrcamentoItem } from "./OrcamentoItemsGrid";

interface ClienteSnapshot {
  nome_razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  celular: string;
  contato: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo: string;
}

interface EmpresaSnapshot {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  logo_url?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  site?: string;
}

interface Props {
  numero: string;
  data: string;
  cliente: ClienteSnapshot;
  items: OrcamentoItem[];
  totalProdutos: number;
  desconto: number;
  impostoSt: number;
  impostoIpi: number;
  freteValor: number;
  outrasDespesas: number;
  valorTotal: number;
  quantidadeTotal: number;
  pesoTotal: number;
  pagamento: string;
  prazoPagamento: string;
  prazoEntrega: string;
  freteTipo: string;
  modalidade: string;
  observacoes: string;
  empresa?: EmpresaSnapshot;
}

export const OrcamentoPdfTemplate = forwardRef<HTMLDivElement, Props>(({
  numero, data, cliente, items, totalProdutos, desconto,
  impostoSt, impostoIpi, freteValor, outrasDespesas, valorTotal,
  quantidadeTotal, pesoTotal, pagamento, prazoPagamento,
  prazoEntrega, freteTipo, modalidade, observacoes, empresa
}, ref) => {
  const formatDate = (d: string) => {
    if (!d) return "";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  };

  const paymentLabel: Record<string, string> = {
    a_vista: "À VISTA", a_prazo: "A PRAZO", boleto: "BOLETO",
    cartao: "CARTÃO", pix: "PIX", transferencia: "TRANSFERÊNCIA",
  };

  // Strip "ORC" prefix for display
  const numeroDisplay = numero?.replace(/^ORC/i, "") || "";

  const paddedItems = [...items];
  while (paddedItems.length < 15) {
    paddedItems.push({ produto_id: "", codigo_snapshot: "", descricao_snapshot: "", variacao: "", quantidade: 0, unidade: "", valor_unitario: 0, valor_total: 0, peso_unitario: 0, peso_total: 0 });
  }

  const DARK = "#1a1a1a";
  const BORDER = "#cccccc";
  const BORDER_LIGHT = "#e0e0e0";
  const HIGHLIGHT_BG = "#f5f5f5";
  const fmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const empresaNome = empresa?.razao_social || "AVIZEE EQUIPAMENTOS LTDA";
  const enderecoLinha = [empresa?.logradouro, empresa?.numero, empresa?.bairro].filter(Boolean).join(", ") || "RUA ADA CAROLINE SCARANO, 259 - JOAO ARANHA";
  const cidadeLinha = `${[empresa?.cidade, empresa?.uf].filter(Boolean).join(" - ") || "PAULÍNIA - SP"}    CEP: ${empresa?.cep || "13145-794"}`;
  const cnpjLinha = `CNPJ: ${empresa?.cnpj || "53.078.538/0001-85"}`;
  const foneLinha = `Fone: ${empresa?.telefone || "(19) 99898-2930"}`;

  const labelStyle: React.CSSProperties = { fontWeight: 700 };
  const metaCellPad = "3px 6px";

  return (
    <div ref={ref} style={{
      width: "210mm", minHeight: "297mm", padding: "8mm 10mm",
      fontFamily: "'Montserrat', sans-serif", fontSize: "10px",
      color: "#1a1a1a", background: "#fff", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", border: `1px solid ${BORDER}`, marginBottom: "5px", minHeight: "90px" }}>
        <div style={{ flex: "0 0 30%", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRight: `1px solid ${BORDER}` }}>
          <img
            src={empresa?.logo_url || "/images/logoavizee.png"}
            alt={empresa?.nome_fantasia || "AviZee"}
            style={{ maxHeight: "75px", maxWidth: "100%", objectFit: "contain" }}
          />
        </div>
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", borderRight: `1px solid ${BORDER}` }}>
          <div style={{ flex: "0 0 38%", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>{empresaNome}</div>
          </div>
          <div style={{ flex: 1, padding: "5px 10px", fontSize: "9px", lineHeight: 1.5, color: "#222" }}>
            {enderecoLinha}<br />
            {foneLinha}<br />
            {cidadeLinha}<br />
            {cnpjLinha}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", fontWeight: 700, padding: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>Orçamento</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "13px", fontFamily: "'Roboto Mono', monospace", fontWeight: 700, padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{numeroDisplay}</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", fontWeight: 700, padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>Data</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{formatDate(data)}</div>
        </div>
      </div>

      {/* Cliente — bloco compacto, grade horizontal */}
      <div style={{ border: `1px solid ${BORDER}`, padding: "5px 10px", marginBottom: "5px", fontSize: "10px", lineHeight: 1.55 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", columnGap: "16px" }}>
          <div><span style={labelStyle}>Cod.Cliente:</span> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.codigo || "—"}</span></div>
          <div><span style={labelStyle}>Fantasia:</span> {cliente.nome_fantasia || "—"}</div>
        </div>
        <div><span style={labelStyle}>Cliente:</span> {cliente.nome_razao_social}</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", columnGap: "16px" }}>
          <div><span style={labelStyle}>Endereço:</span> {cliente.logradouro}{cliente.numero ? `, ${cliente.numero}` : ""}</div>
          <div><span style={labelStyle}>Bairro:</span> {cliente.bairro || "—"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 0.6fr 1fr", columnGap: "16px" }}>
          <div><span style={labelStyle}>Cidade:</span> {cliente.cidade || "—"}</div>
          <div><span style={labelStyle}>UF:</span> {cliente.uf || "—"}</div>
          <div><span style={labelStyle}>CEP:</span> {cliente.cep || "—"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.5fr", columnGap: "16px" }}>
          <div><span style={labelStyle}>CNPJ/CPF:</span> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.cpf_cnpj || "—"}</span></div>
          <div><span style={labelStyle}>I.E.:</span> {cliente.inscricao_estadual || "—"}</div>
          <div><span style={labelStyle}>Email:</span> {cliente.email || "—"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", columnGap: "16px" }}>
          <div><span style={labelStyle}>Fone:</span> {cliente.telefone || "—"}</div>
          <div><span style={labelStyle}>Celular:</span> {cliente.celular || "—"}</div>
          <div><span style={labelStyle}>Contato:</span> {cliente.contato || "—"}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", fontSize: "10px", border: `1px solid ${BORDER}` }}>
        <thead>
          <tr style={{ background: DARK, color: "#fff" }}>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Código</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Descrição do Material</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Variação</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Qtd.</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Un.</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Unit.</th>
            <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, fontSize: "10px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${BORDER_LIGHT}`, height: "18px" }}>
              <td style={{ padding: "3px 8px", fontFamily: "'Roboto Mono', monospace" }}>{item.codigo_snapshot}</td>
              <td style={{ padding: "3px 8px" }}>{item.descricao_snapshot}</td>
              <td style={{ padding: "3px 8px", textAlign: "center" }}>{item.variacao}</td>
              <td style={{ padding: "3px 8px", textAlign: "center", fontFamily: "'Roboto Mono', monospace" }}>{item.quantidade || ""}</td>
              <td style={{ padding: "3px 8px", textAlign: "center" }}>{item.unidade}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals — linha única horizontal compacta */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${BORDER}`, fontSize: "10px", marginBottom: "5px" }}>
        <thead>
          <tr>
            {["Total Produtos", "(-)Desconto", "(+)Imposto S.T.", "(+)Imposto IPI", "(+)Frete", "(+)Outras desp."].map((label) => (
              <th key={label} style={{ borderRight: `1px solid ${BORDER_LIGHT}`, borderBottom: `1px solid ${BORDER_LIGHT}`, padding: "4px 4px", textAlign: "center", fontWeight: 600, fontSize: "9px", lineHeight: 1.2, color: "#444" }}>{label}</th>
            ))}
            <th style={{ borderBottom: `1px solid ${BORDER_LIGHT}`, padding: "4px 4px", textAlign: "center", fontWeight: 700, fontSize: "10px", lineHeight: 1.2, background: HIGHLIGHT_BG, borderLeft: `3px solid ${DARK}` }}>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(totalProdutos)}</td>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(desconto)}</td>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(impostoSt)}</td>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(impostoIpi)}</td>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(freteValor)}</td>
            <td style={{ borderRight: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "10px" }}>{fmtMoney(outrasDespesas)}</td>
            <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px", background: HIGHLIGHT_BG, borderLeft: `3px solid ${DARK}` }}>{fmtMoney(valorTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Metadados — texto corrido em 2 sub-linhas */}
      <div style={{ fontSize: "10px", lineHeight: 1.7, marginBottom: "8px", padding: "2px 2px" }}>
        <div>
          <span style={labelStyle}>Quantidade:</span> {quantidadeTotal}
          <span style={{ margin: "0 14px" }} />
          <span style={labelStyle}>Peso:</span> {pesoTotal.toFixed(2)}
          <span style={{ margin: "0 14px" }} />
          <span style={labelStyle}>Pagamento:</span> {paymentLabel[pagamento] || pagamento || "—"}
          <span style={{ margin: "0 14px" }} />
          <span style={labelStyle}>Prazo:</span> {prazoPagamento || "—"}
        </div>
        <div>
          <span style={labelStyle}>Prazo de Entrega:</span> {prazoEntrega || "—"}
          <span style={{ margin: "0 14px" }} />
          <span style={labelStyle}>Frete:</span> {freteTipo || "—"}
          <span style={{ margin: "0 14px" }} />
          <span style={labelStyle}>Tipo:</span> {modalidade || "—"}
        </div>
      </div>

      {/* Observações */}
      <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "3px" }}>OBSERVAÇÕES</div>
      <div style={{ border: `1px solid ${BORDER}`, padding: "6px 9px", fontSize: "10px", whiteSpace: "pre-wrap", minHeight: "50px", color: "#222", lineHeight: 1.5, marginBottom: "18px" }}>
        {observacoes || ""}
      </div>

      {/* Assinatura */}
      <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "10px", padding: "0 8px" }}>
        <div style={{ flex: 1, textAlign: "center", marginRight: "30px" }}>
          <div style={{ borderTop: `1px solid ${DARK}`, paddingTop: "4px" }}>De acordo / Assinatura do cliente</div>
        </div>
        <div style={{ flex: "0 0 180px", textAlign: "center" }}>
          <div style={{ borderTop: `1px solid ${DARK}`, paddingTop: "4px" }}>Data</div>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ marginTop: "16px", paddingTop: "6px", borderTop: `1px solid ${BORDER_LIGHT}`, fontSize: "8px", color: "#888", textAlign: "center" }}>
        Orçamento gerado por Avizee ERP
      </div>
    </div>
  );
});

OrcamentoPdfTemplate.displayName = "OrcamentoPdfTemplate";
