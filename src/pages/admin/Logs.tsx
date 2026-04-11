/**
 * Página de Logs de Auditoria (módulo Admin).
 *
 * Apresenta os registros da tabela `auditoria_logs` com filtros por
 * usuário, ação, entidade e período, além de paginação e visualização
 * detalhada das mudanças (diff antes/depois).
 *
 * Utiliza o hook `useAuditLogs` para separar a lógica de dados da UI.
 */

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { ViewDrawer, ViewField, ViewSection } from "@/components/ViewDrawer";
import { SummaryCard } from "@/components/SummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, AlertTriangle, Edit, Plus, Shield, Trash2, User } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuditLogs } from "@/pages/admin/hooks/useAuditLogs";
import type { AuditLog } from "@/services/admin/audit.service";

// ─── Metadados de tabelas ─────────────────────────────────────────────────────

const TABLE_META: Record<string, { modulo: string; entidade: string }> = {
  financeiro_lancamentos: { modulo: "Financeiro", entidade: "Lançamentos" },
  financeiro_baixas: { modulo: "Financeiro", entidade: "Baixas" },
  contas_bancarias: { modulo: "Financeiro", entidade: "Contas Bancárias" },
  formas_pagamento: { modulo: "Financeiro", entidade: "Formas de Pagamento" },
  notas_fiscais: { modulo: "Fiscal", entidade: "Notas Fiscais" },
  orcamentos: { modulo: "Vendas", entidade: "Orçamentos" },
  ordens_venda: { modulo: "Vendas", entidade: "Ordens de Venda" },
  pedidos_compra: { modulo: "Compras", entidade: "Pedidos de Compra" },
  compras: { modulo: "Compras", entidade: "Compras" },
  produtos: { modulo: "Estoque", entidade: "Produtos" },
  clientes: { modulo: "Clientes", entidade: "Clientes" },
  fornecedores: { modulo: "Fornecedores", entidade: "Fornecedores" },
  remessas: { modulo: "Logística", entidade: "Remessas" },
  funcionarios: { modulo: "RH", entidade: "Funcionários" },
  profiles: { modulo: "Administração", entidade: "Usuários" },
  user_roles: { modulo: "Administração", entidade: "Perfis de Acesso" },
  empresa_config: { modulo: "Administração", entidade: "Config. da Empresa" },
  app_configuracoes: { modulo: "Administração", entidade: "Config. do Sistema" },
};

function getTableMeta(tabela: string) {
  return TABLE_META[tabela] ?? { modulo: "Sistema", entidade: tabela };
}

// ─── Metadados de ação ────────────────────────────────────────────────────────

const ACAO_META: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  INSERT: { label: "Criação", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: Plus },
  UPDATE: { label: "Edição", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Edit },
  DELETE: { label: "Exclusão", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: Trash2 },
};

function getAcaoMeta(acao: string) {
  return ACAO_META[acao] ?? { label: acao, color: "bg-muted text-muted-foreground", icon: Shield };
}

// ─── Criticidade ──────────────────────────────────────────────────────────────

const SENSITIVE_TABLES = new Set([
  "profiles", "user_roles", "empresa_config", "app_configuracoes",
  "notas_fiscais", "financeiro_lancamentos", "financeiro_baixas",
]);

type Criticality = "alta" | "media" | "baixa";

function getCriticality(log: AuditLog): Criticality {
  if (log.acao === "DELETE") return "alta";
  if (SENSITIVE_TABLES.has(log.tabela)) return "alta";
  if (log.acao === "UPDATE") return "media";
  return "baixa";
}

const CRITICALITY_STYLE: Record<Criticality, { label: string; badgeClass: string }> = {
  alta: { label: "Alta", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200" },
  media: { label: "Média", badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200" },
  baixa: { label: "Baixa", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200" },
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ActionBadge({ acao }: { acao: string }) {
  const meta = getAcaoMeta(acao);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function CriticalityBadge({ log }: { log: AuditLog }) {
  const crit = getCriticality(log);
  const style = CRITICALITY_STYLE[crit];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.badgeClass}`}>
      {style.label}
    </span>
  );
}

function DiffViewer({ anterior, novo }: { anterior: unknown; novo: unknown }) {
  if (!anterior && !novo) return null;

  if (anterior && novo && typeof anterior === "object" && typeof novo === "object") {
    const ant = anterior as Record<string, unknown>;
    const nvo = novo as Record<string, unknown>;
    const allKeys = Array.from(new Set([...Object.keys(ant), ...Object.keys(nvo)]));
    const changed = allKeys.filter((k) => JSON.stringify(ant[k]) !== JSON.stringify(nvo[k]));

    if (changed.length > 0) {
      return (
        <ViewSection title="Campos Alterados">
          <div className="space-y-2">
            {changed.map((key) => (
              <div key={key} className="rounded-md border p-2 text-sm">
                <p className="font-medium text-muted-foreground mb-1 font-mono text-xs">{key}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-red-50 dark:bg-red-900/20 p-1.5 text-xs break-all">
                    <span className="text-muted-foreground block text-[10px] mb-0.5">Antes</span>
                    {JSON.stringify(ant[key]) ?? "—"}
                  </div>
                  <div className="rounded bg-green-50 dark:bg-green-900/20 p-1.5 text-xs break-all">
                    <span className="text-muted-foreground block text-[10px] mb-0.5">Depois</span>
                    {JSON.stringify(nvo[key]) ?? "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      );
    }
  }

  return (
    <ViewSection title="Dados do Evento">
      {anterior && (
        <ViewField label="Dados Anteriores">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(anterior, null, 2)}</pre>
        </ViewField>
      )}
      {novo && (
        <ViewField label="Dados Novos">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(novo, null, 2)}</pre>
        </ViewField>
      )}
    </ViewSection>
  );
}

// ─── Colunas da tabela ────────────────────────────────────────────────────────

const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: "created_at",
    header: "Data/Hora",
    cell: ({ row }) => (
      <span className="text-sm">
        {new Date(row.original.created_at).toLocaleString("pt-BR")}
      </span>
    ),
  },
  {
    accessorKey: "acao",
    header: "Ação",
    cell: ({ row }) => <ActionBadge acao={row.original.acao} />,
  },
  {
    accessorKey: "tabela",
    header: "Entidade",
    cell: ({ row }) => {
      const meta = getTableMeta(row.original.tabela);
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{meta.entidade}</span>
          <span className="text-xs text-muted-foreground">{meta.modulo}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "registro_id",
    header: "Registro",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.registro_id?.slice(0, 8) ?? "—"}…
      </span>
    ),
  },
  {
    accessorKey: "ip_address",
    header: "IP",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.ip_address ?? "—"}</span>
    ),
  },
  {
    id: "criticidade",
    header: "Criticidade",
    cell: ({ row }) => <CriticalityBadge log={row.original} />,
  },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Logs() {
  const [tabelaFilter, setTabelaFilter] = useState("");
  const [acaoFilter, setAcaoFilter] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { logs, totalCount, isLoading, isFetching, page, totalPages, setPage } = useAuditLogs({
    tabela: tabelaFilter || undefined,
    acao: acaoFilter || undefined,
  });

  const kpis = useMemo(() => ({
    total: totalCount,
    inserts: logs.filter((l) => l.acao === "INSERT").length,
    deletes: logs.filter((l) => l.acao === "DELETE").length,
    sensiveis: logs.filter((l) => getCriticality(l) === "alta").length,
  }), [logs, totalCount]);

  const selectedAcao = selected ? getAcaoMeta(selected.acao) : null;
  const selectedMeta = selected ? getTableMeta(selected.tabela) : null;

  return (
    <AppLayout>
      <ModulePage
        title="Logs de Auditoria"
        subtitle="Histórico de operações realizadas no sistema"
        icon={Shield}
        summaryCards={
          <>
            <SummaryCard title="Total de Eventos" value={String(kpis.total)} icon={Shield} variationType="neutral" />
            <SummaryCard title="Criações" value={String(kpis.inserts)} icon={Plus} variationType="positive" variant="success" />
            <SummaryCard title="Exclusões" value={String(kpis.deletes)} icon={Trash2} variationType="negative" variant="danger" />
            <SummaryCard title="Eventos Sensíveis" value={String(kpis.sensiveis)} icon={AlertTriangle} variationType="negative" variant="warning" />
          </>
        }
        filters={
          <div className="flex flex-wrap gap-2">
            <Select value={tabelaFilter} onValueChange={(v) => { setTabelaFilter(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Entidade / Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as entidades</SelectItem>
                {Object.entries(TABLE_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.entidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={acaoFilter} onValueChange={(v) => { setAcaoFilter(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Edição</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        toolbarExtra={
          isFetching && !isLoading ? (
            <span className="text-xs text-muted-foreground">Atualizando…</span>
          ) : undefined
        }
      >
        <DataTable
          columns={columns}
          data={logs}
          loading={isLoading}
          moduleKey="admin-logs"
          emptyTitle="Nenhum evento de auditoria encontrado"
          emptyDescription="Ajuste os filtros para ver os registros de auditoria."
          onView={(l) => {
            setSelected(l);
            setDrawerOpen(true);
          }}
        />

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages} — {totalCount} registros
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </ModulePage>

      {/* Drawer de detalhes */}
      <ViewDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Evento de Auditoria"
        badge={
          selectedAcao ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${selectedAcao.color}`}>
              {selectedAcao.label}
            </span>
          ) : undefined
        }
      >
        {selected && selectedMeta && (
          <div className="space-y-5">
            <ViewSection title="Identificação do Evento">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Data/Hora">
                  {new Date(selected.created_at).toLocaleString("pt-BR")}
                </ViewField>
                <ViewField label="Criticidade">
                  <CriticalityBadge log={selected} />
                </ViewField>
                <ViewField label="Módulo">
                  <Badge variant="secondary">{selectedMeta.modulo}</Badge>
                </ViewField>
                <ViewField label="Entidade">{selectedMeta.entidade}</ViewField>
                <ViewField label="Tabela Técnica">
                  <Badge variant="outline" className="font-mono text-xs">{selected.tabela}</Badge>
                </ViewField>
                <ViewField label="ID do Registro">
                  <span className="font-mono text-xs break-all">{selected.registro_id || "—"}</span>
                </ViewField>
              </div>
            </ViewSection>

            <ViewSection title="Usuário Responsável">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="ID do Usuário" className="col-span-2">
                  <span className="font-mono text-xs break-all">{selected.usuario_id || "—"}</span>
                </ViewField>
                <ViewField label="IP de Origem">
                  <span className="font-mono">{selected.ip_address || "—"}</span>
                </ViewField>
              </div>
            </ViewSection>

            <DiffViewer anterior={selected.dados_anteriores} novo={selected.dados_novos} />
          </div>
        )}
      </ViewDrawer>
    </AppLayout>
  );
}
