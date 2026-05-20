import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { SummaryCard } from "@/components/SummaryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import {
  listAuditDups,
  scanDups,
  purgeDup,
  manterDup,
  type AuditDup,
} from "@/services/auditDups.service";
import { AlertTriangle, RefreshCw, Trash2, ShieldCheck, ScanSearch } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useConfirmDestructive } from "@/hooks/useConfirmDestructive";

type StatusTab = "pendente" | "removido" | "mantido";

export default function AuditDuplicidades() {
  const [tab, setTab] = useState<StatusTab>("pendente");
  const { isAdmin } = useIsAdmin();
  const [data, setData] = useState<AuditDup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manterTarget, setManterTarget] = useState<AuditDup | null>(null);
  const [manterMotivo, setManterMotivo] = useState("");
  const [working, setWorking] = useState(false);
  const [classFilter, setClassFilter] = useState<"todos" | "clara" | "manual_review">("todos");
  const { confirm: confirmDestructive, dialog: destructiveDialog } = useConfirmDestructive();

  const fetchData = async (status: StatusTab) => {
    setLoading(true);
    try {
      const rows = await listAuditDups(status);
      setData(rows);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(tab);
  }, [tab]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await scanDups();
      toast.success(
        `Auditoria concluída: ${res.grupos_inseridos} grupos (${res.claros} claros, ${res.revisao_manual} para revisão)`,
      );
      await fetchData(tab);
    } catch (e) {
      notifyError(e);
    } finally {
      setScanning(false);
    }
  };

  const handlePurge = async (target: AuditDup) => {
    const n = (target.ids_a_remover as string[] | null)?.length ?? 0;
    await confirmDestructive(
      {
        verb: "Excluir",
        entity: `${n} lançamento(s) duplicado(s)`,
        sideEffects: [
          `${n} lançamento(s) serão removidos permanentemente`,
          `Valor: ${formatCurrency(Number(target.valor))} · Vencimento: ${formatDate(target.data_vencimento)}`,
          "Lançamentos baixados nunca são removidos pelo sistema",
          "Esta ação não pode ser desfeita",
        ],
      },
      async () => {
        setWorking(true);
        try {
          const removed = await purgeDup(target.id);
          toast.success(`${removed} lançamento(s) removido(s) definitivamente`);
          fetchData(tab);
        } catch (e) {
          notifyError(e);
        } finally {
          setWorking(false);
        }
      },
    );
  };

  const handleConfirmManter = async () => {
    if (!manterTarget) return;
    if (!manterMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    setWorking(true);
    try {
      await manterDup(manterTarget.id, manterMotivo.trim());
      toast.success("Grupo marcado como mantido");
      setManterTarget(null);
      setManterMotivo("");
      fetchData(tab);
    } catch (e) {
      notifyError(e);
    } finally {
      setWorking(false);
    }
  };

  const counts = useMemo(() => {
    const claros = data.filter((d) => d.classificacao === "clara").length;
    const revisao = data.filter((d) => d.classificacao === "manual_review").length;
    return { total: data.length, claros, revisao };
  }, [data]);

  const filteredData = useMemo(() => {
    if (classFilter === "todos") return data;
    return data.filter((d) => d.classificacao === classFilter);
  }, [data, classFilter]);

  const columns = [
    {
      key: "tipo",
      label: "Tipo",
      mobileCard: true,
      render: (r: AuditDup) => (
        <Badge variant="outline">{r.tipo === "pagar" ? "A Pagar" : "A Receber"}</Badge>
      ),
    },
    {
      key: "valor",
      label: "Valor",
      sortable: true,
      mobilePrimary: true,
      render: (r: AuditDup) => (
        <span className="font-mono text-sm">{formatCurrency(Number(r.valor))}</span>
      ),
    },
    {
      key: "venc",
      label: "Vencimento",
      sortable: true,
      mobileCard: true,
      render: (r: AuditDup) => formatDate(r.data_vencimento),
    },
    {
      key: "parcela",
      label: "Parcela",
      render: (r: AuditDup) =>
        r.parcela_numero ? <span className="text-xs">{r.parcela_numero}</span> : "—",
    },
    {
      key: "qtd",
      label: "Duplicatas",
      render: (r: AuditDup) => (
        <span className="font-semibold">{(r.ids as string[]).length}</span>
      ),
    },
    {
      key: "baixados",
      label: "Baixados",
      render: (r: AuditDup) => {
        const n = (r.ids_baixados as string[] | null)?.length ?? 0;
        return n > 0 ? (
          <Badge className="bg-success/15 text-success border-success/30">{n}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        );
      },
    },
    {
      key: "remover",
      label: "A remover",
      render: (r: AuditDup) => {
        const n = (r.ids_a_remover as string[] | null)?.length ?? 0;
        return n > 0 ? (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30">{n}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        );
      },
    },
    {
      key: "classificacao",
      label: "Classificação",
      mobileCard: true,
      render: (r: AuditDup) =>
        r.classificacao === "clara" ? (
          <Badge className="bg-warning/15 text-warning border-warning/30">Clara</Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Revisão manual
          </Badge>
        ),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (r: AuditDup) =>
        tab === "pendente" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-9 max-sm:h-11 text-xs"
              disabled={!isAdmin || (r.ids_a_remover as string[] | null)?.length === 0}
              title={!isAdmin ? "Apenas administradores podem mesclar duplicidades" : undefined}
              onClick={() => handlePurge(r)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remover
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 max-sm:h-11 text-xs"
              disabled={!isAdmin}
              title={!isAdmin ? "Apenas administradores podem marcar duplicidades" : undefined}
              onClick={() => setManterTarget(r)}
            >
              <ShieldCheck className="w-3 h-3 mr-1" />
              Manter
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{r.motivo || "—"}</span>
        ),
    },
  ];

  return (
    <>
      <ModulePage
        title="Auditoria de Duplicidades"
        subtitle="Revisão de lançamentos financeiros potencialmente duplicados (apenas administradores)"
        headerActions={
          <Button onClick={handleScan} disabled={scanning} variant="outline">
            {scanning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ScanSearch className="w-4 h-4 mr-2" />
            )}
            {scanning ? "Escaneando..." : "Escanear duplicidades"}
          </Button>
        }
        summaryCards={
          <>
            <SummaryCard
              title="Grupos"
              value={String(counts.total)}
              icon={ScanSearch}
              onClick={() => setClassFilter("todos")}
              active={classFilter === "todos"}
              aria-label="Mostrar todas as duplicidades"
            />
            <SummaryCard
              title="Claras"
              value={String(counts.claros)}
              icon={Trash2}
              variant="warning"
              onClick={
                counts.claros > 0
                  ? () => setClassFilter(classFilter === "clara" ? "todos" : "clara")
                  : undefined
              }
              active={classFilter === "clara"}
              aria-label="Filtrar duplicidades claras"
            />
            <SummaryCard
              title="Revisão manual"
              value={String(counts.revisao)}
              icon={AlertTriangle}
              onClick={
                counts.revisao > 0
                  ? () =>
                      setClassFilter(classFilter === "manual_review" ? "todos" : "manual_review")
                  : undefined
              }
              active={classFilter === "manual_review"}
              aria-label="Filtrar duplicidades para revisão manual"
            />
          </>
        }
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)} className="w-full">
          <TabsList className="w-full grid grid-cols-3 max-sm:h-11">
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="removido">Removidos</TabsTrigger>
            <TabsTrigger value="mantido">Mantidos</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <DataTable
              columns={columns}
              data={filteredData}
              loading={loading}
              moduleKey="audit-dups"
              mobileStatusKey="classificacao"
              mobileIdentifierKey="valor"
              mobilePrimaryAction={
                tab === "pendente"
                  ? (r: AuditDup) => (
                      <div className="flex gap-2 w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 flex-1"
                          disabled={!isAdmin || (r.ids_a_remover as string[] | null)?.length === 0}
                          onClick={(e) => { e.stopPropagation(); handlePurge(r); }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remover
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-11 flex-1"
                          disabled={!isAdmin}
                          onClick={(e) => { e.stopPropagation(); setManterTarget(r); }}
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" /> Manter
                        </Button>
                      </div>
                    )
                  : undefined
              }
              emptyTitle="Nenhuma duplicidade encontrada"
              emptyDescription={
                tab === "pendente"
                  ? "Clique em 'Escanear duplicidades' para varrer os lançamentos."
                  : "Nenhum registro neste status."
              }
            />
          </TabsContent>
        </Tabs>
      </ModulePage>

      {destructiveDialog}

      <AlertDialog open={!!manterTarget} onOpenChange={(o) => !o && setManterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como não-duplicidade</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo pelo qual este grupo deve ser preservado (ex: lançamentos legítimos
              de mesma data/valor).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2 space-y-2">
            <Label htmlFor="manter-motivo">Motivo</Label>
            <Textarea
              id="manter-motivo"
              value={manterMotivo}
              onChange={(e) => setManterMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setManterMotivo("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmManter} disabled={working}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}