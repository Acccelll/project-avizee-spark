import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import type { Column } from "@/components/DataTable";
import type { NotaFiscal } from "@/types/domain";

export type FiscalSortKey = "data_emissao" | "numero" | "valor_total" | "created_at";

export interface FiscalNotasTableProps {
  columns: Column<NotaFiscal>[];
  data: NotaFiscal[];
  loading: boolean;
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  totalCount: number;
  sortKey: FiscalSortKey;
  sortAsc: boolean;
  onServerSort: (key: string | null, dir: "asc" | "desc" | null) => void;
  moduleKey: string;
  onView: (n: NotaFiscal) => void;
  onEdit: (n: NotaFiscal) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  mobilePrimaryAction: (row: NotaFiscal) => React.ReactNode;
  mobileInlineActions: (row: NotaFiscal) => React.ReactNode;
}

/**
 * Tabela paginada do módulo Fiscal — extraída do god-component em Etapa 6.3 (Pass 3).
 * Apenas apresentação + repasse de props; toda lógica de filtros/queries vive nos hooks pais.
 */
export function FiscalNotasTable(props: FiscalNotasTableProps) {
  const {
    columns, data, loading,
    page, setPage, pageSize, totalCount,
    sortKey, sortAsc, onServerSort,
    moduleKey, onView, onEdit,
    hasFilters, onClearFilters,
    mobilePrimaryAction, mobileInlineActions,
  } = props;

  return (
    <div data-help-id="fiscal.tabela">
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pageSize={pageSize}
        serverPagination={{ page, setPage, totalCount, hasMore: (page + 1) * pageSize < totalCount }}
        defaultSortKey={sortKey}
        defaultSortDir={sortAsc ? "asc" : "desc"}
        serverSortKey={sortKey}
        serverSortDir={sortAsc ? "asc" : "desc"}
        onServerSort={onServerSort}
        moduleKey={moduleKey}
        showColumnToggle
        onView={onView}
        onEdit={onEdit}
        emptyTitle={hasFilters ? "Nenhuma nota corresponde aos filtros" : "Nenhuma nota fiscal encontrada"}
        emptyDescription={
          hasFilters
            ? "Ajuste ou limpe os filtros para ver mais resultados."
            : "Importe um XML, busque por chave ou emita uma nova nota."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          ) : undefined
        }
        mobileStatusKey="status"
        mobileIdentifierKey="parceiro"
        mobilePrimaryAction={mobilePrimaryAction}
        mobileInlineActions={mobileInlineActions}
      />
    </div>
  );
}