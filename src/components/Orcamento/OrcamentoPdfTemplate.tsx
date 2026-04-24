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

  // Pad items to minimum 18 empty rows for visual consistency (no borders on empties)
  const realItems = items.filter(i => i.produto_id);
  const minRows = 18;
  const emptyRows = Math.max(0, minRows - realItems.length);

  const ORANGE = "#C9743A";
  const BORDER = "#5a5a5a";
  const BORDER_LIGHT = "#cccccc";
  const ROW_BORDER = "#e8e8e8";
  const fmtMoney = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const numeroDisplay = (numero || "").replace(/^ORC/i, "");
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
      <div style={{ display: "flex", border: `1px solid ${BORDER}`, marginBottom: "6px", minHeight: "110px" }}>
        {/* Coluna 1: Logo */}
        <div style={{ flex: "0 0 30%", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRight: `1px solid ${BORDER}` }}>
          <img
            src={empresa?.logo_url || "/images/logoavizee.png"}
            alt={empresa?.nome_fantasia || "AviZee"}
            style={{ maxHeight: "95px", maxWidth: "100%", objectFit: "contain" }}
          />
        </div>
        {/* Coluna 2: Empresa (bloco único, sem subdivisão horizontal) */}
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 12px", borderRight: `1px solid ${BORDER}`, lineHeight: 1.45, color: "#222" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#151514" }}>{empresaNome}</div>
          <div style={{ fontSize: "10px" }}>{enderecoLinha}</div>
          <div style={{ fontSize: "10px" }}>{foneLinha}</div>
          <div style={{ fontSize: "10px" }}>{cidadeLinha}</div>
          <div style={{ fontSize: "10px" }}>{cnpjLinha}</div>
        </div>
        {/* Coluna 3: Orçamento / Data */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>Orçamento</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "13px", fontFamily: "'Roboto Mono', monospace", fontWeight: 400, padding: "4px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{numeroDisplay}</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "4px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>Data</div>
          <div style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "4px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{formatDate(data)}</div>
        </div>
      </div>

      {/* Cliente — grade 3 colunas compacta */}
      <div style={{ border: `1px solid ${BORDER}`, padding: "6px 12px", marginBottom: "6px", fontSize: "10px", lineHeight: 1.55 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr", columnGap: "16px", rowGap: "2px" }}>
          {/* Linha 1 */}
          <div><b>Cod.Cliente:</b> {cliente.codigo || "—"}</div>
          <div></div>
          <div style={{ textAlign: "right" }}><b>Fantasia:</b> {cliente.nome_fantasia || "—"}</div>
          {/* Linha 2 */}
          <div style={{ gridColumn: "span 3" }}><b>Cliente:</b> {cliente.nome_razao_social || "—"}</div>
          {/* Linha 3 */}
          <div style={{ gridColumn: "span 2" }}><b>Endereço:</b> {cliente.logradouro || "—"}{cliente.numero ? `, ${cliente.numero}` : ""}</div>
          <div style={{ textAlign: "right" }}><b>Bairro:</b> {cliente.bairro || "—"}</div>
          {/* Linha 4 */}
          <div><b>Cidade:</b> {cliente.cidade || "—"}</div>
          <div><b>UF:</b> {cliente.uf || "—"}</div>
          <div style={{ textAlign: "right" }}><b>CEP:</b> {cliente.cep || "—"}</div>
          {/* Linha 5 */}
          <div><b>CNPJ/CPF:</b> {cliente.cpf_cnpj || "—"}</div>
          <div><b>I.E.:</b> {cliente.inscricao_estadual || "—"}</div>
          <div style={{ textAlign: "right" }}><b>Email:</b> {cliente.email || "—"}</div>
          {/* Linha 6 */}
          <div><b>Fone:</b> {cliente.telefone || "—"}</div>
          <div><b>Celular:</b> {cliente.celular || "—"}</div>
          <div style={{ textAlign: "right" }}><b>Contato:</b> {cliente.contato || "—"}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0", fontSize: "10px", border: `1px solid ${BORDER}` }}>
        <thead>
          <tr style={{ backgroundColor: ORANGE, color: "#fff" }}>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)", width: "11%" }}>Código</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)" }}>Descrição do Material</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)", width: "11%" }}>Variação</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)", width: "7%" }}>Qtd.</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)", width: "7%" }}>Un.</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRight: "1px solid rgba(255,255,255,0.5)", width: "12%" }}>Unit.</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 700, fontSize: "10px", backgroundColor: ORANGE, color: "#fff", width: "13%" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {realItems.map((item, idx) => (
            <tr key={`r-${idx}`}>
              <td style={{ padding: "3px 8px", fontFamily: "'Roboto Mono', monospace" }}>{item.codigo_snapshot}</td>
              <td style={{ padding: "3px 8px" }}>{item.descricao_snapshot}</td>
              <td style={{ padding: "3px 8px", textAlign: "center" }}>{item.variacao}</td>
              <td style={{ padding: "3px 8px", textAlign: "center", fontFamily: "'Roboto Mono', monospace" }}>{item.quantidade || ""}</td>
              <td style={{ padding: "3px 8px", textAlign: "center" }}>{item.unidade}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, idx) => (
            <tr key={`e-${idx}`} style={{ height: "16px" }}>
              <td colSpan={7} style={{ padding: 0, border: "none" }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Faixa única de totais — 7 colunas compactas */}
      <table style={{ width: "100%", borderCollapse: "collapse", borderTop: `2px solid ${BORDER_LIGHT}`, border: `1px solid ${BORDER_LIGHT}`, fontSize: "10px", marginBottom: "4px", marginTop: "0" }}>
        <tbody>
          <tr>
            {[
              { label: "Total Produtos", value: fmtMoney(totalProdutos) },
              { label: "(-)Desconto", value: fmtMoney(desconto) },
              { label: "(+)Imposto S.T.", value: fmtMoney(impostoSt) },
              { label: "(+)Imposto IPI", value: fmtMoney(impostoIpi) },
              { label: "(+)Frete", value: fmtMoney(freteValor) },
              { label: "(+)Outras desp.", value: fmtMoney(outrasDespesas) },
            ].map((cell) => (
              <td key={cell.label} style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 6px", textAlign: "center", verticalAlign: "middle", width: "12%" }}>
                <div style={{ fontSize: "9.5px", fontWeight: 600, color: "#444", marginBottom: "2px", whiteSpace: "nowrap" }}>{cell.label}</div>
                <div style={{ fontSize: "11px", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", whiteSpace: "nowrap" }}>{cell.value}</div>
              </td>
            ))}
            <td style={{ border: `1px solid ${BORDER_LIGHT}`, padding: "5px 8px", textAlign: "center", verticalAlign: "middle", backgroundColor: ORANGE, color: "#fff", width: "16%" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "2px", color: "#fff" }}>Valor Total</div>
              <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "'Roboto Mono', monospace", color: "#fff", whiteSpace: "nowrap" }}>{fmtMoney(valorTotal)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Metadados em texto corrido — 2 sub-linhas */}
      <div style={{ padding: "4px 2px", fontSize: "10px", marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
          <span><b>Quantidade:</b> {quantidadeTotal}</span>
          <span><b>Peso:</b> {pesoTotal.toFixed(2)}</span>
          <span><b>Pagamento:</b> {paymentLabel[pagamento] || pagamento || "—"}</span>
          <span><b>Prazo:</b> {prazoPagamento || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span><b>Prazo de Entrega:</b> <b>{prazoEntrega || "—"}</b></span>
          <span><b>Frete:</b> {freteTipo || "—"}</span>
          <span><b>Tipo:</b> {modalidade || "—"}</span>
        </div>
      </div>

      {/* Observações */}
      <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "3px" }}>OBSERVAÇÕES</div>
      <div style={{ border: `1px solid ${BORDER}`, padding: "8px 10px", fontSize: "10px", whiteSpace: "pre-wrap", minHeight: "60px", color: "#222", lineHeight: 1.5 }}>
        {observacoes || ""}
      </div>
    </div>
  );
});

OrcamentoPdfTemplate.displayName = "OrcamentoPdfTemplate";
