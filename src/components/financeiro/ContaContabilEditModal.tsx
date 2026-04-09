import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  FileText,
  FolderTree,
  GitBranch,
  Info,
  Settings2,
  Tag,
} from "lucide-react";

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

interface ContaContabilEditModalProps {
  open: boolean;
  onClose: () => void;
  /** null = modo criação */
  conta: ContaContabil | null;
  allContas: ContaContabil[];
  onSave: (data: Partial<ContaContabil>) => Promise<void>;
}

const naturezaOpcoes = [
  { value: "devedora", label: "Devedora" },
  { value: "credora", label: "Credora" },
  { value: "mista", label: "Mista" },
];

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

function getNivel(
  conta: ContaContabil | null,
  contaPaiId: string | null,
  allContas: ContaContabil[]
): number {
  if (!contaPaiId) return 0;
  const pai = allContas.find((c) => c.id === contaPaiId);
  if (!pai) return 0;
  let nivel = 1;
  let current: ContaContabil | undefined = pai;
  while (current?.conta_pai_id) {
    current = allContas.find((c) => c.id === current!.conta_pai_id);
    nivel++;
  }
  return nivel;
}

export function ContaContabilEditModal({
  open,
  onClose,
  conta,
  allContas,
  onSave,
}: ContaContabilEditModalProps) {
  const isEdit = !!conta;

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [natureza, setNatureza] = useState("devedora");
  const [aceitaLancamento, setAceitaLancamento] = useState(true);
  const [contaPaiId, setContaPaiId] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vinculos, setVinculos] = useState<VinculoContagem | null>(null);
  const [loadingVinculos, setLoadingVinculos] = useState(false);
  const [codigoExistente, setCodigoExistente] = useState(false);

  // Populate form when opening
  useEffect(() => {
    if (!open) return;
    if (conta) {
      setCodigo(conta.codigo);
      setDescricao(conta.descricao);
      setNatureza(conta.natureza ?? "devedora");
      setAceitaLancamento(conta.aceita_lancamento);
      setContaPaiId(conta.conta_pai_id);
      setAtivo(conta.ativo);
    } else {
      setCodigo("");
      setDescricao("");
      setNatureza("devedora");
      setAceitaLancamento(true);
      setContaPaiId(null);
      setAtivo(true);
    }
    setVinculos(null);
    setCodigoExistente(false);
  }, [open, conta]);

  // Load vinculos in edit mode
  useEffect(() => {
    if (!open || !conta) return;
    setLoadingVinculos(true);
    Promise.all([
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", conta.id)
        .eq("ativo", true),
      supabase
        .from("notas_fiscais")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", conta.id)
        .eq("ativo", true),
      supabase
        .from("grupos_produto")
        .select("id", { count: "exact", head: true })
        .eq("conta_contabil_id", conta.id),
    ]).then(([lanc, nf, gp]) => {
      setVinculos({
        lancamentos: lanc.count ?? 0,
        notas_fiscais: nf.count ?? 0,
        grupos_produto: gp.count ?? 0,
      });
      setLoadingVinculos(false);
    });
  }, [open, conta?.id]);

  // Check code uniqueness on blur
  const checkCodigoDuplicado = async (value: string) => {
    if (!value.trim()) return;
    const existing = allContas.find(
      (c) => c.codigo === value.trim() && (!conta || c.id !== conta.id)
    );
    setCodigoExistente(!!existing);
  };

  const filhasCount = useMemo(
    () => allContas.filter((c) => c.id !== conta?.id && c.conta_pai_id === conta?.id).length,
    [allContas, conta]
  );

  const nivelAtual = useMemo(
    () => getNivel(conta, contaPaiId, allContas),
    [conta, contaPaiId, allContas]
  );

  const contaPai = useMemo(
    () => (contaPaiId ? allContas.find((c) => c.id === contaPaiId) ?? null : null),
    [allContas, contaPaiId]
  );

  const totalVinculos = vinculos
    ? vinculos.lancamentos + vinculos.notas_fiscais + vinculos.grupos_produto
    : 0;

  // Derived warnings
  const hasFilhasWarning =
    isEdit && filhasCount > 0 && aceitaLancamento;
  const inativarComVinculos = isEdit && !ativo && conta?.ativo && totalVinculos > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!codigo.trim()) { toast.error("Código é obrigatório"); return; }
    if (!descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (codigoExistente) { toast.error("Este código já está em uso por outra conta"); return; }
    if (hasFilhasWarning) {
      toast.warning("Conta com subcontas não pode ser marcada como analítica");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        natureza,
        aceita_lancamento: aceitaLancamento,
        conta_pai_id: contaPaiId,
        ativo,
      });
      onClose();
    } catch {
      toast.error("Erro ao salvar conta contábil");
    }
    setSaving(false);
  };

  // Candidate parent accounts: exclude self and own descendants
  const descendantsAndSelf = useMemo(() => {
    if (!conta) return new Set<string>();
    const result = new Set<string>([conta.id]);
    const addDescendants = (id: string) => {
      allContas
        .filter((c) => c.conta_pai_id === id)
        .forEach((c) => {
          result.add(c.id);
          addDescendants(c.id);
        });
    };
    addDescendants(conta.id);
    return result;
  }, [allContas, conta]);

  const contasPaiCandidatas = allContas.filter(
    (c) => !descendantsAndSelf.has(c.id)
  );

  const tipoLabel = aceitaLancamento ? "Analítica" : "Sintética";
  const tipoIcon = aceitaLancamento ? (
    <FileText className="w-3.5 h-3.5" />
  ) : (
    <FolderTree className="w-3.5 h-3.5 text-primary" />
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">
            {isEdit ? "Editar Conta Contábil" : "Nova Conta Contábil"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edição administrativa da conta contábil" : "Criação de nova conta contábil"}
          </DialogDescription>
        </DialogHeader>

        {/* Context header — edit mode only */}
        {isEdit && conta && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-primary">
                  {conta.codigo}
                </span>
                <span className="text-sm font-medium truncate">{conta.descricao}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={conta.ativo ? "Ativo" : "Inativo"} />
                <Badge
                  variant={conta.aceita_lancamento ? "default" : "secondary"}
                  className="text-[10px] gap-1 px-1.5"
                >
                  {tipoIcon}
                  {conta.aceita_lancamento ? "Analítica" : "Sintética"}
                </Badge>
                {isEdit && !loadingVinculos && vinculos && totalVinculos > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {totalVinculos} vínculo{totalVinculos > 1 ? "s" : ""} no ERP
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          {/* BLOCO 1 — Identificação */}
          <div>
            <SectionHeader icon={<Tag className="w-3.5 h-3.5" />} title="Identificação" />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="codigo" className="text-sm">
                  Código <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => { setCodigo(e.target.value); setCodigoExistente(false); }}
                  onBlur={(e) => checkCodigoDuplicado(e.target.value)}
                  placeholder="1.1.01"
                  className={`font-mono ${codigoExistente ? "border-destructive" : ""}`}
                  required
                />
                {codigoExistente && (
                  <p className="text-xs text-destructive">
                    Código já utilizado por outra conta
                  </p>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="descricao" className="text-sm">
                  Descrição <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Nome da conta contábil"
                  required
                />
              </div>
            </div>
          </div>

          {/* BLOCO 2 — Classificação */}
          <div>
            <SectionHeader icon={<Settings2 className="w-3.5 h-3.5" />} title="Classificação" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Natureza da Conta</Label>
                <Select value={natureza} onValueChange={setNatureza}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {naturezaOpcoes.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Tipo da Conta</Label>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={!aceitaLancamento ? "default" : "outline"}
                    className="flex-1 gap-1.5"
                    onClick={() => setAceitaLancamento(false)}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    Sintética
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={aceitaLancamento ? "default" : "outline"}
                    className="flex-1 gap-1.5"
                    onClick={() => setAceitaLancamento(true)}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Analítica
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {aceitaLancamento
                    ? "Analítica: aceita lançamentos diretos"
                    : "Sintética: apenas agrupa subcontas"}
                </p>
              </div>
            </div>

            {hasFilhasWarning && (
              <Alert variant="destructive" className="mt-3 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Esta conta possui {filhasCount} subconta{filhasCount > 1 ? "s" : ""}. Contas com
                  subcontas devem ser sintéticas e não aceitar lançamentos diretos.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* BLOCO 3 — Hierarquia */}
          <div>
            <SectionHeader icon={<GitBranch className="w-3.5 h-3.5" />} title="Hierarquia" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Conta Pai</Label>
                <Select
                  value={contaPaiId ?? "none"}
                  onValueChange={(v) => setContaPaiId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma (conta raiz)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (conta raiz — nível 0)</SelectItem>
                    {contasPaiCandidatas
                      .sort((a, b) => a.codigo.localeCompare(b.codigo))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo} — {c.descricao}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hierarchy context panel */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-muted/20 p-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nível
                  </p>
                  <p className="font-bold text-sm mt-0.5">{nivelAtual}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {nivelAtual === 0 ? "raiz" : `${nivelAtual}° nível`}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Conta Pai
                  </p>
                  {contaPai ? (
                    <>
                      <p className="font-mono font-bold text-xs mt-0.5 text-primary">
                        {contaPai.codigo}
                      </p>
                      <p
                        className="text-[10px] text-muted-foreground truncate"
                        title={contaPai.descricao}
                      >
                        {contaPai.descricao}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Raiz</p>
                  )}
                </div>
                <div className="rounded-md border bg-muted/20 p-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Subcontas
                  </p>
                  <p className="font-bold text-sm mt-0.5">
                    {isEdit ? filhasCount : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isEdit && filhasCount > 0 ? "filho(s)" : "sem filhos"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 4 — Status e controle */}
          <div>
            <SectionHeader icon={<Info className="w-3.5 h-3.5" />} title="Status e Controle" />
            <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-card">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Conta ativa</p>
                <p className="text-xs text-muted-foreground">
                  {ativo
                    ? "Conta disponível para uso no ERP"
                    : "Conta inativa — restrita ao uso no ERP"}
                </p>
              </div>
              <Switch
                checked={ativo}
                onCheckedChange={(v) => setAtivo(v)}
                aria-label="Ativo/Inativo"
              />
            </div>

            {inativarComVinculos && (
              <Alert className="mt-3 py-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Atenção:</strong> esta conta possui {totalVinculos} vínculo
                  {totalVinculos > 1 ? "s" : ""} ativo{totalVinculos > 1 ? "s" : ""} no ERP
                  ({vinculos?.lancamentos ? `${vinculos.lancamentos} lançamento(s)` : ""}
                  {vinculos?.notas_fiscais ? `, ${vinculos.notas_fiscais} nota(s) fiscal(is)` : ""}
                  {vinculos?.grupos_produto ? `, ${vinculos.grupos_produto} grupo(s) de produto` : ""}).
                  Inativar pode impactar processos em uso.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge
                variant={aceitaLancamento ? "default" : "secondary"}
                className="gap-1 text-xs"
              >
                {tipoIcon}
                {tipoLabel}
              </Badge>
              {isEdit && (
                <StatusBadge status={ativo ? "Ativo" : "Inativo"} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || codigoExistente || hasFilhasWarning}
              >
                {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar conta"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
