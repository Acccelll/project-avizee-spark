import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useSidebarAlerts } from "@/hooks/useSidebarAlerts";
import {
  aplicarCienciaEmLote,
  buscarNfeSemManifestacao,
} from "@/services/fiscal/autoCiencia.service";

/**
 * Auto-Ciência DistDF-e — Onda 17.
 *
 * Quando a flag `app_configuracoes.distdfe_auto_ciencia=true` está ligada,
 * observa o contador `nfeEntradaSemManifestacao` (atualizado em tempo real
 * via realtime). Sempre que o contador aumenta — sinal de que o cron baixou
 * NF-e novas — dispara `aplicarCienciaEmLote` em background.
 *
 * Salvaguardas:
 *  - `running` previne reentrada (uma execução por vez).
 *  - Ignora a primeira leitura para não disparar no mount inicial.
 *  - Toast informativo no início e no fim, sem bloquear navegação.
 */
export function useAutoCienciaDistDFe() {
  const { value: enabled } = useAppConfig<boolean>("distdfe_auto_ciencia", false);
  const alerts = useSidebarAlerts();
  const initialized = useRef(false);
  const lastCount = useRef<number | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const atual = alerts.nfeEntradaSemManifestacao;

    if (!initialized.current) {
      initialized.current = true;
      lastCount.current = atual;
      return;
    }

    const prev = lastCount.current ?? 0;
    lastCount.current = atual;
    if (atual <= prev) return;
    if (running.current) return;

    running.current = true;
    const novas = atual - prev;
    void (async () => {
      const tid = toast.loading(
        `Aplicando ciência automática em ${novas} NF-e...`,
      );
      try {
        const notas = await buscarNfeSemManifestacao(Math.max(novas, 50));
        const r = await aplicarCienciaEmLote(notas);
        toast.dismiss(tid);
        if (r.sucesso > 0) {
          toast.success(
            `Ciência aplicada em ${r.sucesso} NF-e${r.falhas > 0 ? ` · ${r.falhas} falha(s)` : ""}`,
          );
        } else if (r.falhas > 0) {
          toast.error(`Auto-ciência falhou em ${r.falhas} NF-e`);
        }
      } catch (e) {
        toast.dismiss(tid);
        toast.error(
          `Auto-ciência indisponível: ${(e as Error).message}`,
        );
      } finally {
        running.current = false;
      }
    })();
  }, [enabled, alerts.nfeEntradaSemManifestacao]);
}