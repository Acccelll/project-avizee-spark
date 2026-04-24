import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (!res.ok) return setState("invalid");
        if (data.valid === false && data.reason === "already_unsubscribed") return setState("already");
        setState("valid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      setState(data?.success ? "done" : "already");
    } catch { setState("error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">Cancelar inscrição</h1>
        {state === "loading" && <p className="text-muted-foreground">Validando link...</p>}
        {state === "invalid" && <p className="text-destructive">Link inválido ou expirado.</p>}
        {state === "error" && <p className="text-destructive">Não foi possível processar a solicitação. Tente novamente mais tarde.</p>}
        {state === "already" && <p className="text-muted-foreground">Este e-mail já foi descadastrado.</p>}
        {state === "done" && <p className="text-foreground">Pronto! Você não receberá mais e-mails desta lista.</p>}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground">Confirme para parar de receber e-mails neste endereço.</p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? "Processando..." : "Confirmar cancelamento"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}