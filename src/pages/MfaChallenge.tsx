/**
 * MfaChallenge — pede o código TOTP quando o usuário possui fator MFA ativo.
 *
 * Fluxo:
 *   - Após `signInWithPassword`, Login consulta AAL. Se nextLevel = aal2,
 *     redireciona para `/mfa` antes de liberar a aplicação.
 *   - Aqui pegamos o primeiro fator verificado, criamos um challenge e
 *     validamos o código. Em sucesso, navegamos para `redirectTo`.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck } from "lucide-react";

export default function MfaChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => {
    const state = location.state as { redirectTo?: string } | null;
    return state?.redirectTo || "/";
  }, [location.state]);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.totp?.length) {
        navigate(redirectTo, { replace: true });
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified") ?? data.totp[0];
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (chErr || !ch) {
        setError(chErr?.message || "Falha ao iniciar desafio MFA");
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setChallengeId(ch.id);
      setLoading(false);
    })();
  }, [navigate, redirectTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId || code.length !== 6) return;
    setError(null);
    setVerifying(true);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    setVerifying(false);
    if (error) {
      setError(error.message || "Código inválido");
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  const cancel = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Verificação em duas etapas</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Informe o código de 6 dígitos do seu aplicativo autenticador para concluir o login.
        </p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={cancel}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={code.length !== 6 || verifying}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}