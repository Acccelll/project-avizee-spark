import { DataTable } from "@/components/DataTable";
import type { ComponentProps } from "react";

/**
 * Etapa 15 — Data Grid corporativo do módulo Fiscal.
 *
 * Wrapper fino sobre o `DataTable` do Design System que aplica os defaults
 * do domínio fiscal (permissão de exportação, chave de módulo, densidade e
 * ativação de virtualização a partir de 50 linhas). Todas as props do
 * `DataTable` continuam disponíveis para override — nenhuma regra fiscal
 * nova, apenas padronização de UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataTableProps<T extends Record<string, any>> = ComponentProps<typeof DataTable<T>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FiscalDataGrid<T extends Record<string, any>>(
  props: DataTableProps<T>,
) {
  return (
    <DataTable
      exportPermission="faturamento_fiscal:exportar"
      virtualizeThreshold={50}
      maxHeight={640}
      emptyTitle="Nenhum documento fiscal encontrado"
      emptyDescription="Ajuste o período ou a empresa selecionada no workspace fiscal."
      {...props}
    />
  );
}

export default FiscalDataGrid;