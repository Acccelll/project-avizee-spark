import { useLocation } from "react-router-dom";
import { useMeusChamados } from "./useMeusChamados";
import { coletarDiagnosticoAutomatico } from "@/services/suporte/diagnostico.service";
import type {
  SuporteAbrangencia,
  SuporteFrequencia,
  SuporteImpacto,
} from "@/services/suporte/types";

export interface ReportarProblemaFormValues {
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto;
  abrangencia: SuporteAbrangencia;
  frequencia: SuporteFrequencia;
}

/**
 * Wrapper de alto nível para o botão global "Reportar problema" (seção 3/4
 * da especificação). Nasce sempre como tipo `bug` (o admin reclassifica
 * depois, se necessário — seção 6) e já injeta o contexto técnico
 * automático coletado da tela atual.
 */
export function useReportarProblema() {
  const { pathname, search } = useLocation();
  const { abrir } = useMeusChamados();

  async function enviar(values: ReportarProblemaFormValues) {
    const diagnostico = coletarDiagnosticoAutomatico();
    return abrir.mutateAsync({
      tipo: "bug",
      resumo: values.resumo,
      descricao: values.descricao,
      impacto: values.impacto,
      abrangencia: values.abrangencia,
      frequencia: values.frequencia,
      rota: `${pathname}${search}`,
      diagnostico,
    });
  }

  return { enviar, isSubmitting: abrir.isPending };
}
