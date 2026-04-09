import { supabase } from "@/integrations/supabase/client";
import { downloadTextFile } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getEffectiveFiscalId } from "@/lib/fiscalUtils";

export type TipoRelatorio = "estoque" | "movimentos_estoque" | "financeiro" | "fluxo_caixa" | "vendas" | "compras" | "aging" | "dre" | "curva_abc" | "margem_produtos" | "estoque_minimo" | "vendas_cliente" | "compras_fornecedor" | "divergencias" | "faturamento";

export interface FiltroRelatorio {
  dataInicio?: string;
  dataFim?: string;
  clienteIds?: string[];
  fornecedorIds?: string[];
  grupoProdutoIds?: string[];
  tiposFinanceiros?: string[];
}

export interface RelatorioResultado<T = Record<string, unknown>> {
  title: string;
  subtitle: string;
  rows: T[];
  chartData?: Array<{ name: string; value: number }>;
  totals?: Record<string, number>;
  /** Rich KPI values keyed by the ReportKpiDef.key for the current report */
  kpis?: Record<string, number>;
  _isQuantityReport?: boolean;
  _isDreReport?: boolean;
}

/**
 * Adds a `participacao` (% share of total) field to each row in a ranking.
 * Rounds to one decimal place.
 */
function addParticipacao<T extends { valorTotal: number }>(rows: T[], grandTotal: number): (T & { participacao: number })[] {
  return rows.map((r) => ({
    ...r,
    participacao: grandTotal > 0 ? Number(((r.valorTotal / grandTotal) * 100).toFixed(1)) : 0,
  }));
}

/**
 * Computes top-N concentration (% of grand total held by the first N items).
 */
function computeTop5Concentracao(rows: { valorTotal: number }[], grandTotal: number): number {
  if (grandTotal <= 0) return 0;
  const top5Total = rows.slice(0, 5).reduce((s, r) => s + r.valorTotal, 0);
  return Number(((top5Total / grandTotal) * 100).toFixed(1));
}

function withDateRange(query: any, column: string, filtros: FiltroRelatorio) {
  let next = query;

  if (filtros.dataInicio) {
    next = next.gte(column, filtros.dataInicio);
  }

  if (filtros.dataFim) {
    next = next.lte(column, filtros.dataFim);
  }

  return next;
}

export async function carregarRelatorio(tipo: TipoRelatorio, filtros: FiltroRelatorio = {}): Promise<RelatorioResultado> {
  switch (tipo) {
    case "estoque": {
      let query = supabase
        .from("produtos")
        .select("codigo_interno, nome, unidade_medida, estoque_atual, estoque_minimo, preco_custo, preco_venda, grupos_produto(nome)")
        .eq("ativo", true)
        .order("nome");
      if (filtros.grupoProdutoIds) query = query.in('grupo_id', filtros.grupoProdutoIds);
      const { data, error } = await query;

      if (error) throw error;

      const rows = (data || []).map((item: any) => {
        const qty = Number(item.estoque_atual || 0);
        const min = Number(item.estoque_minimo || 0);
        const custo = Number(item.preco_custo || 0);
        const venda = Number(item.preco_venda || 0);
        let criticidade: string;
        if (qty <= 0) criticidade = "Zerado";
        else if (min > 0 && qty <= min) criticidade = "Abaixo do mínimo";
        else criticidade = "OK";
        return {
          codigo: item.codigo_interno || "-",
          produto: item.nome,
          grupo: (item.grupos_produto as { nome: string } | null)?.nome || "-",
          unidade: item.unidade_medida || "UN",
          estoqueAtual: qty,
          estoqueMinimo: min,
          criticidade,
          custoUnit: custo,
          vendaUnit: venda,
          totalCusto: qty * custo,
          totalVenda: qty * venda,
        };
      });

      const totalItens = rows.length;
      const totalQtd = rows.reduce((s, r) => s + r.estoqueAtual, 0);
      const totalCusto = rows.reduce((s, r) => s + r.totalCusto, 0);
      const totalVenda = rows.reduce((s, r) => s + r.totalVenda, 0);
      const itensZerados = rows.filter((r) => r.criticidade === "Zerado").length;
      const itensCriticos = rows.filter((r) => r.criticidade === "Abaixo do mínimo").length;

      return {
        title: "Posição de Estoque",
        subtitle: "Saldo atual, custo unitário, preço de venda e criticidade por produto.",
        rows,
        chartData: [
          { name: "Zerado", value: itensZerados },
          { name: "Abaixo do mínimo", value: itensCriticos },
          { name: "Estoque OK", value: rows.filter((r) => r.criticidade === "OK").length },
        ],
        totals: { totalQtd, totalCusto, totalVenda },
        kpis: { totalItens, totalQtd, totalCusto, itensCriticos, itensZerados },
      };
    }

    case "movimentos_estoque": {
      let query = supabase
        .from("estoque_movimentos")
        .select("tipo, quantidade, saldo_anterior, saldo_atual, documento_tipo, motivo, created_at, produtos(nome, codigo_interno)")
        .order("created_at", { ascending: false });

      query = withDateRange(query, "created_at", filtros);
      if (filtros.grupoProdutoIds) query = query.in('produto_id', (
        await supabase.from('produtos').select('id').in('grupo_id', filtros.grupoProdutoIds)
      ).data?.map(p => p.id) || []);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((item: any) => ({
        data: item.created_at,
        produto: item.produtos?.nome || "-",
        codigo: item.produtos?.codigo_interno || "-",
        tipo: item.tipo,
        quantidade: Number(item.quantidade || 0),
        saldoAnterior: Number(item.saldo_anterior || 0),
        saldoAtual: Number(item.saldo_atual || 0),
        documento: item.documento_tipo || "-",
        motivo: item.motivo || "-",
      }));

      const entradas = rows.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.quantidade, 0);
      const saidas = rows.filter((r) => r.tipo === "saida").reduce((s, r) => s + r.quantidade, 0);
      const ajustes = rows.filter((r) => r.tipo === "ajuste").reduce((s, r) => s + r.quantidade, 0);
      const saldoFinal = rows.length > 0 ? rows[0].saldoAtual : 0;

      return {
        title: "Movimentos de estoque",
        subtitle: "Entradas, saídas e ajustes de estoque no período.",
        rows,
        chartData: [
          { name: "Entradas", value: entradas },
          { name: "Saídas", value: Math.abs(saidas) },
          { name: "Ajustes", value: Math.abs(ajustes) },
        ],
        totals: {
          totalEntradas: entradas,
          totalSaidas: Math.abs(saidas),
          totalAjustes: Math.abs(ajustes),
          saldoAtual: saldoFinal,
        },
        kpis: {
          totalMovimentos: rows.length,
          totalEntradas: entradas,
          totalSaidas: Math.abs(saidas),
          totalAjustes: Math.abs(ajustes),
        },
        _isQuantityReport: true,
      };
    }

    case "financeiro": {
      let query = supabase
        .from("financeiro_lancamentos")
        .select("tipo, descricao, valor, saldo_restante, valor_pago, status, data_vencimento, data_pagamento, banco, forma_pagamento, clientes(nome_razao_social), fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .order("data_vencimento", { ascending: true });

      query = withDateRange(query, "data_vencimento", filtros);
      if (filtros.tiposFinanceiros) query = query.in('tipo', filtros.tiposFinanceiros as any);
      const { data, error } = await query;
      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const rows = (data || []).map((item: any) => {
        const valor = Number(item.valor || 0);
        const valorEmAberto = item.saldo_restante != null
          ? Number(item.saldo_restante)
          : item.status === 'pago' ? 0 : valor;
        const venc = item.data_vencimento ? new Date(item.data_vencimento) : null;
        const atraso = (venc && item.status !== 'pago' && venc < hoje)
          ? Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const parceiro = item.tipo === 'receber'
          ? (item.clientes as { nome_razao_social: string } | null)?.nome_razao_social || '-'
          : (item.fornecedores as { nome_razao_social: string } | null)?.nome_razao_social || '-';
        return {
          tipo: item.tipo === 'receber' ? 'Receber' : 'Pagar',
          parceiro,
          descricao: item.descricao || "-",
          valor,
          valorEmAberto,
          atraso,
          status: item.status || "-",
          vencimento: item.data_vencimento,
          pagamento: item.data_pagamento,
          banco: item.banco || "-",
          formaPagamento: item.forma_pagamento || "-",
        };
      });

      const totalReceber = rows.filter((r) => r.tipo === 'Receber' && r.status !== 'pago').reduce((s, r) => s + r.valorEmAberto, 0);
      const totalPagar = rows.filter((r) => r.tipo === 'Pagar' && r.status !== 'pago').reduce((s, r) => s + r.valorEmAberto, 0);
      const totalVencido = rows.filter((r) => r.atraso > 0).reduce((s, r) => s + r.valorEmAberto, 0);
      const totalPago = rows.filter((r) => r.status === 'pago').reduce((s, r) => s + r.valor, 0);

      return {
        title: "Contas a Pagar e Receber",
        subtitle: "Títulos financeiros por tipo, status, parceiro e vencimento.",
        rows,
        chartData: [
          { name: "A Receber", value: totalReceber },
          { name: "A Pagar", value: totalPagar },
          { name: "Vencido", value: totalVencido },
          { name: "Pago", value: totalPago },
        ],
        kpis: { totalReceber, totalPagar, totalVencido, totalPago },
      };
    }

    case "fluxo_caixa": {
      let query = supabase
        .from("financeiro_lancamentos")
        .select("tipo, descricao, valor, status, data_vencimento, data_pagamento")
        .eq("ativo", true)
        .order("data_vencimento", { ascending: true });

      query = withDateRange(query, "data_vencimento", filtros);
      const { data, error } = await query;
      if (error) throw error;

      let saldo = 0;
      const rows = (data || []).map((item: any) => {
        const valor = Number(item.valor || 0);
        saldo += item.tipo === "receber" ? valor : -valor;

        return {
          data: item.data_pagamento || item.data_vencimento,
          descricao: item.descricao || "-",
          tipo: item.tipo,
          status: item.status || "-",
          entrada: item.tipo === "receber" ? valor : 0,
          saida: item.tipo === "pagar" ? valor : 0,
          saldo,
        };
      });

      const totalEntradas = rows.reduce((s, r) => s + r.entrada, 0);
      const totalSaidas = rows.reduce((s, r) => s + r.saida, 0);
      const saldoFinal = rows.length > 0 ? rows[rows.length - 1].saldo : 0;

      return {
        title: "Fluxo de caixa",
        subtitle: "Entradas, saídas e saldo acumulado por período.",
        rows,
        chartData: rows.slice(0, 12).map((row: any) => ({
          name: row.data ? formatDate(row.data) : "-",
          value: row.saldo,
        })),
        totals: {
          totalEntradas,
          totalSaidas,
          saldoFinal,
        },
        kpis: { totalEntradas, totalSaidas, saldoFinal },
      };
    }

    case "vendas": {
      let query = supabase
        .from("ordens_venda")
        .select("numero, data_emissao, valor_total, status, status_faturamento, clientes(nome_razao_social)")
        .eq("ativo", true)
        .order("data_emissao", { ascending: false });

      query = withDateRange(query, "data_emissao", filtros);
      if (filtros.clienteIds) query = query.in('cliente_id', filtros.clienteIds);
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((item: any) => ({
        numero: item.numero,
        cliente: item.clientes?.nome_razao_social || "-",
        emissao: item.data_emissao,
        valor: Number(item.valor_total || 0),
        status: item.status || "-",
        faturamento: item.status_faturamento || "-",
      }));

      const totalVendido = rows.reduce((s, r) => s + r.valor, 0);
      const qtdPedidos = rows.length;
      const ticketMedio = qtdPedidos > 0 ? totalVendido / qtdPedidos : 0;
      const aguardandoFaturamento = rows.filter((r) => r.faturamento === 'aguardando' || r.faturamento === '-').length;

      return {
        title: "Vendas por período",
        subtitle: "Ordens de venda emitidas com status comercial e faturamento.",
        rows,
        chartData: [
          { name: "Aguardando", value: rows.filter((row) => row.faturamento === "aguardando").reduce((sum, row) => sum + row.valor, 0) },
          { name: "Parcial", value: rows.filter((row) => row.faturamento === "parcial").reduce((sum, row) => sum + row.valor, 0) },
          { name: "Total", value: rows.filter((row) => row.faturamento === "total").reduce((sum, row) => sum + row.valor, 0) },
        ],
        kpis: { totalVendido, qtdPedidos, ticketMedio, aguardandoFaturamento },
      };
    }

    case "faturamento": {
      let query = supabase
        .from("notas_fiscais")
        .select(`
          numero, serie, data_emissao, valor_total, modelo_documento,
          frete_valor, icms_valor, ipi_valor, pis_valor, cofins_valor,
          icms_st_valor, desconto_valor, outras_despesas,
          forma_pagamento, status,
          clientes(nome_razao_social),
          ordens_venda(numero)
        `)
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("status", "confirmada")
        .order("data_emissao", { ascending: false });

      query = withDateRange(query, "data_emissao", filtros);
      if (filtros.clienteIds) query = query.in('cliente_id', filtros.clienteIds);
      const { data, error } = await query;
      if (error) throw error;

      const modeloLabels: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', 'nfse': 'NFS-e' };

      const rows = (data || []).map((nf) => {
        const totalImpostos = Number(nf.icms_valor || 0) + Number(nf.ipi_valor || 0) +
          Number(nf.pis_valor || 0) + Number(nf.cofins_valor || 0) + Number(nf.icms_st_valor || 0);
        const valorTotal = Number(nf.valor_total || 0);
        const cliente = nf.clientes as { nome_razao_social: string } | null;
        const ov = nf.ordens_venda as { numero: string } | null;

        return {
          data: nf.data_emissao,
          nf: `${nf.numero}/${nf.serie || '1'}`,
          modelo: modeloLabels[nf.modelo_documento || '55'] || nf.modelo_documento || 'NF-e',
          cliente: cliente?.nome_razao_social || '—',
          ov: ov?.numero || '—',
          frete: Number(nf.frete_valor || 0),
          desconto: Number(nf.desconto_valor || 0),
          impostos: totalImpostos,
          valorTotal,
          receitaLiquida: valorTotal - totalImpostos,
        };
      });

      const totalBruto = rows.reduce((s, r) => s + r.valorTotal, 0);
      const totalImpostos = rows.reduce((s, r) => s + r.impostos, 0);
      const totalLiquido = rows.reduce((s, r) => s + r.receitaLiquida, 0);

      const byMonth = new Map<string, number>();
      rows.forEach(r => {
        const m = r.data.slice(0, 7);
        byMonth.set(m, (byMonth.get(m) || 0) + r.valorTotal);
      });

      return {
        title: "Faturamento",
        subtitle: "Notas fiscais de saída confirmadas — valor bruto, impostos e receita líquida.",
        rows,
        chartData: Array.from(byMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, value]) => ({
            name: new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            value,
          })),
        totals: { totalBruto, totalImpostos, totalLiquido },
        kpis: { totalNotas: rows.length, totalBruto, totalImpostos, totalLiquido },
      };
    }

    case "compras": {
      let query = supabase
        .from("compras")
        .select("numero, data_compra, data_entrega_prevista, data_entrega_real, valor_total, status, fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .order("data_compra", { ascending: false });

      query = withDateRange(query, "data_compra", filtros);
      if (filtros.fornecedorIds) query = query.in('fornecedor_id', filtros.fornecedorIds);
      const { data, error } = await query;
      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const rows = (data || []).map((item: any) => {
        const prevista = item.data_entrega_prevista ? new Date(item.data_entrega_prevista) : null;
        const entregaReal = item.data_entrega_real;
        const statusVal = item.status || '-';
        const emAberto = ['pendente', 'aprovado', 'em_transito'].includes(statusVal);
        const atraso = (prevista && emAberto && prevista < hoje)
          ? Math.floor((hoje.getTime() - prevista.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          numero: item.numero,
          fornecedor: (item.fornecedores as { nome_razao_social: string } | null)?.nome_razao_social || "-",
          compra: item.data_compra,
          prevista: item.data_entrega_prevista,
          entrega: entregaReal,
          valor: Number(item.valor_total || 0),
          atraso,
          status: statusVal,
        };
      });

      const totalComprado = rows.reduce((s, r) => s + r.valor, 0);
      const emAberto = rows.filter((r) => ['pendente', 'aprovado', 'em_transito'].includes(r.status)).length;
      const atrasadas = rows.filter((r) => r.atraso > 0).length;

      return {
        title: "Compras",
        subtitle: "Pedidos de compra — entrega prevista, real e situação.",
        rows,
        chartData: rows.slice(0, 8).map((row: any) => ({
          name: row.fornecedor,
          value: row.valor,
        })),
        kpis: { qtdCompras: rows.length, totalComprado, emAberto, atrasadas },
      };
    }

    case "dre": {
      let receitaQuery = supabase
        .from("financeiro_lancamentos")
        .select("valor")
        .eq("ativo", true)
        .eq("tipo", "receber")
        .eq("status", "pago");
      receitaQuery = withDateRange(receitaQuery, "data_pagamento", filtros);

      let pagosQuery = supabase
        .from("financeiro_lancamentos")
        .select("valor, descricao, nota_fiscal_id")
        .eq("ativo", true)
        .eq("tipo", "pagar")
        .eq("status", "pago");
      pagosQuery = withDateRange(pagosQuery, "data_pagamento", filtros);

      let nfSaidaQuery = supabase
        .from("notas_fiscais")
        .select("icms_valor, pis_valor, cofins_valor, ipi_valor")
        .eq("ativo", true)
        .eq("tipo", "saida");
      nfSaidaQuery = withDateRange(nfSaidaQuery, "data_emissao", filtros);

      const [{ data: receitas }, { data: pagos }, { data: nfSaida }] = await Promise.all([
        receitaQuery, pagosQuery, nfSaidaQuery,
      ]);

      if (!receitas && !pagos && !nfSaida) throw new Error("Erro ao carregar dados do DRE");

      const receitaBruta = (receitas || []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

      const deducoes = (nfSaida || []).reduce((s: number, nf: any) => {
        return s + Number(nf.icms_valor || 0) + Number(nf.pis_valor || 0) + Number(nf.cofins_valor || 0) + Number(nf.ipi_valor || 0);
      }, 0);

      const receitaLiquida = receitaBruta - deducoes;

      const cmv = (pagos || []).filter((p: any) =>
        p.nota_fiscal_id || (p.descricao || "").toLowerCase().includes("compra")
      ).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const despesasOp = (pagos || []).filter((p: any) =>
        !p.nota_fiscal_id && !(p.descricao || "").toLowerCase().includes("compra")
      ).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const resultado = receitaLiquida - cmv - despesasOp;

      const rows = [
        { linha: "Receita Bruta", valor: receitaBruta, tipo: "header" },
        { linha: "(–) Deduções s/ Receita", valor: deducoes, tipo: "deducao" },
        { linha: "= Receita Líquida", valor: receitaLiquida, tipo: "subtotal" },
        { linha: "(–) CMV / CPV", valor: cmv, tipo: "deducao" },
        { linha: "= Lucro Bruto", valor: receitaLiquida - cmv, tipo: "subtotal" },
        { linha: "(–) Despesas Operacionais", valor: despesasOp, tipo: "deducao" },
        { linha: "= Resultado do Exercício", valor: resultado, tipo: "resultado" },
      ];

      return {
        title: "DRE — Demonstrativo de Resultado",
        subtitle: "Receitas, deduções, custos e resultado do exercício.",
        rows,
        chartData: [
          { name: "Receita Bruta", value: receitaBruta },
          { name: "Deduções", value: deducoes },
          { name: "CMV", value: cmv },
          { name: "Despesas", value: despesasOp },
          { name: "Resultado", value: Math.max(0, resultado) },
        ],
        totals: {
          receitaBruta,
          receitaLiquida,
          resultado,
        },
        kpis: { receitaBruta, receitaLiquida, resultado },
        _isDreReport: true,
      };
    }

    case "aging":
    default: {
      let query = supabase
        .from("financeiro_lancamentos")
        .select("tipo, descricao, valor, status, data_vencimento, data_pagamento, clientes(nome_razao_social), fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido"])
        .order("data_vencimento", { ascending: true });
      query = withDateRange(query, "data_vencimento", filtros);
      if (filtros.clienteIds) query = query.in('cliente_id', filtros.clienteIds);
      if (filtros.tiposFinanceiros) query = query.in('tipo', filtros.tiposFinanceiros as any);
      const { data, error } = await query;

      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const rows = (data || []).map((item: any) => {
        const venc = new Date(item.data_vencimento);
        const diffDays = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
        let faixa = "A vencer";
        if (diffDays > 0 && diffDays <= 30) faixa = "1-30 dias";
        else if (diffDays > 30 && diffDays <= 60) faixa = "31-60 dias";
        else if (diffDays > 60 && diffDays <= 90) faixa = "61-90 dias";
        else if (diffDays > 90) faixa = "90+ dias";

        return {
          tipo: item.tipo === "receber" ? "Receber" : "Pagar",
          descricao: item.descricao || "-",
          parceiro: item.tipo === "receber"
            ? (item.clientes as { nome_razao_social: string } | null)?.nome_razao_social || "-"
            : (item.fornecedores as { nome_razao_social: string } | null)?.nome_razao_social || "-",
          valor: Number(item.valor || 0),
          vencimento: item.data_vencimento,
          diasVencido: diffDays > 0 ? diffDays : 0,
          faixa,
        };
      });

      const faixas = ["A vencer", "1-30 dias", "31-60 dias", "61-90 dias", "90+ dias"];
      const chartData = faixas.map((f) => ({
        name: f,
        value: rows.filter((r) => r.faixa === f).reduce((s, r) => s + r.valor, 0),
      }));

      const totalVencido = rows.filter((r) => r.diasVencido > 0).reduce((s, r) => s + r.valor, 0);
      const titulosVencidos = rows.filter((r) => r.diasVencido > 0).length;
      const maisAntigosDias = rows.reduce((max, r) => Math.max(max, r.diasVencido), 0);

      return {
        title: "Aging — Vencidos por faixa",
        subtitle: "Títulos a pagar e receber agrupados por faixa de vencimento.",
        rows,
        chartData,
        totals: {
          totalTitulos: rows.length,
          totalValor: rows.reduce((s, r) => s + r.valor, 0),
        },
        kpis: { totalVencido, titulosVencidos, maisAntigosDias },
      };
    }

    case "curva_abc": {
      let nfQuery = supabase
        .from("notas_fiscais_itens")
        .select(`
          produto_id,
          quantidade,
          valor_unitario,
          produtos(nome, codigo_interno),
          notas_fiscais!inner(ativo, tipo, status, data_emissao)
        `)
        .eq("notas_fiscais.ativo", true)
        .eq("notas_fiscais.tipo", "saida")
        .eq("notas_fiscais.status", "confirmada");

      nfQuery = withDateRange(nfQuery, "notas_fiscais.data_emissao", filtros);
      if (filtros.clienteIds) nfQuery = nfQuery.in('notas_fiscais.cliente_id', filtros.clienteIds);

      const { data, error } = await nfQuery;
      if (error) throw error;

      const prodMap = new Map<string, { produto: string; codigo: string; total: number }>();
      for (const item of data || []) {
        const key = item.produto_id || "sem-produto";
        const nome = (item.produtos as any)?.nome || "Produto removido";
        const codigo = (item.produtos as any)?.codigo_interno || "-";
        const existing = prodMap.get(key) || { produto: nome, codigo, total: 0 };
        const itemTotal = Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
        existing.total += itemTotal;
        prodMap.set(key, existing);
      }

      const sorted = Array.from(prodMap.values()).sort((a, b) => b.total - a.total);
      const grandTotal = sorted.reduce((s, r) => s + r.total, 0);

      let acumulado = 0;
      const rows = sorted.map((item, i) => {
        acumulado += item.total;
        const pctAcum = grandTotal > 0 ? (acumulado / grandTotal) * 100 : 0;
        const classe = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C';
        return {
          posicao: i + 1,
          codigo: item.codigo,
          produto: item.produto,
          faturamento: item.total,
          percentual: grandTotal > 0 ? ((item.total / grandTotal) * 100) : 0,
          acumulado: pctAcum,
          classe,
        };
      });

      const classA = rows.filter(r => r.classe === 'A');
      const classB = rows.filter(r => r.classe === 'B');
      const classC = rows.filter(r => r.classe === 'C');

      return {
        title: "Curva ABC de Produtos",
        subtitle: "Classificação por faturamento real — notas fiscais de saída confirmadas.",
        rows,
        chartData: [
          { name: `A (${classA.length} itens)`, value: classA.reduce((s, r) => s + r.faturamento, 0) },
          { name: `B (${classB.length} itens)`, value: classB.reduce((s, r) => s + r.faturamento, 0) },
          { name: `C (${classC.length} itens)`, value: classC.reduce((s, r) => s + r.faturamento, 0) },
        ],
        totals: { grandTotal },
        kpis: { grandTotal, itensClasseA: classA.length, itensClasseB: classB.length, itensClasseC: classC.length },
      };
    }

    case "margem_produtos": {
      let query = supabase
        .from("produtos")
        .select("codigo_interno, nome, preco_custo, preco_venda, estoque_atual, unidade_medida, grupos_produto(nome)")
        .eq("ativo", true)
        .order("nome");
      if (filtros.grupoProdutoIds) query = query.in('grupo_id', filtros.grupoProdutoIds);
      const { data, error } = await query;

      if (error) throw error;

      const rows = (data || []).map((item: any) => {
        const custo = Number(item.preco_custo || 0);
        const venda = Number(item.preco_venda || 0);
        const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
        const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
        return {
          codigo: item.codigo_interno || "-",
          produto: item.nome,
          grupo: (item.grupos_produto as { nome: string } | null)?.nome || "-",
          custUnit: custo,
          vendaUnit: venda,
          lucroUnit: venda - custo,
          margem: Number(margem.toFixed(1)),
          markup: Number(markup.toFixed(1)),
          estoque: Number(item.estoque_atual || 0),
        };
      });

      const sorted = [...rows].sort((a, b) => b.margem - a.margem);
      const mediaMargemPct = rows.length > 0 ? Number((rows.reduce((s, r) => s + r.margem, 0) / rows.length).toFixed(1)) : 0;
      const itensMargNeg = rows.filter((r) => r.margem < 0).length;
      const maiorMargem = sorted.length > 0 ? sorted[0].margem : 0;
      const menorMargem = sorted.length > 0 ? sorted[sorted.length - 1].margem : 0;

      return {
        title: "Análise de Margem de Produtos",
        subtitle: "Margem e markup por produto ativo.",
        rows: sorted,
        chartData: sorted.slice(0, 8).map(r => ({
          name: r.produto.substring(0, 20),
          value: r.margem,
        })),
        totals: { mediaMargemPct },
        kpis: { mediaMargemPct, itensMargNeg, maiorMargem, menorMargem },
      };
    }

    case "estoque_minimo": {
      let query = supabase
        .from("produtos")
        .select("codigo_interno, nome, unidade_medida, estoque_atual, estoque_minimo, preco_custo, grupos_produto(nome)")
        .eq("ativo", true)
        .order("nome");
      if (filtros.grupoProdutoIds) query = query.in('grupo_id', filtros.grupoProdutoIds);
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || [])
        .filter((p: any) => Number(p.estoque_atual || 0) <= Number(p.estoque_minimo || 0) && Number(p.estoque_minimo || 0) > 0)
        .map((p: any) => {
          const atual = Number(p.estoque_atual || 0);
          const min = Number(p.estoque_minimo || 0);
          const custo = Number(p.preco_custo || 0);
          const criticidade = atual <= 0 ? "Zerado" : "Abaixo do mínimo";
          return {
            codigo: p.codigo_interno || "-",
            produto: p.nome,
            grupo: (p.grupos_produto as { nome: string } | null)?.nome || "-",
            unidade: p.unidade_medida || "UN",
            estoqueAtual: atual,
            estoqueMinimo: min,
            deficit: min - atual,
            criticidade,
            custoReposicao: (min - atual) * custo,
          };
        });

      const itensZerados = rows.filter((r) => r.criticidade === "Zerado").length;
      const itensCriticos = rows.filter((r) => r.criticidade === "Abaixo do mínimo").length;
      const deficitTotal = rows.reduce((s, r) => s + r.deficit, 0);
      const custoTotal = rows.reduce((s, r) => s + r.custoReposicao, 0);

      return {
        title: "Estoque Abaixo do Mínimo",
        subtitle: "Produtos com estoque atual igual ou inferior ao mínimo definido.",
        rows,
        chartData: rows.slice(0, 8).map(r => ({ name: r.produto.substring(0, 20), value: r.deficit })),
        totals: { totalItens: rows.length, custoTotal },
        kpis: { itensCriticos, itensZerados, deficitTotal, custoTotal },
        _isQuantityReport: true,
      };
    }

    case "vendas_cliente": {
      let query = supabase
        .from("ordens_venda")
        .select("valor_total, clientes(nome_razao_social, cpf_cnpj)")
        .eq("ativo", true);
      query = withDateRange(query, "data_emissao", filtros);
      if (filtros.clienteIds) query = query.in('cliente_id', filtros.clienteIds);
      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, { cliente: string; cnpj: string; total: number; qtd: number }>();
      for (const ov of data || []) {
        const c = ov.clientes as { nome_razao_social: string; cpf_cnpj: string | null } | null;
        const nome = c?.nome_razao_social || "Sem cliente";
        const key = nome;
        const existing = map.get(key) || { cliente: nome, cnpj: c?.cpf_cnpj || "-", total: 0, qtd: 0 };
        existing.total += Number(ov.valor_total || 0);
        existing.qtd += 1;
        map.set(key, existing);
      }

      const rows = Array.from(map.values()).sort((a, b) => b.total - a.total).map((r, i) => ({
        posicao: i + 1, cliente: r.cliente, cnpj: r.cnpj, pedidos: r.qtd, valorTotal: r.total,
        ticketMedio: r.qtd > 0 ? r.total / r.qtd : 0,
      }));

      const totalVendido = rows.reduce((r, s) => r + s.valorTotal, 0);
      const grandTotalVcli = totalVendido;

      const rowsWithParticipacao = addParticipacao(rows, grandTotalVcli);

      const clientesAtendidos = rowsWithParticipacao.length;
      const totalPedidos = rowsWithParticipacao.reduce((s, r) => s + r.pedidos, 0);
      const ticketMedioGeral = totalPedidos > 0 ? grandTotalVcli / totalPedidos : 0;
      const top5Concentracao = computeTop5Concentracao(rowsWithParticipacao, grandTotalVcli);

      return {
        title: "Vendas por Cliente",
        subtitle: "Ranking de clientes por volume de vendas.",
        rows: rowsWithParticipacao,
        chartData: rowsWithParticipacao.slice(0, 8).map(r => ({ name: r.cliente.substring(0, 20), value: r.valorTotal })),
        kpis: { totalVendido: grandTotalVcli, clientesAtendidos, ticketMedioGeral, top5Concentracao },
      };
    }

    case "compras_fornecedor": {
      let query = supabase
        .from("compras")
        .select("valor_total, fornecedores(nome_razao_social, cpf_cnpj)")
        .eq("ativo", true);
      query = withDateRange(query, "data_compra", filtros);
      if (filtros.fornecedorIds) query = query.in('fornecedor_id', filtros.fornecedorIds);
      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, { fornecedor: string; cnpj: string; total: number; qtd: number }>();
      for (const c of data || []) {
        const f = c.fornecedores as { nome_razao_social: string; cpf_cnpj: string | null } | null;
        const nome = f?.nome_razao_social || "Sem fornecedor";
        const key = nome;
        const existing = map.get(key) || { fornecedor: nome, cnpj: f?.cpf_cnpj || "-", total: 0, qtd: 0 };
        existing.total += Number(c.valor_total || 0);
        existing.qtd += 1;
        map.set(key, existing);
      }

      const rows = Array.from(map.values()).sort((a, b) => b.total - a.total).map((r, i) => ({
        posicao: i + 1, fornecedor: r.fornecedor, cnpj: r.cnpj, pedidos: r.qtd, valorTotal: r.total,
        ticketMedio: r.qtd > 0 ? r.total / r.qtd : 0,
      }));

      const totalCompradoCf = rows.reduce((s, r) => s + r.valorTotal, 0);
      const rowsWithParticipacao = addParticipacao(rows, totalCompradoCf);

      const fornecedoresAtivos = rowsWithParticipacao.length;
      const totalPedidosCf = rowsWithParticipacao.reduce((s, r) => s + r.pedidos, 0);
      const ticketMedioGeral = totalPedidosCf > 0 ? totalCompradoCf / totalPedidosCf : 0;
      const top5Concentracao = computeTop5Concentracao(rowsWithParticipacao, totalCompradoCf);

      return {
        title: "Compras por Fornecedor",
        subtitle: "Ranking de fornecedores por volume de compras.",
        rows: rowsWithParticipacao,
        chartData: rowsWithParticipacao.slice(0, 8).map(r => ({ name: r.fornecedor.substring(0, 20), value: r.valorTotal })),
        kpis: { totalComprado: totalCompradoCf, fornecedoresAtivos, ticketMedioGeral, top5Concentracao },
      };
    }

    case "divergencias": {
      // Pedidos de compra sem NF
      const { data: pedidos } = await supabase
        .from("pedidos_compra")
        .select("numero, fornecedor_id, valor_total, status, fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["pendente", "aprovado"]);

      // Notas fiscais sem financeiro
      const { data: nfs } = await supabase
        .from("notas_fiscais")
        .select("id, numero, tipo, valor_total, data_emissao, fornecedor_id, cliente_id")
        .eq("ativo", true)
        .eq("gera_financeiro", true);

      const { data: financeiro } = await supabase
        .from("financeiro_lancamentos")
        .select("documento_fiscal_id, nota_fiscal_id")
        .eq("ativo", true);

      const nfIdsComFinanceiro = new Set(
        (financeiro || []).map((f) => getEffectiveFiscalId(f)).filter(Boolean)
      );

      const nfsSemFinanceiro = (nfs || []).filter((nf) => !nfIdsComFinanceiro.has(nf.id));

      const rows: any[] = [];

      for (const pc of pedidos || []) {
        const fornecedor = pc.fornecedores as { nome_razao_social: string } | null;
        rows.push({
          tipo: "Pedido s/ NF",
          referencia: pc.numero,
          parceiro: fornecedor?.nome_razao_social || "-",
          valor: Number(pc.valor_total || 0),
          status: pc.status,
          criticidade: "Alta",
          observacao: "Pedido de compra sem nota fiscal vinculada",
        });
      }

      for (const nf of nfsSemFinanceiro) {
        rows.push({
          tipo: "NF s/ Financeiro",
          referencia: nf.numero,
          parceiro: "-",
          valor: Number(nf.valor_total || 0),
          status: nf.tipo,
          criticidade: "Alta",
          observacao: "Nota fiscal com flag financeiro mas sem lançamento",
        });
      }

      return {
        title: "Divergências",
        subtitle: "Pedidos sem nota fiscal e notas sem lançamento financeiro.",
        rows,
        chartData: [
          { name: "Pedidos s/ NF", value: (pedidos || []).length },
          { name: "NF s/ Financeiro", value: nfsSemFinanceiro.length },
        ],
        totals: { total: rows.length },
        kpis: {
          totalDivergencias: rows.length,
          valorImpactado: rows.reduce((s, r) => s + Number(r.valor || 0), 0),
          pedidosSemNf: (pedidos || []).length,
          nfSemFinanceiro: nfsSemFinanceiro.length,
        },
      };
    }
  }
}

export function exportarCsv(title: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    downloadTextFile(`${title}.csv`, "Sem dados para exportação");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => formatCsvValue(row[header])).join(";")),
  ].join("\n");

  downloadTextFile(`${title}.csv`, csv, "text/csv;charset=utf-8");
}

export async function exportarXlsx(title: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  // write-excel-file replaces the vulnerable xlsx package.
  // It has no known CVEs and produces valid .xlsx files via the browser API.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const keys = Object.keys(rows[0]);

  // Build a 2-D cell array: header row followed by data rows.
  // Cell values are kept in their native JS types so that the library can
  // render numbers as numbers and booleans as booleans in Excel.
  type CellValue = string | number | boolean | null;
  type WriteCell = { value: CellValue; fontWeight?: "bold" };

  const headerRow: WriteCell[] = keys.map((key) => ({ value: key, fontWeight: "bold" }));

  const dataRows: WriteCell[][] = rows.map((row) =>
    keys.map((key) => {
      const v = row[key];
      if (v == null) return { value: null };
      if (typeof v === "number" || typeof v === "boolean") return { value: v };
      return { value: String(v) };
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await writeXlsxFile([headerRow, ...dataRows] as any, { fileName: `${title}.xlsx` });
}

function formatCsvValue(value: unknown) {
  if (typeof value === "number") return value.toString().replace(".", ",");
  if (value == null) return "";
  return `"${String(value).split('"').join('""')}"`;
}

export function formatCellValue(value: unknown, key: string, isQuantityReport = false) {
  if (typeof value === "number") {
    if (isQuantityReport) {
      return formatNumber(value);
    }
    if (["valor", "custo", "venda", "entrada", "saida"].some((field) => key.toLowerCase().includes(field))) {
      return formatCurrency(value);
    }

    return formatNumber(value);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }

  return value ?? "-";
}
