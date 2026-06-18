import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, type PeriodValue } from "@/components/filters/PeriodFilter";
import { periodToDateFrom, periodToDateTo } from "@/lib/periodFilter";
import type { Period } from "@/components/filters/periodTypes";
import {
  Upload, CheckCheck, Shuffle, Landmark, FileDown, MoreHorizontal,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ContaBancariaDropdown } from "@/services/financeiro/conciliacaoLoaders.service";

interface Props {
  isMobile: boolean;
  contasBancarias: ContaBancariaDropdown[];
  selectedConta: string;
  onContaChange: (id: string) => void;
  dataInicio: string;
  dataFim: string;
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  hasExtrato: boolean;
  hasLancamentos: boolean;
  onConciliacaoAutomatica: () => void;
  onMatchPorValor: () => void;
  onExportar: () => void;
}

export function ConciliacaoTopControls(p: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-5 items-end">
      <div className="flex flex-col gap-1 w-full sm:w-auto">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Landmark className="w-3 h-3" />Conta Bancária
        </label>
        <Select value={p.selectedConta} onValueChange={p.onContaChange}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Selecionar conta..." />
          </SelectTrigger>
          <SelectContent>
            {p.contasBancarias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}{c.banco ? ` — ${c.banco}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <PeriodFilter
          mode="both"
          value={{ preset: null, from: p.dataInicio || null, to: p.dataFim || null }}
          onChange={(next: PeriodValue) => {
            if (next.preset) {
              const from = periodToDateFrom(next.preset as Period);
              const to = periodToDateTo(next.preset as Period) ?? new Date().toISOString().slice(0, 10);
              p.setDataInicio(from);
              p.setDataFim(to);
              return;
            }
            p.setDataInicio(next.from || "");
            p.setDataFim(next.to || "");
          }}
          direction="past"
        />
      </div>

      <div className="flex gap-2 ml-auto items-center">
        <input
          ref={p.fileInputRef}
          type="file"
          accept=".ofx,.qfx,.xml"
          className="hidden"
          onChange={p.onFileSelect}
        />
        <Button onClick={() => p.fileInputRef.current?.click()} disabled={p.uploading} variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {p.uploading ? "Importando..." : "Importar OFX"}
        </Button>

        {!p.isMobile && p.hasExtrato && p.hasLancamentos && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={p.onConciliacaoAutomatica} variant="default" size="sm">
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Conciliar Automaticamente
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs leading-relaxed">
                    Usa score de similaridade (valor, data, descrição) para parear lançamentos
                    com alta confiança ≥ 90%. Recomendado para a maioria dos casos.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={p.onMatchPorValor} variant="secondary" size="sm">
                    <Shuffle className="w-4 h-4 mr-2" />
                    Match por Valor
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs leading-relaxed">
                    Pareamento simples por valor exato (±R$0,01) e data próxima (±3 dias).
                    Use se a conciliação automática não encontrar todos os pares.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
        {!p.isMobile && (
          <Button variant="outline" size="sm" onClick={p.onExportar}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        )}
        {p.isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {p.hasExtrato && p.hasLancamentos && (
                <>
                  <DropdownMenuItem onSelect={p.onConciliacaoAutomatica}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Conciliar Automaticamente
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={p.onMatchPorValor}>
                    <Shuffle className="w-4 h-4 mr-2" />
                    Match por Valor
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onSelect={p.onExportar}>
                <FileDown className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}