import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { formatDate } from "@/lib/format";
import { PageShell } from "@/components/PageShell";

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovada", label: "Aprovado" },
  { value: "em_separacao", label: "Em Separação" },
  { value: "separado", label: "Separado" },
  { value: "em_transporte", label: "Em Transporte" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelada", label: "Cancelado" },
];

interface PedidoEditForm {
  status: string;
  po_number: string;
  data_po_cliente: string;
  data_prometida_despacho: string;
  prazo_despacho_dias: string;
  observacoes: string;
}

interface PedidoRecord {
  id: string;
  numero: string;
  status: string | null;
  data_emissao: string | null;
  po_number: string | null;
  data_po_cliente: string | null;
  data_prometida_despacho: string | null;
  prazo_despacho_dias: number | null;
  observacoes: string | null;
  valor_total: number | null;
  clientes?: { nome_razao_social: string } | null;
  orcamentos?: { numero: string } | null;
}

const PedidoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pedido, setPedido] = useState<PedidoRecord | null>(null);
  const [form, setForm] = useState<PedidoEditForm>({
    status: "",
    po_number: "",
    data_po_cliente: "",
    data_prometida_despacho: "",
    prazo_despacho_dias: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("ordens_venda")
          .select("id, numero, status, data_emissao, po_number, data_po_cliente, data_prometida_despacho, prazo_despacho_dias, observacoes, valor_total, clientes(nome_razao_social), orcamentos(numero)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("Pedido não encontrado.");
          navigate("/pedidos");
          return;
        }
        const typed = data as unknown as PedidoRecord;
        setPedido(typed);
        setForm({
          status: typed.status || "pendente",
          po_number: typed.po_number || "",
          data_po_cliente: typed.data_po_cliente || "",
          data_prometida_despacho: typed.data_prometida_despacho || "",
          prazo_despacho_dias: typed.prazo_despacho_dias != null ? String(typed.prazo_despacho_dias) : "",
          observacoes: typed.observacoes || "",
        });
      } catch (err: unknown) {
        toast.error(getUserFriendlyError(err));
        navigate("/pedidos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordens_venda")
        .update({
          status: form.status || null,
          po_number: form.po_number || null,
          data_po_cliente: form.data_po_cliente || null,
          data_prometida_despacho: form.data_prometida_despacho || null,
          prazo_despacho_dias: form.prazo_despacho_dias ? Number(form.prazo_despacho_dias) : null,
          observacoes: form.observacoes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Pedido atualizado com sucesso.");
      navigate("/pedidos");
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof PedidoEditForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Carregando pedido...</div>;
  }

  if (!pedido) return null;

  return (
    <PageShell
      backTo="/pedidos"
      title={`Editando Pedido — ${pedido.numero}`}
      subtitle={
        <>
          {pedido.clientes?.nome_razao_social || "—"}
          {pedido.orcamentos?.numero ? ` · Cotação ${pedido.orcamentos.numero}` : ""}
        </>
      }
      actions={
        <>
          <StatusBadge status={pedido.status} />
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </>
      }
      meta={
        <div className="flex items-center flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card/60 px-5 py-3 text-sm shadow-soft">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pedido</span>
            <span className="font-mono font-bold text-primary">{pedido.numero}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Emissão</span>
            <span className="font-medium">{formatDate(pedido.data_emissao)}</span>
          </div>
          {pedido.valor_total != null && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total</span>
              <span className="font-mono font-bold text-primary">
                {Number(pedido.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}
        </div>
      }
    >
      <div className="max-w-2xl space-y-5">
        {/* Status + Datas */}
        <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Status Operacional</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data Prometida de Despacho</Label>
              <Input
                type="date"
                value={form.data_prometida_despacho}
                onChange={(e) => set("data_prometida_despacho", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo de Despacho (dias)</Label>
              <Input
                type="number"
                min={0}
                value={form.prazo_despacho_dias}
                onChange={(e) => set("prazo_despacho_dias", e.target.value)}
                placeholder="Ex: 5"
              />
            </div>
          </div>
        </div>

        {/* PO do Cliente */}
        <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
          <h3 className="font-semibold text-foreground">PO do Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Número do PO</Label>
              <Input
                value={form.po_number}
                onChange={(e) => set("po_number", e.target.value)}
                placeholder="Ex: PO-2024-0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do PO</Label>
              <Input
                type="date"
                value={form.data_po_cliente}
                onChange={(e) => set("data_po_cliente", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Observações</h3>
          <Textarea
            value={form.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Observações internas ou para o cliente..."
            className="min-h-[100px]"
          />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/pedidos")}>
            Cancelar
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

export default PedidoForm;
