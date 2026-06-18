import { AdvancedFilterBar, type FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { MonthPicker } from "@/components/filters/MonthPicker";
import {
  tipoOptions,
  modeloOptions,
  statusOptions,
  origemOptions,
  statusSefazOptions,
} from "@/pages/fiscal/fiscalFilterOptions";

export interface FiscalFiltersBarProps {
  tipoParam: string | null;
  consultaSearch: string;
  setConsultaSearch: (v: string) => void;
  activeFilters: FilterChip[];
  onRemoveFilter: (key: string) => void;
  totalCount: number;
  tipoFilters: string[]; setTipoFilters: (v: string[]) => void;
  modeloFilters: string[]; setModeloFilters: (v: string[]) => void;
  statusFilters: string[]; setStatusFilters: (v: string[]) => void;
  origemFilters: string[]; setOrigemFilters: (v: string[]) => void;
  statusSefazFilters: string[]; setStatusSefazFilters: (v: string[]) => void;
  emissaoMes: string; setEmissaoMes: (v: string) => void;
  vencimentoMes: string; setVencimentoMes: (v: string) => void;
}

/**
 * Wrapper presentacional do AdvancedFilterBar do módulo Fiscal —
 * extraído do god-component em Etapa 6.3 (Pass 3).
 */
export function FiscalFiltersBar(props: FiscalFiltersBarProps) {
  const {
    tipoParam,
    consultaSearch, setConsultaSearch,
    activeFilters, onRemoveFilter, totalCount,
    tipoFilters, setTipoFilters,
    modeloFilters, setModeloFilters,
    statusFilters, setStatusFilters,
    origemFilters, setOrigemFilters,
    statusSefazFilters, setStatusSefazFilters,
    emissaoMes, setEmissaoMes,
    vencimentoMes, setVencimentoMes,
  } = props;

  return (
    <div data-help-id="fiscal.filtros">
      <AdvancedFilterBar
        searchValue={consultaSearch}
        onSearchChange={setConsultaSearch}
        searchPlaceholder="Número, chave de acesso…"
        activeFilters={activeFilters}
        onRemoveFilter={onRemoveFilter}
        onClearAll={() => {
          setTipoFilters([]);
          setModeloFilters([]);
          setStatusFilters([]);
          setOrigemFilters([]);
          setStatusSefazFilters([]);
          setEmissaoMes("");
          setVencimentoMes("");
        }}
        count={totalCount}
      >
        {!tipoParam && (
          <MultiSelect
            options={tipoOptions as MultiSelectOption[]}
            selected={tipoFilters}
            onChange={setTipoFilters}
            placeholder="Tipo"
            className="w-[150px]"
          />
        )}
        <MultiSelect options={modeloOptions} selected={modeloFilters} onChange={setModeloFilters} placeholder="Modelos" className="w-[180px]" />
        <MultiSelect options={statusOptions} selected={statusFilters} onChange={setStatusFilters} placeholder="Status ERP" className="w-[180px]" />
        <MultiSelect options={origemOptions} selected={origemFilters} onChange={setOrigemFilters} placeholder="Origem" className="w-[180px]" />
        <MultiSelect options={statusSefazOptions} selected={statusSefazFilters} onChange={setStatusSefazFilters} placeholder="Status SEFAZ" className="w-[180px]" />
        <MonthPicker label="Emissão" value={emissaoMes} onChange={setEmissaoMes} />
        <MonthPicker label="Vencimento" value={vencimentoMes} onChange={setVencimentoMes} />
      </AdvancedFilterBar>
    </div>
  );
}