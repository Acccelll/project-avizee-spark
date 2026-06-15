import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import {
  listarDivergenciaPreco,
  listarNfDuplicada,
  listarGastoForaPadrao,
  type AnomaliaDivergenciaPreco,
  type AnomaliaNfDuplicada,
  type AnomaliaGastoForaPadrao,
} from "@/services/admin/anomalias.service";
import { explicarAnomalia } from "@/services/ia/sugestao.service";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function useAnomalias<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = async () => {
    setLoading(true);
    try {
      const rows = await fetcher();
      setData(rows);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading, reload };
}

function ExplicarButton({
  tipo,
  dados,
}: {
  tipo: "divergencia_preco" | "nf_duplicada" | "gasto_fora_padrao";
  dados: Record<string, unknown>;
}) {
  const [loading, setLoading] = useState(false);
  const [txt, setTxt] = useState<string | null>(null);
  const onClick = async () => {
    setLoading(true);
    try {
      const r = await explicarAnomalia({ tipo_anomalia: tipo, dados });
      setTxt(r.explicacao);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na IA.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs gap-1"
        onClick={onClick}
        disabled={loading}
      >
        <Sparkles className="h-3 w-3" /> Explicar (IA)
      </Button>
      {txt && (
        <p className="text-[11px] text-muted-foreground italic max-w-xs text-right">{txt}</p>
      )}
    </div>
  );
}

// ────────────────────────── 1. Divergência de Preço ─────────────────────────
export function DivergenciaPrecoPanel() {
  const { data, loading, reload } = useAnomalias(listarDivergenciaPreco);
  const navigate = useNavigate();

  const columns = [
    {
      key: "produto",
      label: "Produto",
      render: (r: AnomaliaDivergenciaPreco) => (
        <code className="text-xs">{r.produto_id.slice(0, 8)}…</code>
      ),
    },
    {
      key: "valor",
      label: "Valor unitário",
      render: (r: AnomaliaDivergenciaPreco) => (
        <span className="font-mono text-sm">{formatCurrency(r.valor_unitario)}</span>
      ),
    },
    {
      key: "mediana",
      label: "Mediana",
      render: (r: AnomaliaDivergenciaPreco) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatCurrency(r.mediana)}
        </span>
      ),
    },
    {
      key: "desvio",
      label: "Desvio",
      render: (r: AnomaliaDivergenciaPreco) => {
        const pct = (r.desvio_percentual * 100).toFixed(1);
        const positivo = r.desvio_percentual >= 0;
        return (
          <Badge
            className={
              positivo
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-warning/15 text-warning border-warning/30"
            }
          >
            {positivo ? "+" : ""}
            {pct}%
          </Badge>
        );
      },
    },
    {
      key: "data",
      label: "Data compra",
      render: (r: AnomaliaDivergenciaPreco) => formatDate(r.data_compra ?? ""),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (r: AnomaliaDivergenciaPreco) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => navigate(`/compras?id=${r.compra_id}`)}
          >
            Abrir compra
          </Button>
          <ExplicarButton tipo="divergencia_preco" dados={r as unknown as Record<string, unknown>} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Itens cujo preço unitário desvia ≥30% da mediana dos últimos 20 preços do mesmo produto.
        </p>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        moduleKey="anomalias-divergencia-preco"
        emptyTitle="Nenhuma divergência encontrada"
        emptyDescription="Os preços de compra estão dentro do esperado para os produtos com histórico."
      />
    </div>
  );
}

// ────────────────────────── 2. NF Duplicada ─────────────────────────────────
export function NfDuplicadaPanel() {
  const { data, loading, reload } = useAnomalias(listarNfDuplicada);
  const navigate = useNavigate();

  const columns = [
    {
      key: "motivo",
      label: "Critério",
      render: (r: AnomaliaNfDuplicada) => (
        <Badge variant="outline" className="text-xs">
          {r.motivo === "chave_acesso" ? "Chave de acesso" : "Fornec. + nº + série"}
        </Badge>
      ),
    },
    {
      key: "ref",
      label: "Referência",
      render: (r: AnomaliaNfDuplicada) =>
        r.motivo === "chave_acesso" ? (
          <code className="text-[11px] break-all">{r.chave_acesso}</code>
        ) : (
          <span className="text-xs">
            NF {r.numero}
            {r.serie ? `-${r.serie}` : ""}
          </span>
        ),
    },
    {
      key: "qtd",
      label: "Notas",
      render: (r: AnomaliaNfDuplicada) => (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30">
          {r.quantidade}
        </Badge>
      ),
    },
    {
      key: "valor",
      label: "Valor total",
      render: (r: AnomaliaNfDuplicada) => (
        <span className="font-mono text-sm">{formatCurrency(r.valor_total)}</span>
      ),
    },
    {
      key: "periodo",
      label: "Período",
      render: (r: AnomaliaNfDuplicada) =>
        r.data_emissao_min ? (
          <span className="text-xs">
            {formatDate(r.data_emissao_min)}
            {r.data_emissao_max && r.data_emissao_max !== r.data_emissao_min
              ? ` → ${formatDate(r.data_emissao_max)}`
              : ""}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (r: AnomaliaNfDuplicada) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              const first = r.nota_ids?.[0];
              if (first) navigate(`/fiscal/notas?id=${first}`);
            }}
          >
            Abrir 1ª nota
          </Button>
          <ExplicarButton tipo="nf_duplicada" dados={r as unknown as Record<string, unknown>} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Notas fiscais com mesma chave de acesso ou trio fornecedor + número + série.
        </p>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        moduleKey="anomalias-nf-duplicada"
        emptyTitle="Nenhuma NF duplicada"
        emptyDescription="Não há notas fiscais duplicadas no banco."
      />
    </div>
  );
}

// ────────────────────────── 3. Gasto fora do padrão ─────────────────────────
export function GastoForaPadraoPanel() {
  const { data, loading, reload } = useAnomalias(listarGastoForaPadrao);
  const navigate = useNavigate();

  const columns = [
    {
      key: "descricao",
      label: "Lançamento",
      render: (r: AnomaliaGastoForaPadrao) => (
        <span className="text-sm truncate max-w-[280px] block">{r.descricao ?? "—"}</span>
      ),
    },
    {
      key: "valor",
      label: "Valor",
      render: (r: AnomaliaGastoForaPadrao) => (
        <span className="font-mono text-sm font-semibold">{formatCurrency(r.valor)}</span>
      ),
    },
    {
      key: "media",
      label: "Média (90d)",
      render: (r: AnomaliaGastoForaPadrao) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatCurrency(r.media)}
        </span>
      ),
    },
    {
      key: "z",
      label: "Desvio (σ)",
      render: (r: AnomaliaGastoForaPadrao) => (
        <Badge className="bg-warning/15 text-warning border-warning/30 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {r.z_score?.toFixed(1) ?? "?"}σ
        </Badge>
      ),
    },
    {
      key: "venc",
      label: "Vencimento",
      render: (r: AnomaliaGastoForaPadrao) => formatDate(r.data_vencimento),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (r: AnomaliaGastoForaPadrao) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => navigate(`/financeiro/${r.lancamento_id}`)}
          >
            Abrir lançamento
          </Button>
          <ExplicarButton tipo="gasto_fora_padrao" dados={r as unknown as Record<string, unknown>} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Lançamentos a pagar dos últimos 90 dias acima de média + 2 desvios-padrão por conta contábil.
        </p>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        moduleKey="anomalias-gasto-fora-padrao"
        emptyTitle="Nenhum gasto fora do padrão"
        emptyDescription="Os lançamentos recentes estão dentro do desvio esperado para cada conta."
      />
    </div>
  );
}