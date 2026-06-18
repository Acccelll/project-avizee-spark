/**
 * useMfa — wrapper sobre `supabase.auth.mfa` para o card de Segurança.
 *
 * Política: opcional para todos. O Supabase já dispara automaticamente o
 * desafio `aal2` no login quando o usuário tem ao menos um fator verificado;
 * a rota `/mfa` (MfaChallenge) cuida do prompt.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MfaFactor {
  id: string;
  friendlyName: string;
  status: "verified" | "unverified";
  createdAt: string;
}

export interface EnrollPayload {
  factorId: string;
  qrCode: string; // SVG data URI
  secret: string;
  uri: string;
}

export function useMfa() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error("Falha ao consultar fatores MFA");
      setFactors([]);
    } else {
      const totp = (data?.totp ?? []).map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name || "Autenticador",
        status: f.status as "verified" | "unverified",
        createdAt: f.created_at,
      }));
      setFactors(totp);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enroll = useCallback(async (friendlyName: string): Promise<EnrollPayload | null> => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName || `Autenticador ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error || !data) {
        toast.error(error?.message || "Falha ao iniciar enrolamento");
        return null;
      }
      return {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      };
    } finally {
      setEnrolling(false);
    }
  }, []);

  const verify = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      toast.error(chErr?.message || "Falha ao desafiar fator");
      return false;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) {
      toast.error(error.message || "Código inválido");
      return false;
    }
    toast.success("Autenticador adicionado");
    await refresh();
    return true;
  }, [refresh]);

  const unenroll = useCallback(async (factorId: string): Promise<boolean> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message || "Falha ao remover fator");
      return false;
    }
    toast.success("Autenticador removido");
    await refresh();
    return true;
  }, [refresh]);

  const hasVerified = factors.some((f) => f.status === "verified");

  return { factors, loading, enrolling, hasVerified, refresh, enroll, verify, unenroll };
}