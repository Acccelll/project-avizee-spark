import { useLocation } from "react-router-dom";
import { useMeusChamados } from "./useMeusChamados";
import { coletarDiagnosticoAutomatico } from "@/services/suporte/diagnostico.service";
import type {
  SuporteAbrangencia,
  SuporteFrequencia,
  SuporteImpacto,
  SuporteTipo,
} from "@/services/suporte/types";

export interface AbrirChamadoFormValues {
  tipo: SuporteTipo;
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto;
  abrangencia: SuporteAbrangencia;
  frequencia: SuporteFrequencia;
}

/**
 * "Abrir chamado" (Parte I, item 2 e 6) — caminho genérico, com tipo livre
 * (Bug, Problema operacional, Dúvida ou Sugestão de melhoria), diferente do
 * botão "Reportar problema" (que nasce sempre como Bug). Mesmo pacote de
 * diagnóstico automático (seção 9) é injetado em qualquer tipo.
 */
export function useAbrirChamado() {
  const { pathname, search } = useLocation();
  const { abrir } = useMeusChamados();

  async function enviar(values: AbrirChamadoFormValues) {
    const diagnostico = coletarDiagnosticoAutomatico();
    return abrir.mutateAsync({
      tipo: values.tipo,
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
