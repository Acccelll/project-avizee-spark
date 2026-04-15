/**
 * FiltrosRelatorio — composite filter row rendered below the period filter.
 *
 * Handles: cliente multi-select, fornecedor multi-select, grupo multi-select,
 * status select, sort-grouping select, tipos multi-select, DRE competência.
 *
 * All state lives in the parent; this component is fully controlled.
 */

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/input";
import type { ReportFiltersDef } from "@/config/relatoriosConfig";
import type { ClienteRef, FornecedorRef, GrupoProdutoRef } from "../hooks/useRelatoriosFiltrosData";

export type Agrupamento = "padrao" | "valor_desc" | "status" | "vencimento";
export type DreCompetencia = "mes" | "trimestre" | "ano" | "personalizado";

export interface FiltrosRelatorioState {
  clienteIds: string[];
  fornecedorIds: string[];
  grupoIds: string[];
  statusFiltro: string;
  agrupamento: Agrupamento;
  tipos: string[];
  dreCompetencia: DreCompetencia;
  dreMes: string;
}

export interface FiltrosRelatorioProps {
  filters: ReportFiltersDef;
  state: FiltrosRelatorioState;
  clientes: ClienteRef[];
  fornecedores: FornecedorRef[];
  grupos: GrupoProdutoRef[];
  onChange: (partial: Partial<FiltrosRelatorioState>) => void;
}

export function FiltrosRelatorio({
  filters,
  state,
  clientes,
  fornecedores,
  grupos,
  onChange,
}: FiltrosRelatorioProps) {
  return (
    <>
      <div className="flex flex-wrap gap-3 items-end">
        {filters.showClientes && (
          <div className="space-y-1">
            <Label className="text-xs">Clientes</Label>
            <MultiSelect
              options={clientes.map((c) => ({ label: c.nome_razao_social, value: c.id }))}
              selected={state.clienteIds}
              onChange={(v) => onChange({ clienteIds: v })}
              placeholder="Todos os clientes"
              className="w-[250px]"
            />
          </div>
        )}

        {filters.showFornecedores && (
          <div className="space-y-1">
            <Label className="text-xs">Fornecedores</Label>
            <MultiSelect
              options={fornecedores.map((f) => ({ label: f.nome_razao_social, value: f.id }))}
              selected={state.fornecedorIds}
              onChange={(v) => onChange({ fornecedorIds: v })}
              placeholder="Todos os fornecedores"
              className="w-[250px]"
            />
          </div>
        )}

        {filters.showGrupos && (
          <div className="space-y-1">
            <Label className="text-xs">Grupos de Produto</Label>
            <MultiSelect
              options={grupos.map((g) => ({ label: g.nome, value: g.id }))}
              selected={state.grupoIds}
              onChange={(v) => onChange({ grupoIds: v })}
              placeholder="Todos os grupos"
              className="w-[220px]"
            />
          </div>
        )}

        {filters.showStatus && (
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={state.statusFiltro} onValueChange={(v) => onChange({ statusFiltro: v })}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago">Pago/Confirmado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Agrupamento</Label>
          <Select value={state.agrupamento} onValueChange={(v) => onChange({ agrupamento: v as Agrupamento })}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="padrao">Padrão do relatório</SelectItem>
              <SelectItem value="valor_desc">Maior valor primeiro</SelectItem>
              <SelectItem value="status">Por status</SelectItem>
              <SelectItem value="vencimento">Por vencimento/data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filters.showTipos && (
          <div className="space-y-1">
            <Label className="text-xs">Tipos</Label>
            <MultiSelect
              options={[
                { label: "A Receber", value: "receber" },
                { label: "A Pagar", value: "pagar" },
              ]}
              selected={state.tipos}
              onChange={(v) => onChange({ tipos: v })}
              placeholder="Todos"
              className="w-[180px]"
            />
          </div>
        )}
      </div>

      {filters.showDreCompetencia && (
        <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Competência</Label>
            <Select
              value={state.dreCompetencia}
              onValueChange={(v) => onChange({ dreCompetencia: v as DreCompetencia })}
            >
              <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês específico</SelectItem>
                <SelectItem value="trimestre">Trimestre atual</SelectItem>
                <SelectItem value="ano">Ano atual</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.dreCompetencia === "mes" && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Mês/Ano</Label>
              <Input
                type="month"
                value={state.dreMes}
                onChange={(e) => onChange({ dreMes: e.target.value })}
                className="h-9 w-[160px]"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
