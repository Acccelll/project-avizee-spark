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

  // Pad items to minimum 10 rows for visual consistency
  const paddedItems = [...items];
  while (paddedItems.length < 10) {
    paddedItems.push({ produto_id: "", codigo_snapshot: "", descricao_snapshot: "", variacao: "", quantidade: 0, unidade: "", valor_unitario: 0, valor_total: 0, peso_unitario: 0, peso_total: 0 });
  }

  const ORANGE = "#C9743A";
  const BORDER = "#5a5a5a";
  const BORDER_LIGHT = "#9a9a9a";
  const fmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const empresaNome = empresa?.razao_social || "AVIZEE EQUIPAMENTOS LTDA";
  const enderecoLinha = [empresa?.logradouro, empresa?.numero, empresa?.bairro].filter(Boolean).join(", ") || "RUA ADA CAROLINE SCARANO, 259 - JOAO ARANHA";
  const cidadeLinha = `${[empresa?.cidade, empresa?.uf].filter(Boolean).join(" - ") || "PAULÍNIA - SP"}    CEP: ${empresa?.cep || "13145-794"}`;
  const cnpjLinha = `CNPJ: ${empresa?.cnpj || "53.078.538/0001-85"}`;
  const foneLinha = `Fone: ${empresa?.telefone || "(19) 99898-2930"}`;

  return (
    <div ref={ref} style={{
      width: "210mm", minHeight: "297mm", padding: "8mm 10mm",
      fontFamily: "'Montserrat', sans-serif", fontSize: "10px",
      color: "#151514", background: "#fff", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", border: `1px solid ${BORDER}`, marginBottom: "6px", minHeight: "130px" }}>
        {/* Coluna 1: Logo */}
        <div style={{ flex: "0 0 38%", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", borderRight: `1px solid ${BORDER}` }}>
          <img
            src={empresa?.logo_url || "/images/logoavizee.png"}
            alt={empresa?.nome_fantasia || "AviZee"}
            style={{ maxHeight: "110px", maxWidth: "100%", objectFit: "contain" }}
          />
        </div>
        {/* Coluna 2: Empresa em 2 blocos verticais */}
        <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", borderRight: `1px solid ${BORDER}` }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "14px", fontWeight: 700, textAlign: "center", lineHeight: 1.25 }}>{empresaNome}</div>
          </div>
          <div style={{ flex: 1, padding: "8px 12px", fontSize: "10px", lineHeight: 1.7, color: "#222" }}>
            {enderecoLinha}<br />
            {cidadeLinha}<br />
            {cnpjLinha}<br />
            {foneLinha}
          </div>
        </div>
        {/* Coluna 3: Orçamento / Data */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>Orçamento</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "14px", fontFamily: "'Roboto Mono', monospace", fontWeight: 700, padding: "6px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{numero}</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "6px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>Data</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "12px", padding: "6px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{formatDate(data)}</div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ border: `1px solid ${BORDER}`, padding: "10px 14px", marginBottom: "10px", fontSize: "11px", lineHeight: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "24px" }}>
          <div><b>Cod.Cliente:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.codigo || "—"}</span></div>
          <div><b>Fantasia:</b> {cliente.nome_fantasia || "—"}</div>
          <div style={{ gridColumn: "span 2" }}><b>Cliente:</b> {cliente.nome_razao_social}</div>
          <div style={{ gridColumn: "span 2" }}><b>Endereço:</b> {cliente.logradouro}{cliente.numero ? `, ${cliente.numero}` : ""}</div>
          <div><b>Bairro:</b> {cliente.bairro || "—"}</div>
          <div><b>Cidade:</b> {cliente.cidade || "—"} &nbsp; <b>UF:</b> {cliente.uf || "—"} &nbsp; <b>CEP:</b> {cliente.cep || "—"}</div>
          <div><b>CNPJ/CPF:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.cpf_cnpj || "—"}</span></div>
          <div><b>I.E:</b> {cliente.inscricao_estadual || "—"}</div>
          <div style={{ gridColumn: "span 2" }}><b>Email:</b> {cliente.email || "—"}</div>
          <div><b>Fone:</b> {cliente.telefone || "—"} &nbsp; <b>Celular:</b> {cliente.celular || "—"}</div>
          <div><b>Contato:</b> {cliente.contato || "—"}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10px", border: `1px solid ${BORDER}` }}>
        <thead>
          <tr style={{ background: ORANGE, color: "#fff" }}>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Código</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Descrição do Material</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Variação</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Qtd.</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Un.</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700, borderRight: "1px solid #fff" }}>Unit.</th>
            <th style={{ textAlign: "center", padding: "8px 6px", fontWeight: 700 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: "5px 8px", fontFamily: "'Roboto Mono', monospace" }}>{item.codigo_snapshot}</td>
              <td style={{ padding: "5px 8px" }}>{item.descricao_snapshot}</td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{item.variacao}</td>
              <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "'Roboto Mono', monospace" }}>{item.quantidade || ""}</td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{item.unidade}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + Conditions (mesma moldura) */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${BORDER}`, fontSize: "10px", marginBottom: "10px" }}>
        <thead>
          <tr>
            {["Total Produtos", "(-)Desconto", "(+)Imposto S.T.", "(+)Imposto IPI", "(+)Frete", "(+)Outras desp."].map((label) => (
              <th key={label} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 600, fontSize: "9.5px", lineHeight: 1.2 }}>{label}</th>
            ))}
            <th style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, background: ORANGE, color: "#fff", fontSize: "13px", lineHeight: 1.2 }}>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(totalProdutos)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(desconto)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(impostoSt)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(impostoIpi)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(freteValor)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "11px" }}>{fmtMoney(outrasDespesas)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "10px 6px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", background: ORANGE, color: "#fff", fontSize: "13px" }}>{fmtMoney(valorTotal)}</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Quantidade</div>
              <b style={{ fontSize: "11px" }}>{quantidadeTotal}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Peso</div>
              <b style={{ fontSize: "11px" }}>{pesoTotal.toFixed(2)}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Pagamento</div>
              <b style={{ fontSize: "11px" }}>{paymentLabel[pagamento] || pagamento || "—"}</b>
            </td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Prazo</div>
              <b style={{ fontSize: "11px" }}>{prazoPagamento || "—"}</b>
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Prazo de Entrega</div>
              <b style={{ fontSize: "11px" }}>{prazoEntrega || "—"}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Frete</div>
              <b style={{ fontSize: "11px" }}>{freteTipo || "—"}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ color: "#444", fontSize: "9px", marginBottom: "2px" }}>Tipo</div>
              <b style={{ fontSize: "11px" }}>{modalidade || "—"}</b>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Observações */}
      <div style={{ fontWeight: 700, fontSize: "11px", marginBottom: "4px" }}>OBSERVAÇÕES</div>
      <div style={{ border: `1px solid ${BORDER}`, padding: "10px 12px", fontSize: "10.5px", whiteSpace: "pre-wrap", minHeight: "70px", color: "#222", lineHeight: 1.6 }}>
        {observacoes || ""}
      </div>
    </div>
  );
});

OrcamentoPdfTemplate.displayName = "OrcamentoPdfTemplate";
