import { useEffect, useMemo, useState } from "react";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Edit,
  Trash2,
  FolderTree,
  FileText,
  GitBranch,
  BookOpen,
  Settings2,
  LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContaContabil {
  id: string;
  codigo: string;
  descricao: string;
  natureza: string;
  aceita_lancamento: boolean;
  conta_pai_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface VinculoContagem {
  lancamentos: number;
  notas_fiscais: number;
  grupos_produto: number;
}

interface ContaContabilDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: ContaContabil | null;
  allContas: ContaContabil[];
  onEdit: (c: ContaContabil) => void;
  onDelete: (c: ContaContabil) => void;
}

function buildParentMap(
  allContas: ContaContabil[]
): Map<string, ContaContabil> {
  const map = new Map<string, ContaContabil>();
  for (const c of allContas) map.set(c.id, c);
  return map;
}

function getDepth(
  conta: ContaContabil,
  parentMap: Map<string, ContaContabil>
): number {
  let depth = 0;
  let current: ContaContabil | undefined = conta;
  while (current?.conta_pai_id) {
    current = parentMap.get(current.conta_pai_id);
    depth++;
  }
  return depth;
}

function getAncestors(
  conta: ContaContabil,
  parentMap: Map<string, ContaContabil>
): ContaContabil[] {
  const ancestors: ContaContabil[] = [];
  let current: ContaContabil | undefined = conta;
  while (current?.conta_pai_id) {
    const parent = parentMap.get(current.conta_pai_id);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

const naturezaLabel: Record<string, string> = {
  devedora: "Devedora",
  credora: "Credora",
  mista: "Mista",
};

export function ContaContabilDrawer({
  open,
  onClose,
  selected,
  allContas,
  onEdit,
  onDelete,
}: ContaContabilDrawerProps) {
  const [vinculos, setVinculos] = useState<VinculoContagem | null>(null);
  const [loadingVinculos, setLoadingVinculos] = useState(false);

  const parentMap = useMemo(() => buildParentMap(allContas), [allContas]);

  useEffect(() => {
    if (!open || !selected) {
      setVinculos(null);
      return;
    }
    const id = selected.id;
    setLoadingVinculos(true);
    Promise.all([
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", id)
        .eq("ativo", true),
      supabase
        .from("notas_fiscais")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", id)
        .eq("ativo", true),
      supabase
        .from("grupos_produto")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", id),
    ]).then(([lanc, nf, gp]) => {
      setVinculos({
        lancamentos: lanc.count ?? 0,
        notas_fiscais: nf.count ?? 0,
        grupos_produto: gp.count ?? 0,
      });
      setLoadingVinculos(false);
    });
  }, [open, selected?.id]);

  if (!selected) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const isAnalitica = selected.aceita_lancamento;
  const nivel = getDepth(selected, parentMap);
  const ancestrais = getAncestors(selected, parentMap);
  const contaPai = selected.conta_pai_id
    ? parentMap.get(selected.conta_pai_id) ?? null
    : null;
  const filhas = allContas.filter((c) => c.conta_pai_id === selected.id);

  const tipoLabel = isAnalitica ? "Analítica" : "Sintética";
  const tipoIcon = isAnalitica ? (
    <FileText className="w-3.5 h-3.5" />
  ) : (
    <FolderTree className="w-3.5 h-3.5" />
  );

  const totalVinculos = vinculos
    ? vinculos.lancamentos + vinculos.notas_fiscais + vinculos.grupos_produto
    : 0;

  const summary = (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-lg border bg-card p-3 text-center space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Nível
        </p>
        <p className="font-bold text-base text-foreground">{nivel}</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tipo
        </p>
        <Badge
          variant={isAnalitica ? "default" : "secondary"}
          className="text-[10px] px-1.5 gap-1"
        >
          {tipoIcon}
          {tipoLabel}
        </Badge>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lançamento
        </p>
        <Badge
          variant={isAnalitica ? "default" : "outline"}
          className="text-[10px] px-1.5"
        >
          {isAnalitica ? "Aceita" : "Não aceita"}
        </Badge>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Subcontas
        </p>
        <p className="font-bold text-base text-foreground">
          {filhas.length > 0 ? filhas.length : "—"}
        </p>
      </div>
    </div>
  );

  const resumoTab = (
    <div className="space-y-5">
      <ViewSection title="Identificação">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ViewField label="Código">
            <span className="font-mono font-semibold">{selected.codigo}</span>
          </ViewField>
          <ViewField label="Natureza">
            <span className="capitalize">
              {naturezaLabel[selected.natureza] ?? selected.natureza}
            </span>
          </ViewField>
          <ViewField label="Descrição" className="col-span-2">
            {selected.descricao}
          </ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Classificação">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ViewField label="Tipo da Conta">
            <Badge
              variant={isAnalitica ? "default" : "secondary"}
              className="gap-1"
            >
              {tipoIcon}
              {tipoLabel}
            </Badge>
          </ViewField>
          <ViewField label="Aceita Lançamento">
            <Badge variant={isAnalitica ? "default" : "outline"}>
              {isAnalitica ? "Sim" : "Não"}
            </Badge>
          </ViewField>
          <ViewField label="Situação">
            <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
          </ViewField>
          <ViewField label="Nível Hierárquico">
            <span className="font-mono font-semibold">{nivel}</span>
            <span className="text-muted-foreground ml-1 text-xs">
              {nivel === 0 ? "(raiz)" : `(${nivel}° nível)`}
            </span>
          </ViewField>
        </div>
      </ViewSection>
    </div>
  );

  const hierarquiaTab = (
    <div className="space-y-5">
      {/* Breadcrumb path */}
      {ancestrais.length > 0 && (
        <ViewSection title="Caminho Hierárquico">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {ancestrais.map((anc, i) => (
              <span key={anc.id} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-muted-foreground text-xs">›</span>
                )}
                <span className="font-mono text-primary text-xs">
                  {anc.codigo}
                </span>
                <span className="text-muted-foreground text-xs">
                  {anc.descricao}
                </span>
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">›</span>
              <span className="font-mono font-semibold text-xs">
                {selected.codigo}
              </span>
              <span className="font-semibold text-xs">{selected.descricao}</span>
            </span>
          </div>
        </ViewSection>
      )}

      <ViewSection title="Posição">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ViewField label="Nível Hierárquico">
            <span className="font-mono font-semibold">{nivel}</span>
            <span className="text-muted-foreground ml-1 text-xs">
              {nivel === 0 ? "(raiz)" : `(${nivel}° nível)`}
            </span>
          </ViewField>
          <ViewField label="Conta Pai">
            {contaPai ? (
              <span className="font-mono text-primary">
                {contaPai.codigo}{" "}
                <span className="text-foreground font-normal">
                  — {contaPai.descricao}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Raiz (sem conta pai)</span>
            )}
          </ViewField>
          <ViewField label="Tipo da Conta">
            <Badge variant={isAnalitica ? "default" : "secondary"} className="gap-1">
              {tipoIcon}
              {tipoLabel}
            </Badge>
          </ViewField>
          <ViewField label="Aceita Lançamento">
            <Badge variant={isAnalitica ? "default" : "outline"}>
              {isAnalitica ? "Sim" : "Não"}
            </Badge>
          </ViewField>
        </div>
      </ViewSection>

      {/* Children list */}
      {filhas.length > 0 && (
        <ViewSection title={`Subcontas (${filhas.length})`}>
          <div className="space-y-1">
            {filhas.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/20 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {f.aceita_lancamento ? (
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FolderTree className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  <span className="font-mono text-primary font-semibold shrink-0">
                    {f.codigo}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {f.descricao}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Badge
                    variant={f.aceita_lancamento ? "default" : "secondary"}
                    className="text-[10px] px-1.5"
                  >
                    {f.aceita_lancamento ? "Analítica" : "Sintética"}
                  </Badge>
                  <StatusBadge status={f.ativo ? "Ativo" : "Inativo"} />
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      )}

      {filhas.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed">
          Esta conta não possui subcontas.
        </div>
      )}
    </div>
  );

  const usoTab = (
    <div className="space-y-5">
      {loadingVinculos && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Carregando vínculos...
        </p>
      )}
      {!loadingVinculos && vinculos && (
        <>
          <ViewSection title="Vínculos no ERP">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span>Lançamentos Financeiros</span>
                </div>
                <Badge
                  variant={vinculos.lancamentos > 0 ? "default" : "outline"}
                  className="min-w-[2rem] justify-center"
                >
                  {vinculos.lancamentos}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>Notas Fiscais</span>
                </div>
                <Badge
                  variant={vinculos.notas_fiscais > 0 ? "default" : "outline"}
                  className="min-w-[2rem] justify-center"
                >
                  {vinculos.notas_fiscais}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-sm">
                  <LinkIcon className="w-4 h-4 text-muted-foreground" />
                  <span>Grupos de Produto</span>
                </div>
                <Badge
                  variant={vinculos.grupos_produto > 0 ? "default" : "outline"}
                  className="min-w-[2rem] justify-center"
                >
                  {vinculos.grupos_produto}
                </Badge>
              </div>
            </div>
          </ViewSection>

          {totalVinculos === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed">
              Esta conta ainda não possui vínculos registrados no ERP.
            </div>
          )}
        </>
      )}
    </div>
  );

  const configuracaoTab = (
    <div className="space-y-5">
      <ViewSection title="Regras e Parâmetros">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ViewField label="Natureza da Conta">
            <span className="capitalize">
              {naturezaLabel[selected.natureza] ?? selected.natureza}
            </span>
          </ViewField>
          <ViewField label="Tipo da Conta">
            <Badge
              variant={isAnalitica ? "default" : "secondary"}
              className="gap-1"
            >
              {tipoIcon}
              {tipoLabel}
            </Badge>
          </ViewField>
          <ViewField label="Aceita Lançamento">
            <div className="flex items-center gap-1.5">
              <Badge variant={isAnalitica ? "default" : "outline"}>
                {isAnalitica ? "Sim" : "Não"}
              </Badge>
              {!isAnalitica && (
                <span className="text-xs text-muted-foreground">
                  (conta sintética — apenas agrupa subcontas)
                </span>
              )}
            </div>
          </ViewField>
          <ViewField label="Situação">
            <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
          </ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Registro">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <ViewField label="Criado em">
            {new Date(selected.created_at).toLocaleDateString("pt-BR")}
          </ViewField>
        </div>
      </ViewSection>
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={selected.descricao}
      subtitle={
        <span className="font-mono text-xs text-muted-foreground">
          {selected.codigo}
        </span>
      }
      badge={
        <div className="flex items-center gap-1.5">
          <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
          <Badge
            variant={isAnalitica ? "default" : "secondary"}
            className="gap-1 text-xs"
          >
            {tipoIcon}
            {tipoLabel}
          </Badge>
        </div>
      }
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onClose();
                  onEdit(selected);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => {
                  onClose();
                  onDelete(selected);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </>
      }
      summary={summary}
      tabs={[
        {
          value: "resumo",
          label: "Resumo",
          content: resumoTab,
        },
        {
          value: "hierarquia",
          label: "Hierarquia",
          content: hierarquiaTab,
        },
        {
          value: "uso",
          label: "Uso / Vínculos",
          content: usoTab,
        },
        {
          value: "configuracao",
          label: "Configuração",
          content: configuracaoTab,
        },
      ]}
    />
  );
}
