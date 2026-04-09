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

  return (
    <div ref={ref} style={{
      width: "210mm", minHeight: "297mm", padding: "12mm 15mm",
      fontFamily: "'Montserrat', sans-serif", fontSize: "10px",
      color: "#151514", background: "#fff", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #690500", paddingBottom: "8px", marginBottom: "12px" }}>
        <div>
          <img src={empresa?.logo_url || "/images/logoavizee.png"} alt={empresa?.nome_fantasia || "AviZee"} style={{ height: "36px", marginBottom: "4px" }} />
          <div style={{ fontSize: "9px", color: "#666", marginTop: "2px" }}>{empresa?.razao_social || "AVIZEE EQUIPAMENTOS LTDA"}</div>
          <div style={{ fontSize: "8px", color: "#888", lineHeight: 1.5 }}>
            {[empresa?.logradouro, empresa?.numero ? `${empresa.numero}` : null, empresa?.bairro].filter(Boolean).join(", ") || "Diogo Antonio Feijó, 111 - João Aranha"}<br />
            {empresa?.telefone ? `Fone: ${empresa.telefone}` : "Fone: (19) 99898-2930"}<br />
            {[empresa?.cidade, empresa?.uf].filter(Boolean).join(" - ")}{empresa?.cep ? ` CEP: ${empresa.cep}` : " CEP: 13.145-706"}<br />
            {empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : "CNPJ: 53.078.538/0001-85"}
            {empresa?.email ? <><br />{empresa.email}</> : null}
            {empresa?.site ? <><br />{empresa.site}</> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#690500" }}>ORÇAMENTO</div>
          <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: "14px", fontWeight: 600 }}>{numero}</div>
          <div style={{ fontSize: "9px", color: "#666", marginTop: "2px" }}>Data: {formatDate(data)}</div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ border: "1px solid #e8e0d0", borderRadius: "4px", padding: "8px 10px", marginBottom: "12px", fontSize: "9px", lineHeight: 1.8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
          <div><b>Cod.Cliente:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.codigo || "—"}</span></div>
          <div style={{ gridColumn: "span 2" }}><b>Fantasia:</b> {cliente.nome_fantasia || "—"}</div>
          <div style={{ gridColumn: "span 3" }}><b>Cliente:</b> {cliente.nome_razao_social}</div>
          <div style={{ gridColumn: "span 2" }}><b>Endereço:</b> {cliente.logradouro}{cliente.numero ? `, ${cliente.numero}` : ""}</div>
          <div><b>Bairro:</b> {cliente.bairro || "—"}</div>
          <div><b>Cidade:</b> {cliente.cidade || "—"}</div>
          <div><b>UF:</b> {cliente.uf || "—"}</div>
          <div><b>CEP:</b> {cliente.cep || "—"}</div>
          <div><b>CNPJ/CPF:</b> <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{cliente.cpf_cnpj || "—"}</span></div>
          <div><b>I.E.:</b> {cliente.inscricao_estadual || "—"}</div>
          <div><b>Email:</b> {cliente.email || "—"}</div>
          <div><b>Fone:</b> {cliente.telefone || "—"}</div>
          <div><b>Celular:</b> {cliente.celular || "—"}</div>
          <div><b>Contato:</b> {cliente.contato || "—"}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "9px" }}>
        <thead>
          <tr style={{ background: "#f0e8d8" }}>
            <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Código</th>
            <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Descrição do Material</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Variação</th>
            <th style={{ textAlign: "right", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Qtd.</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Un.</th>
            <th style={{ textAlign: "right", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Unit.</th>
            <th style={{ textAlign: "right", padding: "5px 6px", fontWeight: 600, borderBottom: "1px solid #d4cbb8" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f0e8d8" }}>
              <td style={{ padding: "4px 6px", fontFamily: "'Roboto Mono', monospace" }}>{item.codigo_snapshot}</td>
              <td style={{ padding: "4px 6px" }}>{item.descricao_snapshot}</td>
              <td style={{ padding: "4px 6px", textAlign: "center" }}>{item.variacao}</td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.quantidade || ""}</td>
              <td style={{ padding: "4px 6px", textAlign: "center" }}>{item.unidade}</td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "'Roboto Mono', monospace" }}>{item.valor_unitario ? `R$ ${item.valor_unitario.toFixed(2)}` : ""}</td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "'Roboto Mono', monospace", fontWeight: 600 }}>{item.valor_total ? `R$ ${item.valor_total.toFixed(2)}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ border: "1px solid #e8e0d0", borderRadius: "4px", padding: "6px 10px", marginBottom: "8px", fontSize: "9px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" }}>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Total Produtos</div><div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600 }}>R$ {totalProdutos.toFixed(2)}</div></div>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Desconto</div><div style={{ fontFamily: "'Roboto Mono', monospace" }}>R$ {desconto.toFixed(2)}</div></div>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Imp. S.T.</div><div style={{ fontFamily: "'Roboto Mono', monospace" }}>R$ {impostoSt.toFixed(2)}</div></div>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Imp. IPI</div><div style={{ fontFamily: "'Roboto Mono', monospace" }}>R$ {impostoIpi.toFixed(2)}</div></div>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Frete</div><div style={{ fontFamily: "'Roboto Mono', monospace" }}>R$ {freteValor.toFixed(2)}</div></div>
          <div><div style={{ color: "#888", fontSize: "7px", marginBottom: "2px" }}>Outras Desp.</div><div style={{ fontFamily: "'Roboto Mono', monospace" }}>R$ {outrasDespesas.toFixed(2)}</div></div>
          <div style={{ background: "#fffaed", borderRadius: "3px", padding: "2px" }}><div style={{ color: "#690500", fontSize: "7px", fontWeight: 600, marginBottom: "2px" }}>Valor Total</div><div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: "11px", color: "#690500" }}>R$ {valorTotal.toFixed(2)}</div></div>
        </div>
      </div>

      {/* Commercial conditions */}
      <div style={{ border: "1px solid #e8e0d0", borderRadius: "4px", padding: "6px 10px", marginBottom: "8px", fontSize: "9px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", marginBottom: "6px" }}>
          <div><span style={{ color: "#888" }}>Quantidade:</span> <b>{quantidadeTotal}</b></div>
          <div><span style={{ color: "#888" }}>Peso:</span> <b>{pesoTotal.toFixed(2)} kg</b></div>
          <div><span style={{ color: "#888" }}>Pagamento:</span> <b>{paymentLabel[pagamento] || pagamento || "—"}</b></div>
          <div><span style={{ color: "#888" }}>Prazo:</span> <b>{prazoPagamento || "—"}</b></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", borderTop: "1px solid #f0e8d8", paddingTop: "6px" }}>
          <div><span style={{ color: "#888" }}>Prazo de Entrega:</span> <b>{prazoEntrega || "—"}</b></div>
          <div><span style={{ color: "#888" }}>Frete:</span> <b>{freteTipo || "—"}</b></div>
          <div><span style={{ color: "#888" }}>Tipo:</span> <b>{modalidade || "—"}</b></div>
        </div>
      </div>

      {/* Observações */}
      <div style={{ border: "1px solid #e8e0d0", borderRadius: "4px", padding: "8px 10px", fontSize: "9px" }}>
        <div style={{ fontWeight: 600, color: "#690500", marginBottom: "4px" }}>OBSERVAÇÕES</div>
        <div style={{ whiteSpace: "pre-wrap", minHeight: "40px", color: "#333" }}>{observacoes || ""}</div>
      </div>
    </div>
  );
});

OrcamentoPdfTemplate.displayName = "OrcamentoPdfTemplate";
