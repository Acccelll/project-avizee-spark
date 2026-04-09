import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { ViewDrawer, ViewField, ViewSection } from "@/components/ViewDrawer";
import { SummaryCard } from "@/components/SummaryCard";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodFilter, type Period } from "@/components/dashboard/PeriodFilter";
import { periodToDateFrom } from "@/lib/periodFilter";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  User,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  tabela: string;
  acao: string;
  registro_id: string | null;
  usuario_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados_anteriores: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados_novos: any;
  ip_address: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
}

// ─── Metadata maps ────────────────────────────────────────────────────────────

/** Maps a DB table name → human-readable module / entity labels. */
const TABLE_META: Record<string, { modulo: string; entidade: string }> = {
  // Financeiro
  financeiro_lancamentos: { modulo: "Financeiro", entidade: "Lançamentos" },
  financeiro_baixas: { modulo: "Financeiro", entidade: "Baixas" },
  contas_bancarias: { modulo: "Financeiro", entidade: "Contas Bancárias" },
  contas_contabeis: { modulo: "Financeiro", entidade: "Contas Contábeis" },
  formas_pagamento: { modulo: "Financeiro", entidade: "Formas de Pagamento" },
  caixa_movimentos: { modulo: "Caixa", entidade: "Movimentos de Caixa" },
  // Fiscal
  notas_fiscais: { modulo: "Fiscal", entidade: "Notas Fiscais" },
  notas_fiscais_itens: { modulo: "Fiscal", entidade: "Itens de NF" },
  // Vendas
  orcamentos: { modulo: "Vendas", entidade: "Orçamentos" },
  orcamentos_itens: { modulo: "Vendas", entidade: "Itens de Orçamento" },
  ordens_venda: { modulo: "Vendas", entidade: "Ordens de Venda" },
  ordens_venda_itens: { modulo: "Vendas", entidade: "Itens de OV" },
  // Compras
  pedidos_compra: { modulo: "Compras", entidade: "Pedidos de Compra" },
  pedidos_compra_itens: { modulo: "Compras", entidade: "Itens de Pedido" },
  cotacoes_compra: { modulo: "Compras", entidade: "Cotações" },
  cotacoes_compra_itens: { modulo: "Compras", entidade: "Itens de Cotação" },
  cotacoes_compra_propostas: { modulo: "Compras", entidade: "Propostas" },
  compras: { modulo: "Compras", entidade: "Compras" },
  compras_itens: { modulo: "Compras", entidade: "Itens de Compra" },
  // Estoque / Produtos
  produtos: { modulo: "Estoque", entidade: "Produtos" },
  grupos_produto: { modulo: "Estoque", entidade: "Grupos de Produto" },
  produto_composicoes: { modulo: "Estoque", entidade: "Composições" },
  produtos_fornecedores: { modulo: "Estoque", entidade: "Fornecedores do Produto" },
  precos_especiais: { modulo: "Preços", entidade: "Preços Especiais" },
  // Clientes / Fornecedores
  clientes: { modulo: "Clientes", entidade: "Clientes" },
  cliente_registros_comunicacao: { modulo: "Clientes", entidade: "Comunicações" },
  cliente_transportadoras: { modulo: "Clientes", entidade: "Transportadoras do Cliente" },
  fornecedores: { modulo: "Fornecedores", entidade: "Fornecedores" },
  grupos_economicos: { modulo: "Clientes", entidade: "Grupos Econômicos" },
  // Logística
  remessas: { modulo: "Logística", entidade: "Remessas" },
  remessa_eventos: { modulo: "Logística", entidade: "Eventos de Remessa" },
  transportadoras: { modulo: "Logística", entidade: "Transportadoras" },
  // RH
  funcionarios: { modulo: "RH", entidade: "Funcionários" },
  folha_pagamento: { modulo: "RH", entidade: "Folha de Pagamento" },
  // Administração
  profiles: { modulo: "Administração", entidade: "Usuários" },
  user_roles: { modulo: "Administração", entidade: "Perfis de Acesso" },
  empresa_config: { modulo: "Administração", entidade: "Configurações da Empresa" },
  app_configuracoes: { modulo: "Administração", entidade: "Configurações do Sistema" },
  bancos: { modulo: "Administração", entidade: "Bancos" },
  // Importação
  importacao_logs: { modulo: "Importação", entidade: "Logs de Importação" },
  importacao_lotes: { modulo: "Importação", entidade: "Lotes de Importação" },
};

function getTableMeta(tabela: string) {
  return TABLE_META[tabela] ?? { modulo: "Sistema", entidade: tabela };
}

// ─── Action labels ────────────────────────────────────────────────────────────

const ACAO_META: Record<
  string,
  { label: string; color: string; icon: typeof Plus }
> = {
  INSERT: {
    label: "Criação",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: Plus,
  },
  UPDATE: {
    label: "Edição",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Edit,
  },
  DELETE: {
    label: "Exclusão",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: Trash2,
  },
};

function getAcaoMeta(acao: string) {
  return (
    ACAO_META[acao] ?? {
      label: acao,
      color: "bg-muted text-muted-foreground",
      icon: Shield,
    }
  );
}

// ─── Criticality ──────────────────────────────────────────────────────────────

type Criticality = "alta" | "media" | "baixa";

const SENSITIVE_TABLES = new Set([
  "profiles",
  "user_roles",
  "empresa_config",
  "app_configuracoes",
  "notas_fiscais",
  "financeiro_lancamentos",
  "financeiro_baixas",
]);

function getCriticality(log: AuditLog): Criticality {
  if (log.acao === "DELETE") return "alta";
  if (SENSITIVE_TABLES.has(log.tabela)) return "alta";
  if (log.acao === "UPDATE") return "media";
  return "baixa";
}

const CRITICALITY_STYLE: Record<
  Criticality,
  { label: string; badgeClass: string }
> = {
  alta: {
    label: "Alta",
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800",
  },
  media: {
    label: "Média",
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800",
  },
  baixa: {
    label: "Baixa",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800",
  },
};

// ─── Period options for audit (backward-looking) ──────────────────────────────

const AUDIT_PERIODS: { value: Period; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "todos", label: "Todos" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionBadge({ acao }: { acao: string }) {
  const meta = getAcaoMeta(acao);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}

function CriticalityBadge({ log }: { log: AuditLog }) {
  const crit = getCriticality(log);
  const style = CRITICALITY_STYLE[crit];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.badgeClass}`}
    >
      {style.label}
    </span>
  );
}

// ─── Before/After diff viewer ─────────────────────────────────────────────────

function DiffViewer({
  anterior,
  novo,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anterior: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  novo: any;
}) {
  if (!anterior && !novo) return null;

  // Collect all changed fields when both sides exist
  if (anterior && novo) {
    const allKeys = Array.from(
      new Set([...Object.keys(anterior), ...Object.keys(novo)])
    );
    const changed = allKeys.filter(
      (k) => JSON.stringify(anterior[k]) !== JSON.stringify(novo[k])
    );

    if (changed.length > 0) {
      return (
        <ViewSection title="Campos Alterados">
          <div className="space-y-2">
            {changed.map((key) => (
              <div
                key={key}
                className="rounded-md border bg-muted/30 p-2 text-xs"
              >
                <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                  {key}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-mono text-[10px]">
                      antes
                    </span>
                    <span className="font-mono break-all text-foreground/70">
                      {anterior[key] === null || anterior[key] === undefined
                        ? "—"
                        : String(anterior[key])}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 rounded bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-mono text-[10px]">
                      depois
                    </span>
                    <span className="font-mono break-all">
                      {novo[key] === null || novo[key] === undefined
                        ? "—"
                        : String(novo[key])}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      );
    }
  }

  // Fallback: render raw JSON blocks
  return (
    <>
      {anterior && (
        <ViewSection title="Dados Anteriores">
          <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(anterior, null, 2)}
          </pre>
        </ViewSection>
      )}
      {novo && (
        <ViewSection title="Dados Novos">
          <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(novo, null, 2)}
          </pre>
        </ViewSection>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [tabelaFilter, setTabelaFilter] = useState("todas");
  const [acaoFilter, setAcaoFilter] = useState("todas");
  const [usuarioFilter, setUsuarioFilter] = useState("todos");
  const [criticalidadeFilter, setCriticalidadeFilter] = useState("todas");

  // Load profiles (for user name lookup)
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nome, email, cargo")
      .then(({ data, error }) => {
        if (!error) setProfiles(data || []);
      });
  }, []);

  // Load logs with period filter applied server-side
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("auditoria_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (period !== "todos") {
        const dateFrom = periodToDateFrom(period);
        query = query.gte("created_at", dateFrom);
      }

      const { data, error } = await query;
      if (!error) setLogs(data || []);
      setLoading(false);
    };
    load();
  }, [period]);

  // Lookup helpers
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  function getProfile(userId: string | null): Profile | null {
    if (!userId) return null;
    return profileMap.get(userId) ?? null;
  }

  // Derived filter options
  const tabelas = useMemo(() => {
    const set = new Set(logs.map((l) => l.tabela));
    return Array.from(set).sort();
  }, [logs]);

  const usuariosNosPeriodo = useMemo(() => {
    const ids = new Set(logs.map((l) => l.usuario_id).filter((id): id is string => id !== null));
    return profiles.filter((p) => ids.has(p.id));
  }, [logs, profiles]);

  // KPIs (over all loaded logs, not filtered)
  const kpis = useMemo(() => {
    const total = logs.length;
    const inserts = logs.filter((l) => l.acao === "INSERT").length;
    const updates = logs.filter((l) => l.acao === "UPDATE").length;
    const deletes = logs.filter((l) => l.acao === "DELETE").length;
    const sensiveis = logs.filter(
      (l) => getCriticality(l) === "alta"
    ).length;
    return { total, inserts, updates, deletes, sensiveis };
  }, [logs]);

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return logs.filter((l) => {
      if (tabelaFilter !== "todas" && l.tabela !== tabelaFilter) return false;
      if (acaoFilter !== "todas" && l.acao !== acaoFilter) return false;
      if (usuarioFilter !== "todos" && l.usuario_id !== usuarioFilter)
        return false;
      if (
        criticalidadeFilter !== "todas" &&
        getCriticality(l) !== criticalidadeFilter
      )
        return false;
      if (!query) return true;
      const profile = profileMap.get(l.usuario_id ?? "");
      const searchable = [
        l.tabela,
        l.acao,
        l.registro_id,
        l.ip_address,
        profile?.nome,
        profile?.email,
        getTableMeta(l.tabela).modulo,
        getTableMeta(l.tabela).entidade,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [logs, searchTerm, tabelaFilter, acaoFilter, usuarioFilter, criticalidadeFilter, profileMap]);

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    {
      key: "created_at",
      label: "Data/Hora",
      sortable: true,
      render: (l: AuditLog) => (
        <span className="text-xs font-mono whitespace-nowrap">
          {new Date(l.created_at).toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "usuario_id",
      label: "Usuário",
      render: (l: AuditLog) => {
        const profile = getProfile(l.usuario_id);
        return profile ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium truncate">{profile.nome}</span>
            {profile.email && (
              <span className="text-xs text-muted-foreground truncate">
                {profile.email}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">
            {l.usuario_id ? l.usuario_id.substring(0, 8) + "…" : "—"}
          </span>
        );
      },
    },
    {
      key: "modulo",
      label: "Módulo",
      render: (l: AuditLog) => {
        const { modulo } = getTableMeta(l.tabela);
        return (
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {modulo}
          </Badge>
        );
      },
    },
    {
      key: "entidade",
      label: "Entidade",
      render: (l: AuditLog) => {
        const { entidade } = getTableMeta(l.tabela);
        return <span className="text-sm">{entidade}</span>;
      },
    },
    {
      key: "acao",
      label: "Ação",
      render: (l: AuditLog) => <ActionBadge acao={l.acao} />,
    },
    {
      key: "registro_id",
      label: "Registro",
      render: (l: AuditLog) => (
        <span className="font-mono text-xs text-muted-foreground">
          {l.registro_id ? l.registro_id.substring(0, 8) + "…" : "—"}
        </span>
      ),
    },
    {
      key: "criticidade",
      label: "Criticidade",
      render: (l: AuditLog) => <CriticalityBadge log={l} />,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedProfile = selected ? getProfile(selected.usuario_id) : null;
  const selectedMeta = selected ? getTableMeta(selected.tabela) : null;
  const selectedAcao = selected ? getAcaoMeta(selected.acao) : null;
  const selectedCrit = selected ? getCriticality(selected) : null;

  return (
    <AppLayout>
      <ModulePage
        title="Trilha de Auditoria"
        subtitle="Rastreamento de operações, investigação de alterações e governança operacional"
        count={filteredLogs.length}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por usuário, módulo, entidade, ação..."
        summaryCards={
          <>
            <SummaryCard
              title="Eventos no Período"
              value={String(kpis.total)}
              icon={Shield}
              variationType="neutral"
              variant="info"
            />
            <SummaryCard
              title="Criações"
              value={String(kpis.inserts)}
              icon={Plus}
              variationType="positive"
              variant="success"
            />
            <SummaryCard
              title="Edições"
              value={String(kpis.updates)}
              icon={Edit}
              variationType="neutral"
            />
            <SummaryCard
              title="Exclusões"
              value={String(kpis.deletes)}
              icon={Trash2}
              variationType="negative"
              variant="danger"
            />
            <SummaryCard
              title="Eventos Sensíveis"
              value={String(kpis.sensiveis)}
              icon={AlertTriangle}
              variationType="negative"
              variant="warning"
            />
            <SummaryCard
              title="Usuários Ativos"
              value={String(usuariosNosPeriodo.length)}
              icon={User}
              variationType="neutral"
            />
          </>
        }
        filters={
          <div className="flex flex-wrap gap-2">
            <Select value={tabelaFilter} onValueChange={setTabelaFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Entidade / Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as entidades</SelectItem>
                {tabelas.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getTableMeta(t).entidade}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({t})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={acaoFilter} onValueChange={setAcaoFilter}>
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

            <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {usuariosNosPeriodo.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={criticalidadeFilter}
              onValueChange={setCriticalidadeFilter}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Criticidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda criticidade</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        toolbarExtra={
          <PeriodFilter
            value={period}
            onChange={setPeriod}
            options={AUDIT_PERIODS}
          />
        }
      >
        <DataTable
          columns={columns}
          data={filteredLogs}
          loading={loading}
          moduleKey="auditoria"
          emptyTitle="Nenhum evento de auditoria encontrado"
          emptyDescription="Ajuste os filtros ou amplie o período consultado para ver os registros de auditoria."
          onView={(l) => {
            setSelected(l);
            setDrawerOpen(true);
          }}
        />
      </ModulePage>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      <ViewDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Evento de Auditoria"
        badge={
          selected && selectedAcao ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${selectedAcao.color}`}
            >
              {selectedAcao.label}
            </span>
          ) : undefined
        }
      >
        {selected && selectedMeta && selectedCrit && (
          <div className="space-y-5">
            {/* Identification */}
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
                <ViewField label="Entidade">
                  {selectedMeta.entidade}
                </ViewField>
                <ViewField label="Tabela Técnica">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selected.tabela}
                  </Badge>
                </ViewField>
                <ViewField label="ID do Registro">
                  <span className="font-mono text-xs break-all">
                    {selected.registro_id || "—"}
                  </span>
                </ViewField>
              </div>
            </ViewSection>

            {/* Responsible user */}
            <ViewSection title="Usuário Responsável">
              <div className="grid grid-cols-2 gap-4">
                {selectedProfile ? (
                  <>
                    <ViewField label="Nome">
                      {selectedProfile.nome}
                    </ViewField>
                    {selectedProfile.email && (
                      <ViewField label="E-mail">
                        {selectedProfile.email}
                      </ViewField>
                    )}
                    {selectedProfile.cargo && (
                      <ViewField label="Cargo">
                        {selectedProfile.cargo}
                      </ViewField>
                    )}
                    <ViewField label="ID do Usuário">
                      <span className="font-mono text-xs break-all">
                        {selected.usuario_id}
                      </span>
                    </ViewField>
                  </>
                ) : (
                  <ViewField label="ID do Usuário" className="col-span-2">
                    <span className="font-mono text-xs break-all">
                      {selected.usuario_id || "—"}
                    </span>
                  </ViewField>
                )}
                <ViewField label="IP de Origem">
                  <span className="font-mono">
                    {selected.ip_address || "—"}
                  </span>
                </ViewField>
              </div>
            </ViewSection>

            {/* Changed fields diff */}
            <DiffViewer
              anterior={selected.dados_anteriores}
              novo={selected.dados_novos}
            />
          </div>
        )}
      </ViewDrawer>
    </AppLayout>
  );
}
