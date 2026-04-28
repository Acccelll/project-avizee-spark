/**
 * useWebhooks — hooks React Query para o painel de webhooks de saída.
 * Admin-only: depende de RLS server-side; o gate `useIsAdmin` controla o
 * render da seção (esses hooks ainda funcionam para evitar quebrar testes).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createEndpoint,
  deleteEndpoint,
  fetchMetrics,
  listDeliveries,
  listEndpoints,
  replayDelivery,
  rotateSecret,
  triggerDispatcher,
  updateEndpoint,
  type WebhookDelivery,
  type WebhookEndpoint,
  type WebhookEventoStatus,
  type WebhookMetrics,
} from "@/services/webhooks.service";

const KEY = ["webhooks"] as const;

export function useWebhookEndpoints() {
  return useQuery<WebhookEndpoint[]>({
    queryKey: [...KEY, "endpoints"],
    queryFn: listEndpoints,
    staleTime: 30_000,
  });
}

export function useWebhookDeliveries(opts?: { endpointId?: string; status?: WebhookEventoStatus }) {
  return useQuery<WebhookDelivery[]>({
    queryKey: [...KEY, "deliveries", opts ?? {}],
    queryFn: () => listDeliveries(opts),
    staleTime: 15_000,
  });
}

export function useWebhookMetrics() {
  return useQuery<WebhookMetrics>({
    queryKey: [...KEY, "metrics"],
    queryFn: fetchMetrics,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useWebhookMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: createEndpoint,
    onSuccess: () => { invalidate(); toast.success("Webhook criado."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar webhook."),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<WebhookEndpoint> }) => updateEndpoint(id, patch),
    onSuccess: () => { invalidate(); toast.success("Webhook atualizado."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: deleteEndpoint,
    onSuccess: () => { invalidate(); toast.success("Webhook removido."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const rotate = useMutation({
    mutationFn: rotateSecret,
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao rotacionar segredo."),
  });

  const dispatch = useMutation({
    mutationFn: triggerDispatcher,
    onSuccess: () => { invalidate(); toast.success("Disparador executado."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao disparar."),
  });

  const replay = useMutation({
    mutationFn: replayDelivery,
    onSuccess: () => { invalidate(); toast.success("Entrega reenfileirada."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reenfileirar."),
  });

  return { create, update, remove, rotate, dispatch, replay };
}
