import { supabase } from "@/integrations/supabase/client";
import type { SuporteEvento, SuporteVisibilidade } from "./types";

/**
 * Timeline do chamado (comentários + eventos de sistema, unificados —
 * ver especificação Parte III, item III.9). RLS filtra `visibilidade` para
 * não-admin; o próprio SELECT já devolve só o que o usuário pode ver.
 */
export async function listEventos(chamadoId: string): Promise<SuporteEvento[]> {
  const { data, error } = await supabase
    .from("suporte_eventos")
    .select("*")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Registra comentário público ou nota interna via RPC
 * `registrar_comentario_suporte` — não é um INSERT direto na tabela.
 * A própria função valida que só admin pode usar `visibilidade='interno'`.
 */
export async function registrarComentario(
  chamadoId: string,
  mensagem: string,
  visibilidade: SuporteVisibilidade = "publico",
): Promise<string> {
  const { data, error } = await supabase.rpc("registrar_comentario_suporte", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
    p_visibilidade: visibilidade,
  });
  if (error) throw error;
  return data as string;
}
