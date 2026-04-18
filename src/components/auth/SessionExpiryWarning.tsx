/**
 * `SessionExpiryWarning` — monitora `session.expires_at` e:
 *  - 5 min antes da expiração: toast persistente com ação "Renovar sessão"
 *  - Após expirar: dialog bloqueante "Sessão expirada"
 *
 * Renova via `supabase.auth.refreshSession()`. Em caso de falha,
 * encaminha para logout (que redireciona para /login).
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const WARN_BEFORE_MS = 5 * 60 * 1000; // 5 min
const TOAST_ID = "session-expiry";

export function SessionExpiryWarning() {
  const { session, signOut } = useAuth();
  const [expired, setExpired] = useState(false);
  const warnTimerRef = useRef<number | null>(null);
  const expireTimerRef = useRef<number | null>(null);
  const lastWarnedFor = useRef<number | null>(null);

  useEffect(() => {
    // Limpa timers anteriores
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    if (expireTimerRef.current) window.clearTimeout(expireTimerRef.current);
    toast.dismiss(TOAST_ID);

    if (!session?.expires_at) {
      setExpired(false);
      return;
    }

    const expiresAtMs = session.expires_at * 1000;
    const now = Date.now();
    const msUntilExpire = expiresAtMs - now;
    const msUntilWarn = msUntilExpire - WARN_BEFORE_MS;

    const triggerWarn = () => {
      if (lastWarnedFor.current === expiresAtMs) return;
      lastWarnedFor.current = expiresAtMs;
      toast.warning("Sua sessão expira em breve", {
        id: TOAST_ID,
        description: "Renove para continuar trabalhando sem perder dados.",
        duration: Infinity,
        icon: <Clock className="h-4 w-4" />,
        action: {
          label: "Renovar sessão",
          onClick: async () => {
            const { error } = await supabase.auth.refreshSession();
            if (error) {
              toast.error("Não foi possível renovar a sessão. Faça login novamente.");
              await signOut();
            } else {
              toast.success("Sessão renovada com sucesso");
            }
          },
        },
      });
    };

    if (msUntilWarn <= 0 && msUntilExpire > 0) {
      triggerWarn();
    } else if (msUntilWarn > 0) {
      warnTimerRef.current = window.setTimeout(triggerWarn, msUntilWarn);
    }

    if (msUntilExpire > 0) {
      expireTimerRef.current = window.setTimeout(() => {
        toast.dismiss(TOAST_ID);
        setExpired(true);
      }, msUntilExpire);
    } else {
      setExpired(true);
    }

    return () => {
      if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
      if (expireTimerRef.current) window.clearTimeout(expireTimerRef.current);
    };
  }, [session?.expires_at, signOut]);

  return (
    <Dialog open={expired} onOpenChange={() => { /* bloqueante */ }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Sessão expirada</DialogTitle>
          <DialogDescription>
            Por segurança, sua sessão foi encerrada. Faça login novamente para continuar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => signOut()} className="w-full sm:w-auto">
            Ir para o login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
