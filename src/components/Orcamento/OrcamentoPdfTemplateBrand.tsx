import { forwardRef } from "react";
import type { OrcamentoItem } from "./OrcamentoItemsGrid";
import { cpfCnpjMask, cepMask, phoneMask } from "@/utils/masks";

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
 * Template de orçamento — versão "Marca AviZee" (refinada, A4).
 * Paleta: brand.primary #b2592c · brand.secondary #690500 · ink #1B1411 ·
 *         muted #8A7E73 · rule #E4DCD2 · softRule #EFE9E0 · tintDeep #F6EADD.
 * Tipografia: Montserrat em todo o documento (textos e números, com tabular-nums em colunas numéricas).
 */
export const OrcamentoPdfTemplateBrand = forwardRef<HTMLDivElement, Props>(({
  numero, data, cliente, items, totalProdutos, desconto, impostoSt, impostoIpi,
  freteValor, outrasDespesas, valorTotal, quantidadeTotal, pesoTotal,
  pagamento, prazoPagamento, prazoEntrega, freteTipo, modalidade, observacoes, empresa,
}, ref) => {
  const PRIMARY  = "#b2592c";
  const SECONDARY = "#690500";
  const INK      = "#1B1411";
  const MUTED    = "#8A7E73";
  const RULE     = "#E4DCD2";
  const SOFTRULE = "#EFE9E0";
  const TINTDEEP = "#F6EADD";

  const fmtMoney = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "");
  const numeroDisplay = (numero || "").replace(/^ORC/i, "");
  const paymentLabel: Record<string, string> = {
    a_vista: "À VISTA", a_prazo: "A PRAZO", boleto: "BOLETO",
    cartao: "CARTÃO", pix: "PIX", transferencia: "TRANSFERÊNCIA",
  };

  const realItems = items.filter(i => i.produto_id);
  const MIN_ROWS = 10;
  const fillerRows = Math.max(0, MIN_ROWS - realItems.length);
  const empresaNome = empresa?.razao_social || "AVIZEE EQUIPAMENTOS LTDA";
  const enderecoEmpresa = [empresa?.logradouro, empresa?.numero, empresa?.bairro].filter(Boolean).join(", ") || "Diogo Antônio Feijó, 111, João Aranha";
  const cidadeEmpresa = [empresa?.cidade, empresa?.uf].filter(Boolean).join(" - ") || "Paulínia - SP";
  const cepEmpresa = empresa?.cep || "13145-706";
  const cnpjEmpresa = empresa?.cnpj || "53.078.538/0001-85";
  const foneEmpresa = empresa?.telefone || "(19) 99898-2930";
  const cnpjEmpresaFmt = cpfCnpjMask(cnpjEmpresa);
  const cepEmpresaFmt = cepMask(cepEmpresa);
  const foneEmpresaFmt = phoneMask(foneEmpresa);
  const clienteDocFmt = cliente.cpf_cnpj ? cpfCnpjMask(cliente.cpf_cnpj) : "—";
  const clienteCepFmt = cliente.cep ? cepMask(cliente.cep) : "—";
  const clienteFoneFmt = cliente.telefone ? phoneMask(cliente.telefone) : "—";
  const clienteCelFmt = cliente.celular ? phoneMask(cliente.celular) : "—";

  // Tipografia helpers — projeto inteiro usa Montserrat (inclusive PDF).
  // Para colunas/valores numéricos, herdamos Montserrat e ativamos tabular-nums.
  const mono: React.CSSProperties = {
    fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif",
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"tnum" 1, "zero" 0',
    lineHeight: 1.5,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "8.5px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 600,
    color: MUTED,
    lineHeight: 1.5,
    paddingBottom: "1px",
  };
  const valueStyle: React.CSSProperties = {
    fontSize: "10.5px",
    fontWeight: 500,
    color: INK,
    lineHeight: 1.6,
    paddingBottom: "4px",
    minWidth: 0,
    wordBreak: "break-word",
  };

  // Componente Field stacked (label + valor)
  const Field = ({ label, value, monoValue = false, align = "left" as "left" | "right", title }: {
    label: string; value: React.ReactNode; monoValue?: boolean; align?: "left" | "right"; title?: string;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, textAlign: align }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...valueStyle, ...(monoValue ? mono : null) }} title={title}>{value}</span>
    </div>
  );

  // SVG placeholder do logo (será substituído pelo asset real do cliente)
  const AvizeeLogo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{
        fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "32px",
        letterSpacing: "0.04em", color: PRIMARY, lineHeight: 1,
      }}>AVIZEE</span>
      <svg viewBox="0 0 40 40" width="23" height="23" aria-hidden="true">
        <circle cx="20" cy="20" r="14" fill="none" stroke={SECONDARY} strokeWidth="2.2" />
        <path d="M14 22 Q20 12 28 18 Q26 24 20 24 L18 28" stroke={SECONDARY} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="26" cy="17" r="1.4" fill={SECONDARY} />
      </svg>
    </div>
  );

  // Cabeçalho da tabela
  const thBase: React.CSSProperties = {
    background: PRIMARY, color: "#fff",
    padding: "8px 10px", fontWeight: 700,
    fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.12em",
  };
  const tdBase: React.CSSProperties = {
    padding: "0 10px", height: "36px",
    borderBottom: `1px solid ${SOFTRULE}`, color: INK,
    verticalAlign: "middle",
  };

  return (
    <div ref={ref} style={{
      width: "210mm", minHeight: "297mm", padding: "42px",
      fontFamily: "'Montserrat', system-ui, sans-serif", fontSize: "11px",
      color: INK, background: "#fff", boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: "20px",
      position: "relative",
    }}>
      {/* 4.1 — Cabeçalho: 3 células em uma única caixa */}
      <div style={{
        border: `1px solid ${RULE}`, borderRadius: "4px", overflow: "hidden",
        display: "grid", gridTemplateColumns: "auto 1fr 200px",
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 24px", borderRight: `1px solid ${RULE}`, display: "flex", alignItems: "center" }}>
          {empresa?.logo_url ? (
            <img src={empresa.logo_url} alt={empresa?.nome_fantasia || "AviZee"} style={{ maxHeight: "46px", maxWidth: "180px", objectFit: "contain" }} />
          ) : (
            <AvizeeLogo />
          )}
        </div>
        {/* Empresa */}
        <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: "12.5px", fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>{empresaNome}</div>
          <div style={{ marginTop: "4px", color: MUTED, fontSize: "10.5px", lineHeight: 1.55 }}>
            <div>{enderecoEmpresa}</div>
            <div>Fone: <span style={mono}>{foneEmpresaFmt}</span></div>
            <div>{cidadeEmpresa} · CEP: <span style={mono}>{cepEmpresaFmt}</span></div>
            <div>CNPJ: <span style={mono}>{cnpjEmpresaFmt}</span></div>
          </div>
        </div>
        {/* Nº / Data */}
        <div style={{ borderLeft: `1px solid ${RULE}`, display: "grid", gridTemplateRows: "auto auto auto auto" }}>
          <div style={{ padding: "6px 10px 2px", textAlign: "center", borderBottom: `1px solid ${SOFTRULE}`, ...labelStyle }}>Orçamento</div>
          <div style={{ padding: "4px 10px 8px", textAlign: "center", borderBottom: `1px solid ${RULE}` }}>
            <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1, color: SECONDARY }}>
              Nº <span style={mono}>{numeroDisplay}</span>
            </span>
          </div>
          <div style={{ padding: "6px 10px 2px", textAlign: "center", borderBottom: `1px solid ${SOFTRULE}`, ...labelStyle }}>Data</div>
          <div style={{ padding: "4px 10px 8px", textAlign: "center", ...mono, fontSize: "13px", fontWeight: 600, color: INK }}>
            {formatDate(data)}
          </div>
        </div>
      </div>

      {/* 4.2 — Cliente */}
      <div style={{ border: `1px solid ${RULE}`, borderRadius: "4px", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Headline row */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "20px", alignItems: "end", paddingBottom: "12px", borderBottom: `1px solid ${SOFTRULE}` }}>
          <Field label="Cód.cliente" value={cliente.codigo || "—"} monoValue />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={labelStyle}>Cliente</span>
            <span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.01em", color: INK, lineHeight: 1.2 }}>
              {cliente.nome_razao_social || "—"}
            </span>
          </div>
          <Field label="Fantasia" value={cliente.nome_fantasia || "—"} align="right" />
        </div>
        {/* Detalhes em grid 4 col */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 1fr 1.6fr", columnGap: "20px", rowGap: "10px" }}>
          <Field label="Endereço" value={[cliente.logradouro, cliente.numero].filter(Boolean).join(", ") || "—"} title={[cliente.logradouro, cliente.numero].filter(Boolean).join(", ")} />
          <Field label="Bairro" value={cliente.bairro || "—"} />
          <Field label={`Cidade${cliente.uf ? " / UF" : ""}`} value={[cliente.cidade, cliente.uf].filter(Boolean).join(" / ") || "—"} />
          <Field label="E-mail" value={<span style={{ whiteSpace: "normal", wordBreak: "break-all" }}>{cliente.email || "—"}</span>} title={cliente.email} />
          <Field label="CNPJ / CPF" value={clienteDocFmt} monoValue />
          <Field label="I.E." value={cliente.inscricao_estadual || "—"} monoValue />
          <Field label="CEP" value={clienteCepFmt} monoValue />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", minWidth: 0 }}>
            <Field label="Fone" value={clienteFoneFmt} monoValue />
            <Field label="Celular" value={clienteCelFmt} monoValue />
          </div>
        </div>
      </div>

      {/* 4.3 — Tabela de Itens */}
      <div style={{ border: `1px solid ${RULE}`, borderRadius: "4px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: "left", width: "76px" }}>Código</th>
              <th style={{ ...thBase, textAlign: "left" }}>Descrição</th>
              <th style={{ ...thBase, textAlign: "left", width: "96px" }}>Variação</th>
              <th style={{ ...thBase, textAlign: "right", width: "54px" }}>Qtd.</th>
              <th style={{ ...thBase, textAlign: "left", width: "40px" }}>Un.</th>
              <th style={{ ...thBase, textAlign: "right", width: "102px" }}>Unit.</th>
              <th style={{ ...thBase, textAlign: "right", width: "112px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {realItems.map((item, idx) => (
              <tr key={`r-${idx}`}>
                <td style={{ ...tdBase, ...mono, fontSize: "10.5px", fontWeight: 600, color: SECONDARY }}>{item.codigo_snapshot}</td>
                <td style={{ ...tdBase, fontWeight: 600 }}>{item.descricao_snapshot}</td>
                <td style={{ ...tdBase, color: MUTED }}>{item.variacao || ""}</td>
                <td style={{ ...tdBase, ...mono, textAlign: "right", fontWeight: 600 }}>{item.quantidade || ""}</td>
                <td style={{ ...tdBase, ...mono, color: MUTED }}>{item.unidade}</td>
                <td style={{ ...tdBase, ...mono, textAlign: "right" }}>{item.valor_unitario ? fmtMoney(item.valor_unitario) : ""}</td>
                <td style={{ ...tdBase, ...mono, textAlign: "right", fontWeight: 700 }}>{item.valor_total ? fmtMoney(item.valor_total) : ""}</td>
              </tr>
            ))}
            {Array.from({ length: fillerRows }).map((_, idx) => (
              <tr key={`f-${idx}`}>
                <td style={{ ...tdBase }}>&nbsp;</td>
                <td style={tdBase}></td><td style={tdBase}></td><td style={tdBase}></td>
                <td style={tdBase}></td><td style={tdBase}></td><td style={tdBase}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4.4 — Totais */}
      <div style={{
        border: `1px solid ${RULE}`, borderRadius: "4px", overflow: "hidden", background: "#fff",
        display: "grid", gridTemplateColumns: "repeat(6, 1fr) 1.9fr",
      }}>
        {[
          { label: "Produtos", value: totalProdutos },
          { label: "(−) Desconto", value: desconto },
          { label: "(+) Imp. S.T.", value: impostoSt },
          { label: "(+) Imp. IPI", value: impostoIpi },
          { label: "(+) Frete", value: freteValor },
          { label: "(+) Outras", value: outrasDespesas },
        ].map((cell, i) => (
          <div key={cell.label} style={{
            padding: "10px", display: "flex", flexDirection: "column", gap: "4px",
            minWidth: 0, borderRight: i < 5 ? `1px solid ${SOFTRULE}` : `1px solid ${SOFTRULE}`,
          }}>
            <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.label}</span>
            <span style={{ ...mono, fontSize: "11.5px", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{fmtMoney(cell.value)}</span>
          </div>
        ))}
        <div style={{
          background: PRIMARY, color: "#fff", padding: "10px 18px",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px",
        }}>
          <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Valor Total</span>
          <span style={{ ...mono, fontSize: "22px", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap" }}>{fmtMoney(valorTotal)}</span>
        </div>
      </div>

      {/* 4.5 — Meta (sem caixa) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", columnGap: "18px", rowGap: "8px", padding: "0 4px" }}>
        <Field label="Quantidade" value={quantidadeTotal} monoValue />
        <Field label="Peso (kg)" value={pesoTotal.toFixed(2)} monoValue />
        <Field label="Pagamento" value={paymentLabel[pagamento] || pagamento || "—"} />
        <Field label="Prazo" value={prazoPagamento || "—"} monoValue />
        <Field label="Entrega" value={prazoEntrega || "—"} />
        <Field label="Frete" value={freteTipo || "—"} />
        <Field label="Tipo" value={modalidade || "—"} />
      </div>

      {/* 4.6 — Spacer flexível */}
      <div style={{ flex: 1 }} />

      {/* 4.7 — Observações */}
      <div>
        <div style={{ ...labelStyle, marginBottom: "6px" }}>Observações</div>
        <div style={{
          border: `1px solid ${RULE}`, borderRadius: "4px",
          minHeight: "64px", padding: "10px 12px", background: TINTDEEP,
          fontSize: "10.5px", color: INK, lineHeight: 1.55, whiteSpace: "pre-wrap",
        }}>
          {observacoes || "\u00A0"}
        </div>
      </div>

      {/* 4.8 — Rodapé interno */}
      <div style={{
        display: "flex", justifyContent: "space-between", paddingTop: "6px",
        borderTop: `1px solid ${SOFTRULE}`,
        fontSize: "8.5px", color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
      }}>
        <span>{empresaNome} · Orçamento Nº <span style={mono}>{numeroDisplay}</span></span>
        <span>Documento gerado em <span style={mono}>{formatDate(data)}</span></span>
      </div>
    </div>
  );
});

OrcamentoPdfTemplateBrand.displayName = "OrcamentoPdfTemplateBrand";
