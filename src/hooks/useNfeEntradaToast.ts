import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSidebarAlerts } from "@/hooks/useSidebarAlerts";

/**
 * Observa o contador `nfeEntradaSemManifestacao` e dispara um toast informativo
 * sempre que aumenta (típico cenário: cron `process-distdfe-cron` acabou de
 * baixar NF-e novas via DistDF-e e o realtime da tabela `nfe_distribuicao`
 * invalidou o cache).
 *
 * Estratégia anti-falso-positivo:
 *  - Ignora a primeira leitura (snapshot inicial não é "novo").
 *  - Persiste o último valor observado em sessionStorage por aba — assim
 *    navegação entre rotas não dispara duplicado.
 */
export function useNfeEntradaToast() {
  const alerts = useSidebarAlerts();
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    const atual = alerts.nfeEntradaSemManifestacao;
    const prevStr = sessionStorage.getItem("nfe_entrada_count");
    const prev = prevStr === null ? null : Number(prevStr);

    if (!initialized.current) {
      initialized.current = true;
      // primeira leitura: só armazena
      if (prev === null) sessionStorage.setItem("nfe_entrada_count", String(atual));
      return;
    }

    if (prev !== null && atual > prev) {
      const novas = atual - prev;
      toast.info(`${novas} NF-e nova(s) recebida(s)`, {
        description: "Notas de entrada baixadas via SEFAZ aguardando manifestação.",
        action: {
          label: "Ver",
          onClick: () => navigate("/faturamento?tab=manifestacao"),
        },
      });
    }
    sessionStorage.setItem("nfe_entrada_count", String(atual));
  }, [alerts.nfeEntradaSemManifestacao, navigate]);
}
