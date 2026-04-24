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
  while (paddedItems.length < 15) {
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
      width: "210mm", minHeight: "297mm", padding: "7mm 9mm",
      fontFamily: "'Montserrat', sans-serif", fontSize: "9px",
      color: "#151514", background: "#fff", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", border: `1px solid ${BORDER}`, marginBottom: "5px", minHeight: "95px" }}>
        {/* Coluna 1: Logo */}
        <div style={{ flex: "0 0 30%", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRight: `1px solid ${BORDER}` }}>
          <img
            src={empresa?.logo_url || "/images/logoavizee.png"}
            alt={empresa?.nome_fantasia || "AviZee"}
            style={{ maxHeight: "78px", maxWidth: "100%", objectFit: "contain" }}
          />
        </div>
        {/* Coluna 2: Empresa em 2 blocos verticais */}
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
        {/* Coluna 3: Orçamento / Data */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", fontWeight: 700, padding: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>Orçamento</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "12px", fontFamily: "'Roboto Mono', monospace", fontWeight: 700, padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{numero}</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", fontWeight: 700, padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>Data</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "10px", padding: "3px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{formatDate(data)}</div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ border: `1px solid ${BORDER}`, padding: "6px 10px", marginBottom: "6px", fontSize: "9.5px", lineHeight: 1.55 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", columnGap: "16px" }}>
          <div><b>Cod.Cliente:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.codigo || "—"}</span></div>
          <div style={{ gridColumn: "span 2" }}><b>Fantasia:</b> {cliente.nome_fantasia || "—"}</div>
          <div style={{ gridColumn: "span 3" }}><b>Cliente:</b> {cliente.nome_razao_social}</div>
          <div style={{ gridColumn: "span 3" }}><b>Endereço:</b> {cliente.logradouro}{cliente.numero ? `, ${cliente.numero}` : ""}</div>
          <div><b>Bairro:</b> {cliente.bairro || "—"}</div>
          <div><b>Cidade:</b> {cliente.cidade || "—"} &nbsp; <b>UF:</b> {cliente.uf || "—"}</div>
          <div><b>CEP:</b> {cliente.cep || "—"}</div>
          <div><b>CNPJ/CPF:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.cpf_cnpj || "—"}</span></div>
          <div><b>I.E:</b> {cliente.inscricao_estadual || "—"}</div>
          <div><b>Contato:</b> {cliente.contato || "—"}</div>
          <div style={{ gridColumn: "span 2" }}><b>Email:</b> {cliente.email || "—"}</div>
          <div><b>Fone:</b> {cliente.telefone || "—"}</div>
          <div><b>Celular:</b> {cliente.celular || "—"}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", fontSize: "9px", border: `1px solid ${BORDER}` }}>
        <thead>
          <tr style={{ background: ORANGE, color: "#fff" }}>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Código</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Descrição do Material</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Variação</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Qtd.</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Un.</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, borderRight: "1px solid #fff", fontSize: "9.5px" }}>Unit.</th>
            <th style={{ textAlign: "center", padding: "5px 4px", fontWeight: 700, fontSize: "9.5px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: "3px 6px", fontFamily: "'Roboto Mono', monospace" }}>{item.codigo_snapshot}</td>
              <td style={{ padding: "3px 6px" }}>{item.descricao_snapshot}</td>
              <td style={{ padding: "3px 6px", textAlign: "center" }}>{item.variacao}</td>
              <td style={{ padding: "3px 6px", textAlign: "center", fontFamily: "'Roboto Mono', monospace" }}>{item.quantidade || ""}</td>
              <td style={{ padding: "3px 6px", textAlign: "center" }}>{item.unidade}</td>
              <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
              <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + Conditions (mesma moldura) */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${BORDER}`, fontSize: "9px", marginBottom: "6px" }}>
        <thead>
          <tr>
            {["Total Produtos", "(-)Desconto", "(+)Imposto S.T.", "(+)Imposto IPI", "(+)Frete", "(+)Outras desp."].map((label) => (
              <th key={label} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "4px 3px", textAlign: "center", fontWeight: 600, fontSize: "8.5px", lineHeight: 1.2 }}>{label}</th>
            ))}
            <th style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "4px 3px", textAlign: "center", fontWeight: 700, background: ORANGE, color: "#fff", fontSize: "11px", lineHeight: 1.2 }}>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(totalProdutos)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(desconto)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(impostoSt)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(impostoIpi)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(freteValor)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", fontSize: "9.5px" }}>{fmtMoney(outrasDespesas)}</td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", background: ORANGE, color: "#fff", fontSize: "11px" }}>{fmtMoney(valorTotal)}</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Quantidade</div>
              <b style={{ fontSize: "9.5px" }}>{quantidadeTotal}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Peso</div>
              <b style={{ fontSize: "9.5px" }}>{pesoTotal.toFixed(2)}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Pagamento</div>
              <b style={{ fontSize: "9.5px" }}>{paymentLabel[pagamento] || pagamento || "—"}</b>
            </td>
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Prazo</div>
              <b style={{ fontSize: "9.5px" }}>{prazoPagamento || "—"}</b>
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Prazo de Entrega</div>
              <b style={{ fontSize: "9.5px" }}>{prazoEntrega || "—"}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Frete</div>
              <b style={{ fontSize: "9.5px" }}>{freteTipo || "—"}</b>
            </td>
            <td colSpan={2} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", fontSize: "9px" }}>
              <div style={{ color: "#444", fontSize: "8px", marginBottom: "1px" }}>Tipo</div>
              <b style={{ fontSize: "9.5px" }}>{modalidade || "—"}</b>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Observações */}
      <div style={{ fontWeight: 700, fontSize: "9.5px", marginBottom: "3px" }}>OBSERVAÇÕES</div>
      <div style={{ border: `1px solid ${BORDER}`, padding: "6px 9px", fontSize: "9px", whiteSpace: "pre-wrap", minHeight: "50px", color: "#222", lineHeight: 1.5 }}>
        {observacoes || ""}
      </div>
    </div>
  );
});

OrcamentoPdfTemplate.displayName = "OrcamentoPdfTemplate";
