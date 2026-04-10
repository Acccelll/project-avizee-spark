import { FormModal } from "@/components/FormModal";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { CompraFormValues } from "@/hooks/useCompras";
import type { Database } from "@/integrations/supabase/types";

type FornecedorRow = Database["public"]["Tables"]["fornecedores"]["Row"];
type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];

interface CompraFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  form: CompraFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<CompraFormValues>>;
  items: GridItem[];
  onItemsChange: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  selectedFornecedor: FornecedorRow | undefined;
  produtosData: ProdutoRow[];
  valorProdutos: number;
  valorTotal: number;
}

export function CompraFormModal({
  open,
  onClose,
  title,
  form,
  onFormChange,
  items,
  onItemsChange,
  saving,
  onSubmit,
  fornecedorOptions,
  selectedFornecedor,
  produtosData,
  valorProdutos,
  valorTotal,
}: CompraFormModalProps) {
  return (
    <FormModal open={open} onClose={onClose} title={title} size="xl">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Número *</Label>
            <Input
              value={form.numero}
              onChange={(e) => onFormChange({ ...form, numero: e.target.value })}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Data Compra</Label>
            <Input
              type="date"
              value={form.data_compra}
              onChange={(e) => onFormChange({ ...form, data_compra: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => onFormChange({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Cotação</SelectItem>
                <SelectItem value="confirmado">Pedido Confirmado</SelectItem>
                <SelectItem value="parcial">Recebimento Parcial</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 rounded-lg bg-accent/30 p-4">
          <Label className="text-sm font-semibold">Fornecedor</Label>
          <AutocompleteSearch
            options={fornecedorOptions}
            value={form.fornecedor_id}
            onChange={(id) => onFormChange({ ...form, fornecedor_id: id })}
            placeholder="Buscar por nome ou CNPJ..."
          />
          {selectedFornecedor && (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <p>
                <span className="text-xs text-muted-foreground">Razão Social:</span>
                <br />
                {selectedFornecedor.nome_razao_social}
              </p>
              <p>
                <span className="text-xs text-muted-foreground">CNPJ:</span>
                <br />
                <span className="font-mono">{selectedFornecedor.cpf_cnpj || "—"}</span>
              </p>
              <p>
                <span className="text-xs text-muted-foreground">Contato:</span>
                <br />
                {selectedFornecedor.telefone || "—"}
              </p>
            </div>
          )}
        </div>

        <ItemsGrid
          items={items}
          onChange={onItemsChange}
          produtos={produtosData}
          title="Itens da Compra"
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Frete</Label>
            <Input
              type="number"
              step="0.01"
              value={form.frete_valor}
              onChange={(e) =>
                onFormChange({ ...form, frete_valor: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Impostos</Label>
            <Input
              type="number"
              step="0.01"
              value={form.impostos_valor}
              onChange={(e) =>
                onFormChange({ ...form, impostos_valor: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Entrega Prevista</Label>
            <Input
              type="date"
              value={form.data_entrega_prevista}
              onChange={(e) =>
                onFormChange({ ...form, data_entrega_prevista: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Entrega Real</Label>
            <Input
              type="date"
              value={form.data_entrega_real}
              onChange={(e) =>
                onFormChange({ ...form, data_entrega_real: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-accent/50 p-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Produtos:</span>{" "}
            <span className="font-mono font-semibold">{formatCurrency(valorProdutos)}</span>
            <span className="mx-3 text-muted-foreground">|</span>
            <span className="text-muted-foreground">Frete:</span>{" "}
            <span className="font-mono">{formatCurrency(form.frete_valor || 0)}</span>
            <span className="mx-3 text-muted-foreground">|</span>
            <span className="text-muted-foreground">Impostos:</span>{" "}
            <span className="font-mono">{formatCurrency(form.impostos_valor || 0)}</span>
          </div>
          <div>
            <span className="mr-2 text-sm text-muted-foreground">TOTAL:</span>
            <span className="text-lg font-bold font-mono text-primary">
              {formatCurrency(valorTotal)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => onFormChange({ ...form, observacoes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
