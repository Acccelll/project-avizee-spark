import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { Plus, Pencil, Trash2, Copy, ScrollText, Calculator, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCan } from "@/hooks/useCan";
import { useConfirmDestructive } from "@/hooks/useConfirmDestructive";
import { UF_OPTIONS } from "@/constants/brasil";
import { notifyError } from "@/utils/errorMessages";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * /faturamento/cadastros — Onda 2.
 * Cadastros auxiliares: Naturezas de Operação e Matriz Fiscal.
 * Transportadoras tem cadastro próprio em outro lugar (atalho).
 */

type CadastroTab = "naturezas" | "matriz" | "transportadoras";
const VALID: CadastroTab[] = ["naturezas", "matriz", "transportadoras"];

// ---------------- Naturezas de Operação ----------------

const naturezaSchema = z.object({
  codigo: z.string().min(2, "Mínimo 2 caracteres").max(20),
  descricao: z.string().min(3, "Mínimo 3 caracteres"),
  cfop_dentro_uf: z.string().regex(/^\d{4}$/, "CFOP deve ter 4 dígitos").or(z.literal("")),
  cfop_fora_uf: z.string().regex(/^\d{4}$/, "CFOP deve ter 4 dígitos").or(z.literal("")),
  finalidade: z.enum(["1", "2", "3", "4"]),
  tipo_operacao: z.enum(["saida", "entrada"]),
  movimenta_estoque: z.boolean(),
  gera_financeiro: z.boolean(),
  ativo: z.boolean(),
  observacoes: z.string().optional(),
});
type NaturezaForm = z.infer<typeof naturezaSchema>;

interface Natureza extends NaturezaForm {
  id: string;
}

const FINALIDADE_LABEL: Record<string, string> = {
  "1": "Normal",
  "2": "Complementar",
  "3": "Ajuste",
  "4": "Devolução",
};

function NaturezasTab() {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const isAdmin = can("faturamento_fiscal:admin_fiscal");
  const { confirm: confirmDestructive, dialog: destructiveDialog } = useConfirmDestructive();
  const [editing, setEditing] = useState<Natureza | null>(null);
  const [open, setOpen] = useState(false);

  const { data: naturezas, isLoading } = useQuery({
    queryKey: ["naturezas-operacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("naturezas_operacao")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data as Natureza[];
    },
  });

  const form = useForm<NaturezaForm>({
    resolver: zodResolver(naturezaSchema),
    defaultValues: {
      codigo: "",
      descricao: "",
      cfop_dentro_uf: "",
      cfop_fora_uf: "",
      finalidade: "1",
      tipo_operacao: "saida",
      movimenta_estoque: true,
      gera_financeiro: true,
      ativo: true,
      observacoes: "",
    },
  });

  const openNew = () => {
    setEditing(null);
    form.reset({
      codigo: "",
      descricao: "",
      cfop_dentro_uf: "",
      cfop_fora_uf: "",
      finalidade: "1",
      tipo_operacao: "saida",
      movimenta_estoque: true,
      gera_financeiro: true,
      ativo: true,
      observacoes: "",
    });
    setOpen(true);
  };

  const openEdit = (n: Natureza) => {
    setEditing(n);
    form.reset({
      codigo: n.codigo,
      descricao: n.descricao,
      cfop_dentro_uf: n.cfop_dentro_uf ?? "",
      cfop_fora_uf: n.cfop_fora_uf ?? "",
      finalidade: n.finalidade as NaturezaForm["finalidade"],
      tipo_operacao: n.tipo_operacao as NaturezaForm["tipo_operacao"],
      movimenta_estoque: n.movimenta_estoque,
      gera_financeiro: n.gera_financeiro,
      ativo: n.ativo,
      observacoes: n.observacoes ?? "",
    });
    setOpen(true);
  };

  const duplicarNatureza = (n: Natureza) => {
    setEditing(null);
    form.reset({
      codigo: `${n.codigo}_COPIA`,
      descricao: `${n.descricao} (cópia)`,
      cfop_dentro_uf: n.cfop_dentro_uf ?? "",
      cfop_fora_uf: n.cfop_fora_uf ?? "",
      finalidade: n.finalidade as NaturezaForm["finalidade"],
      tipo_operacao: n.tipo_operacao as NaturezaForm["tipo_operacao"],
      movimenta_estoque: n.movimenta_estoque,
      gera_financeiro: n.gera_financeiro,
      ativo: n.ativo,
      observacoes: n.observacoes ?? "",
    });
    setOpen(true);
  };

  const onSubmit = async (values: NaturezaForm) => {
    const payload = {
      ...values,
      cfop_dentro_uf: values.cfop_dentro_uf || null,
      cfop_fora_uf: values.cfop_fora_uf || null,
      observacoes: values.observacoes || null,
    };
    try {
      if (editing) {
        const { error } = await supabase
          .from("naturezas_operacao")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Natureza atualizada");
      } else {
        const { error } = await supabase
          .from("naturezas_operacao")
          .insert([payload as never]);
        if (error) throw error;
        toast.success("Natureza criada");
      }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["naturezas-operacao"] });
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDelete = async (n: Natureza) => {
    await confirmDestructive(
      {
        verb: "Excluir",
        entity: `natureza "${n.codigo}"`,
        sideEffects: ["Notas já emitidas não são afetadas"],
      },
      async () => {
        const { error } = await supabase.from("naturezas_operacao").delete().eq("id", n.id);
        if (error) {
          notifyError(error);
          return;
        }
        toast.success("Natureza excluída");
        queryClient.invalidateQueries({ queryKey: ["naturezas-operacao"] });
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Naturezas de Operação
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Presets de operação com CFOP, finalidade e flags de estoque/financeiro.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova natureza
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (naturezas ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma natureza cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Descrição</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">CFOP dentro/fora</th>
                  <th className="py-2 px-2">Finalidade</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(naturezas ?? []).map((n) => (
                  <tr key={n.id} className="border-b hover:bg-accent/30">
                    <td className="py-2 px-2 font-mono text-xs">{n.codigo}</td>
                    <td className="py-2 px-2">{n.descricao}</td>
                    <td className="py-2 px-2 capitalize">{n.tipo_operacao}</td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {n.cfop_dentro_uf ?? "—"} / {n.cfop_fora_uf ?? "—"}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline">{FINALIDADE_LABEL[n.finalidade]}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      {n.ativo ? (
                        <Badge>Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {isAdmin && (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(n)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Duplicar natureza"
                            onClick={() => duplicarNatureza(n)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(n)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar natureza" : "Nova natureza de operação"}
        size="lg"
        mode={editing ? "edit" : "create"}
        isDirty={form.formState.isDirty}
        confirmOnDirty
        footer={
          <FormModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={form.handleSubmit(onSubmit)}
            saving={form.formState.isSubmitting}
            mode={editing ? "edit" : "create"}
            isDirty={form.formState.isDirty}
          />
        }
      >
        <form className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="codigo">Código *</Label>
            <Input id="codigo" {...form.register("codigo")} placeholder="VENDA" />
            {form.formState.errors.codigo && (
              <p className="text-xs text-destructive">{form.formState.errors.codigo.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" {...form.register("descricao")} placeholder="Venda de mercadoria…" />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={form.watch("tipo_operacao")}
              onValueChange={(v) => form.setValue("tipo_operacao", v as "saida" | "entrada", { shouldDirty: true })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Finalidade NF-e</Label>
            <Select
              value={form.watch("finalidade")}
              onValueChange={(v) => form.setValue("finalidade", v as NaturezaForm["finalidade"], { shouldDirty: true })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Normal</SelectItem>
                <SelectItem value="2">2 — Complementar</SelectItem>
                <SelectItem value="3">3 — Ajuste</SelectItem>
                <SelectItem value="4">4 — Devolução</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cfop_dentro">CFOP dentro do estado</Label>
            <Input id="cfop_dentro" {...form.register("cfop_dentro_uf")} placeholder="5102" maxLength={4} />
            {form.formState.errors.cfop_dentro_uf && (
              <p className="text-xs text-destructive">{form.formState.errors.cfop_dentro_uf.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cfop_fora">CFOP fora do estado</Label>
            <Input id="cfop_fora" {...form.register("cfop_fora_uf")} placeholder="6102" maxLength={4} />
            {form.formState.errors.cfop_fora_uf && (
              <p className="text-xs text-destructive">{form.formState.errors.cfop_fora_uf.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label htmlFor="mov-estoque" className="text-sm">Movimenta estoque</Label>
              <p className="text-xs text-muted-foreground">Gera saída/entrada automática</p>
            </div>
            <Switch
              id="mov-estoque"
              checked={form.watch("movimenta_estoque")}
              onCheckedChange={(v) => form.setValue("movimenta_estoque", v, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label htmlFor="gera-fin" className="text-sm">Gera financeiro</Label>
              <p className="text-xs text-muted-foreground">Cria contas a receber/pagar</p>
            </div>
            <Switch
              id="gera-fin"
              checked={form.watch("gera_financeiro")}
              onCheckedChange={(v) => form.setValue("gera_financeiro", v, { shouldDirty: true })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" {...form.register("observacoes")} rows={2} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              id="ativo"
              checked={form.watch("ativo")}
              onCheckedChange={(v) => form.setValue("ativo", v, { shouldDirty: true })}
            />
            <Label htmlFor="ativo">Natureza ativa</Label>
          </div>
        </form>
      </FormModal>
      {destructiveDialog}
    </Card>
  );
}

// ---------------- Matriz Fiscal ----------------

const matrizSchema = z.object({
  nome: z.string().min(3),
  crt: z.enum(["1", "2", "3"]),
  uf_origem: z.string().length(2),
  uf_destino: z.string().length(2),
  tipo_operacao: z.enum(["saida", "entrada"]),
  ncm_prefixo: z.string().max(8).optional(),
  cfop: z.string().regex(/^\d{4}$/, "CFOP deve ter 4 dígitos"),
  cst_csosn: z.string().min(2).max(3),
  origem_mercadoria: z.string().length(1),
  aliquota_icms: z.coerce.number().min(0).max(100),
  reducao_bc_icms: z.coerce.number().min(0).max(100),
  aliquota_fcp: z.coerce.number().min(0).max(100),
  cst_pis: z.string().min(2).max(3),
  aliquota_pis: z.coerce.number().min(0).max(100),
  cst_cofins: z.string().min(2).max(3),
  aliquota_cofins: z.coerce.number().min(0).max(100),
  cst_ipi: z.string().optional(),
  aliquota_ipi: z.coerce.number().min(0).max(100),
  prioridade: z.coerce.number().int().min(1).max(999),
  ativo: z.boolean(),
});
type MatrizForm = z.infer<typeof matrizSchema>;
interface MatrizRegra extends Omit<MatrizForm, "ncm_prefixo" | "cst_ipi"> {
  id: string;
  ncm_prefixo: string | null;
  cst_ipi: string | null;
}

const CRT_LABEL: Record<string, string> = {
  "1": "Simples Nacional",
  "2": "Simples — sublimite",
  "3": "Regime Normal",
};

function MatrizTab() {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const isAdmin = can("faturamento_fiscal:admin_fiscal");
  const { confirm: confirmDestructive, dialog: destructiveDialog } = useConfirmDestructive();
  const [editing, setEditing] = useState<MatrizRegra | null>(null);
  const [open, setOpen] = useState(false);

  const { data: regras, isLoading } = useQuery({
    queryKey: ["matriz-fiscal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriz_fiscal")
        .select("*")
        .order("prioridade")
        .order("nome");
      if (error) throw error;
      return data as MatrizRegra[];
    },
  });

  const form = useForm<MatrizForm>({
    resolver: zodResolver(matrizSchema),
    defaultValues: {
      nome: "",
      crt: "1",
      uf_origem: "SP",
      uf_destino: "SP",
      tipo_operacao: "saida",
      ncm_prefixo: "",
      cfop: "5102",
      cst_csosn: "102",
      origem_mercadoria: "0",
      aliquota_icms: 0,
      reducao_bc_icms: 0,
      aliquota_fcp: 0,
      cst_pis: "01",
      aliquota_pis: 0,
      cst_cofins: "01",
      aliquota_cofins: 0,
      cst_ipi: "",
      aliquota_ipi: 0,
      prioridade: 100,
      ativo: true,
    },
  });

  const openNew = () => {
    setEditing(null);
    form.reset();
    setOpen(true);
  };
  const openEdit = (m: MatrizRegra) => {
    setEditing(m);
    form.reset({
      ...m,
      ncm_prefixo: m.ncm_prefixo ?? "",
      cst_ipi: m.cst_ipi ?? "",
    });
    setOpen(true);
  };

  const duplicarRegra = (m: MatrizRegra) => {
    setEditing(null);
    form.reset({
      ...m,
      nome: `${m.nome} (cópia)`,
      ncm_prefixo: m.ncm_prefixo ?? "",
      cst_ipi: m.cst_ipi ?? "",
    });
    setOpen(true);
  };

  const onSubmit = async (values: MatrizForm) => {
    const payload = {
      ...values,
      ncm_prefixo: values.ncm_prefixo || null,
      cst_ipi: values.cst_ipi || null,
      uf_origem: values.uf_origem.toUpperCase(),
      uf_destino: values.uf_destino.toUpperCase(),
    };
    try {
      if (editing) {
        const { error } = await supabase.from("matriz_fiscal").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Regra atualizada");
      } else {
        const { error } = await supabase.from("matriz_fiscal").insert([payload as never]);
        if (error) throw error;
        toast.success("Regra criada");
      }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["matriz-fiscal"] });
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDelete = async (m: MatrizRegra) => {
    await confirmDestructive(
      {
        verb: "Excluir",
        entity: `regra "${m.nome}"`,
        sideEffects: ["Notas futuras deixarão de aplicá-la automaticamente"],
      },
      async () => {
        const { error } = await supabase.from("matriz_fiscal").delete().eq("id", m.id);
        if (error) {
          notifyError(error);
          return;
        }
        toast.success("Regra excluída");
        queryClient.invalidateQueries({ queryKey: ["matriz-fiscal"] });
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Matriz Fiscal
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Regras de tributação por CRT, UF origem→destino e prefixo de NCM. O
            wizard de NF-e aplica a regra de maior prioridade automaticamente.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (regras ?? []).length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma regra cadastrada. Sem matriz, o wizard exigirá tributação
              manual por item.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 px-2">Nome</th>
                  <th className="py-2 px-2">CRT</th>
                  <th className="py-2 px-2">UF orig→dest</th>
                  <th className="py-2 px-2">NCM</th>
                  <th className="py-2 px-2">CFOP</th>
                  <th className="py-2 px-2">CST</th>
                  <th className="py-2 px-2 text-right">ICMS%</th>
                  <th className="py-2 px-2 text-right">Prio</th>
                  <th className="py-2 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(regras ?? []).map((m) => (
                  <tr key={m.id} className="border-b hover:bg-accent/30">
                    <td className="py-2 px-2">
                      <div className="font-medium">{m.nome}</div>
                      <div className="text-xs text-muted-foreground capitalize">{m.tipo_operacao}</div>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline">{m.crt}</Badge>
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {m.uf_origem} → {m.uf_destino}
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {m.ncm_prefixo ?? "—"}
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">{m.cfop}</td>
                    <td className="py-2 px-2 font-mono text-xs">{m.cst_csosn}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {Number(m.aliquota_icms).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right">{m.prioridade}</td>
                    <td className="py-2 px-2 text-right">
                      {isAdmin && (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Duplicar regra"
                            onClick={() => duplicarRegra(m)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(m)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar regra" : "Nova regra fiscal"}
        size="xl"
        mode={editing ? "edit" : "create"}
        isDirty={form.formState.isDirty}
        confirmOnDirty
        footer={
          <FormModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={form.handleSubmit(onSubmit)}
            saving={form.formState.isSubmitting}
            mode={editing ? "edit" : "create"}
            isDirty={form.formState.isDirty}
          />
        }
      >
        <form className="grid gap-3 py-2 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label htmlFor="m_nome">Nome da regra *</Label>
            <Input id="m_nome" {...form.register("nome")} placeholder="Venda interna SP — Regime Normal" />
          </div>

          <div>
            <Label>CRT</Label>
            <Select value={form.watch("crt")} onValueChange={(v) => form.setValue("crt", v as MatrizForm["crt"], { shouldDirty: true })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CRT_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{k} — {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>UF origem</Label>
            <Select value={form.watch("uf_origem")} onValueChange={(v) => form.setValue("uf_origem", v, { shouldDirty: true })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>UF destino</Label>
            <Select value={form.watch("uf_destino")} onValueChange={(v) => form.setValue("uf_destino", v, { shouldDirty: true })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.watch("tipo_operacao")} onValueChange={(v) => form.setValue("tipo_operacao", v as "saida" | "entrada", { shouldDirty: true })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="m_ncm">Prefixo NCM (opcional)</Label>
            <Input id="m_ncm" {...form.register("ncm_prefixo")} placeholder="2202 ou vazio" />
          </div>
          <div>
            <Label htmlFor="m_cfop">CFOP *</Label>
            <Input id="m_cfop" {...form.register("cfop")} placeholder="5102" maxLength={4} />
          </div>

          <div>
            <Label htmlFor="m_cst">CST/CSOSN *</Label>
            <Input id="m_cst" {...form.register("cst_csosn")} placeholder="00 / 102" />
          </div>
          <div>
            <Label htmlFor="m_orig">Origem mercadoria</Label>
            <Input id="m_orig" {...form.register("origem_mercadoria")} placeholder="0" maxLength={1} />
          </div>
          <div>
            <Label htmlFor="m_prio">Prioridade</Label>
            <Input id="m_prio" type="number" {...form.register("prioridade")} />
          </div>

          <div>
            <Label htmlFor="m_aliq">Alíquota ICMS (%)</Label>
            <Input id="m_aliq" type="number" step="0.01" {...form.register("aliquota_icms")} />
          </div>
          <div>
            <Label htmlFor="m_red">Redução BC ICMS (%)</Label>
            <Input id="m_red" type="number" step="0.01" {...form.register("reducao_bc_icms")} />
          </div>
          <div>
            <Label htmlFor="m_fcp">FCP (%)</Label>
            <Input id="m_fcp" type="number" step="0.01" {...form.register("aliquota_fcp")} />
          </div>

          <div>
            <Label htmlFor="m_cst_pis">CST PIS</Label>
            <Input id="m_cst_pis" {...form.register("cst_pis")} maxLength={3} />
          </div>
          <div>
            <Label htmlFor="m_aliq_pis">Alíquota PIS (%)</Label>
            <Input id="m_aliq_pis" type="number" step="0.0001" {...form.register("aliquota_pis")} />
          </div>
          <div>
            <Label htmlFor="m_cst_cofins">CST COFINS</Label>
            <Input id="m_cst_cofins" {...form.register("cst_cofins")} maxLength={3} />
          </div>
          <div>
            <Label htmlFor="m_aliq_cofins">Alíquota COFINS (%)</Label>
            <Input id="m_aliq_cofins" type="number" step="0.0001" {...form.register("aliquota_cofins")} />
          </div>
          <div>
            <Label htmlFor="m_cst_ipi">CST IPI</Label>
            <Input id="m_cst_ipi" {...form.register("cst_ipi")} maxLength={3} />
          </div>
          <div>
            <Label htmlFor="m_aliq_ipi">Alíquota IPI (%)</Label>
            <Input id="m_aliq_ipi" type="number" step="0.0001" {...form.register("aliquota_ipi")} />
          </div>

          <div className="flex items-center gap-2 sm:col-span-3">
            <Switch
              id="m_ativo"
              checked={form.watch("ativo")}
              onCheckedChange={(v) => form.setValue("ativo", v, { shouldDirty: true })}
            />
            <Label htmlFor="m_ativo">Regra ativa</Label>
          </div>
        </form>
      </FormModal>
      {destructiveDialog}
    </Card>
  );
}

// ---------------- Transportadoras (atalho) ----------------

function TransportadorasTab() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4" /> Transportadoras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Transportadoras são gerenciadas dentro do módulo de Logística.
        </p>
        <Button variant="outline" onClick={() => navigate("/logistica?tab=transportadoras")}>
          Abrir cadastro de transportadoras
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------- Página ----------------

export default function FaturamentoCadastros() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") as CadastroTab) || "naturezas";
  const [tab, setTab] = useState<CadastroTab>(VALID.includes(tabParam) ? tabParam : "naturezas");

  const handleTab = (next: string) => {
    const t = next as CadastroTab;
    setTab(t);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", t);
    setSearchParams(sp, { replace: true });
  };

  return (
    <ModulePage
      title="Cadastros do Faturamento"
      subtitle="Naturezas de operação, matriz fiscal e transportadoras (Onda 2)"
    >
      <Tabs value={tab} onValueChange={handleTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="naturezas" className="gap-2">
            <ScrollText className="h-4 w-4" /> Naturezas
          </TabsTrigger>
          <TabsTrigger value="matriz" className="gap-2">
            <Calculator className="h-4 w-4" /> Matriz Fiscal
          </TabsTrigger>
          <TabsTrigger value="transportadoras" className="gap-2">
            <Truck className="h-4 w-4" /> Transportadoras
          </TabsTrigger>
        </TabsList>
        <TabsContent value="naturezas" className="mt-4">
          <NaturezasTab />
        </TabsContent>
        <TabsContent value="matriz" className="mt-4">
          <MatrizTab />
        </TabsContent>
        <TabsContent value="transportadoras" className="mt-4">
          <TransportadorasTab />
        </TabsContent>
      </Tabs>
    </ModulePage>
  );
}