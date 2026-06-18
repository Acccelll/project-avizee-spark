import type { FieldErrors } from "react-hook-form";
import { CheckCircle2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ClientSelector } from "@/components/ui/DataSelector";
import type { Tables } from "@/integrations/supabase/types";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { ClienteSnapshot } from "./types";

interface ClienteOption {
  id: string;
  label: string;
  sublabel?: string;
  rightMeta?: string;
  searchTerms?: string[];
}

interface Props {
  clienteOptions: ClienteOption[];
  clientes: Tables<"clientes">[];
  clienteId: string;
  clienteSnapshot: ClienteSnapshot;
  fieldErrors: FieldErrors<OrcamentoFormValues>;
  onClienteChange: (id: string) => void;
  onQuickAdd: () => void;
}

/** Card de seleção e exibição dos dados do cliente do orçamento. */
export function ClienteCard({
  clienteOptions, clientes, clienteId, clienteSnapshot, fieldErrors, onClienteChange, onQuickAdd,
}: Props) {
  return (
    <div className="bg-card rounded-xl border shadow-soft p-5">
      <h3 className="font-semibold text-foreground mb-4">Cliente</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-2 space-y-1.5">
            <Label className="text-xs">Buscar Cliente</Label>
            <div className="flex gap-2">
              <AutocompleteSearch
                options={clienteOptions}
                value={clienteId}
                onChange={onClienteChange}
                placeholder="Buscar por nome ou CNPJ..."
                className="flex-1"
                onCreateNew={onQuickAdd}
                createNewLabel="Cadastrar novo cliente"
              />
              {clienteId && !fieldErrors.clienteId && <CheckCircle2 className="h-4 w-4 text-success mt-3" />}
              <ClientSelector
                clientes={clientes}
                onSelect={(c) => onClienteChange(c.id)}
                trigger={
                  <Button type="button" variant="outline" size="icon" className="hidden md:inline-flex h-10 w-10 shrink-0" aria-label="Ver lista completa de clientes" title="Ver lista completa">
                    <Search className="h-4 w-4" />
                  </Button>
                }
              />
              <Button type="button" variant="outline" size="icon" className="hidden md:inline-flex h-10 w-10 shrink-0" onClick={onQuickAdd} aria-label="Cadastrar novo cliente" title="Cadastrar novo cliente">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="hidden md:block space-y-1.5"><Label className="text-xs" title="Identificador interno (cód. legado/ERP)">Código do cliente</Label><Input value={clienteSnapshot.codigo} readOnly className="bg-accent/30 font-mono text-xs" /></div>
        </div>
        {fieldErrors.clienteId && <p className="text-[11px] text-destructive">{fieldErrors.clienteId.message}</p>}
        {clienteId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-accent/20 rounded-lg p-3">
            <div className="md:col-span-2 space-y-0.5"><Label className="text-xs text-muted-foreground">Razão Social</Label><p className="font-medium text-sm leading-tight">{clienteSnapshot.nome_razao_social}</p></div>
            <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">CNPJ/CPF</Label><p className="font-mono text-xs">{clienteSnapshot.cpf_cnpj || "—"}</p></div>
            <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Cidade/UF</Label><p className="text-sm">{clienteSnapshot.cidade ? `${clienteSnapshot.cidade}/${clienteSnapshot.uf}` : "—"}</p></div>
            {clienteSnapshot.email && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Email</Label><p className="text-xs truncate">{clienteSnapshot.email}</p></div>}
            {clienteSnapshot.telefone && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Telefone</Label><p className="text-xs">{clienteSnapshot.telefone}</p></div>}
            {clienteSnapshot.codigo && (
              <div className="md:hidden space-y-0.5"><Label className="text-xs text-muted-foreground">Código do cliente</Label><p className="font-mono text-xs">{clienteSnapshot.codigo}</p></div>
            )}
          </div>
        )}
        {clienteId && (clienteSnapshot.logradouro || clienteSnapshot.bairro || clienteSnapshot.cep) && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Endereço</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="md:col-span-2 space-y-0.5">
                <Label className="text-xs text-muted-foreground">Logradouro</Label>
                <p className="text-sm leading-tight">{clienteSnapshot.logradouro || "—"}{clienteSnapshot.numero ? `, ${clienteSnapshot.numero}` : ""}</p>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <p className="text-sm">{clienteSnapshot.bairro || "—"}</p>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">CEP</Label>
                <p className="font-mono text-xs">{clienteSnapshot.cep || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
