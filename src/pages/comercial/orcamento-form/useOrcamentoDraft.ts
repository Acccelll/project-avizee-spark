import { useEffect } from "react";
import {
  hasOrcamentoDraft,
  upsertOrcamentoDraft,
} from "@/services/orcamentos.service";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";

interface DraftArgs {
  draftKey: string;
  isEdit: boolean;
  status: string | undefined;
  userId: string | undefined;
  items: OrcamentoItem[];
  getValues: () => OrcamentoFormValues;
  buildDraftPayload: () => Record<string, unknown>;
  setRestoreDraftOpen: (open: boolean) => void;
  setLastAutoSaveAt: (iso: string) => void;
}

/**
 * Orquestra restore + autosave de rascunho:
 *  - restore: tenta `orcamento_drafts` (servidor) e cai para `localStorage`;
 *  - autosave (30s): mesma cascata; ignora orçamentos editados fora de "rascunho".
 */
export function useOrcamentoDraft({
  draftKey,
  isEdit,
  status,
  userId,
  items,
  getValues,
  buildDraftPayload,
  setRestoreDraftOpen,
  setLastAutoSaveAt,
}: DraftArgs) {
  // Restore (apenas em criação)
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    (async () => {
      if (userId) {
        const has = await hasOrcamentoDraft(userId, draftKey).catch(() => false);
        if (cancelled) return;
        if (has) { setRestoreDraftOpen(true); return; }
      }
      const saved = localStorage.getItem(draftKey);
      if (!cancelled && saved) setRestoreDraftOpen(true);
    })();
    return () => { cancelled = true; };
  }, [draftKey, isEdit, userId, setRestoreDraftOpen]);

  // Autosave a cada 30s
  useEffect(() => {
    const timer = setInterval(async () => {
      if (isEdit && status && status !== "rascunho") return;
      const { numero: n, clienteId: cid } = getValues();
      if (!n && !cid && items.length === 0) return;
      const payload = buildDraftPayload();
      const serialized = JSON.stringify(payload);
      let serverOk = false;
      if (userId) {
        try {
          await upsertOrcamentoDraft(userId, draftKey, payload);
          serverOk = true;
        } catch {/* fallback abaixo */}
      }
      if (!serverOk) {
        try { localStorage.setItem(draftKey, serialized); } catch {/* quota */}
      }
      setLastAutoSaveAt(new Date().toISOString());
    }, 30000);
    return () => clearInterval(timer);
  }, [buildDraftPayload, draftKey, getValues, items.length, userId, isEdit, status, setLastAutoSaveAt]);
}