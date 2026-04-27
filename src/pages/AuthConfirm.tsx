import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

/**
 * Página intersticial de confirmação de e-mail (`/auth/confirm`).
 *
 * Por que ela existe:
 * Os links enviados por e-mail (recovery, signup, magic link, invite, email change)
 * carregam um *one-time token*. Se o link aponta diretamente para o endpoint do
 * Supabase (`/verify`), qualquer scanner de e-mail (Outlook Safe Links, Gmail,
 * antivírus corporativo) pode fazer um GET preventivo e **consumir o token antes
 * do usuário clicar** — fazendo o link parecer "expirado" mesmo dentro do prazo.
 *
 * Para resolver, o `auth-email-hook` agora envia o link apontando para esta
 * rota com `token_hash`, `type` e `redirect_to` na query string. A confirmação
 * via `supabase.auth.verifyOtp` só dispara após **clique humano explícito** no
 * botão "Confirmar". Scanners apenas renderizam HTML e não acionam o token.
 */

type RecoveryType =
  | "recovery"
  | "signup"
  | "magiclink"
  | "invite"
  | "email"
  | "email_change";

const COPY: Record<string, { title: string; desc: string; cta: string }> = {
  recovery: {
    title: "Confirmar redefinição de senha",
    desc: "Para sua segurança, confirme abaixo que foi você quem solicitou a redefinição de senha. Em seguida você poderá criar uma nova senha.",
    cta: "Confirmar e redefinir senha",
  },
  signup: {
    title: "Confirmar e-mail de cadastro",
    desc: "Confirme abaixo para validar seu e-mail e ativar sua conta.",
    cta: "Confirmar e-mail",
  },
  magiclink: {
    title: "Entrar com link mágico",
    desc: "Confirme abaixo para acessar sua conta.",
    cta: "Entrar agora",
  },
  invite: {
    title: "Aceitar convite",
    desc: "Confirme abaixo para aceitar o convite e definir sua senha.",
    cta: "Aceitar convite",
  },
  email_change: {
    title: "Confirmar novo e-mail",
    desc: "Confirme abaixo a alteração do seu e-mail de acesso.",
    cta: "Confirmar novo e-mail",
  },
  email: {
    title: "Confirmar novo e-mail",
    desc: "Confirme abaixo a alteração do seu e-mail de acesso.",
    cta: "Confirmar novo e-mail",
  },
};

export default function AuthConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const branding = useBranding();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = params.get("token_hash");
  const rawToken = params.get("token");
  const emailParam = params.get("email");
  const type = (params.get("type") || "recovery") as RecoveryType;
  const redirectTo = params.get("redirect_to") || "/";

  const copy = useMemo(() => COPY[type] ?? COPY.recovery, [type]);

  // Aceitamos `token_hash` (formato moderno) ou o par `token` + `email`
  // (formato legado). Sem nenhum dos dois, o link é inválido.
  useEffect(() => {
    if (!tokenHash && !(rawToken && emailParam)) {
      setError("Link de confirmação inválido ou incompleto.");
    }
  }, [tokenHash, rawToken, emailParam]);

  const handleConfirm = async () => {
    if (submitting) return;
    if (!tokenHash && !(rawToken && emailParam)) return;
    setSubmitting(true);
    setError(null);
    try {
      const verifyArgs = tokenHash
        ? {
            token_hash: tokenHash,
            type: type as "recovery" | "signup" | "magiclink" | "invite" | "email_change" | "email",
          }
        : {
            token: rawToken!,
            email: emailParam!,
            type: type as "recovery" | "signup" | "magiclink" | "invite" | "email_change" | "email",
          };
      const { error: verifyError } = await supabase.auth.verifyOtp(verifyArgs as any);
      if (verifyError) {
        const raw = (verifyError.message || "").toLowerCase();
        if (raw.includes("expired") || raw.includes("invalid") || raw.includes("not found")) {
          setError(
            "Este link de confirmação já foi usado ou expirou. Solicite um novo para continuar."
          );
        } else {
          setError(verifyError.message || "Não foi possível confirmar o link.");
        }
        setSubmitting(false);
        return;
      }
      // Sessão estabelecida. Agora seguimos para o destino real.
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error("[auth-confirm]", err);
      setError("Erro inesperado ao confirmar. Tente novamente.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src={branding.logoUrl}
            alt={branding.marcaTexto || "ERP"}
            className="h-14 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{copy.title}</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-snug">{copy.desc}</p>
        </div>

        <div className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
          {error ? (
            <>
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs leading-snug ml-1">
                  {error}
                </AlertDescription>
              </Alert>
              {type === "recovery" ? (
                <Link to="/forgot-password">
                  <Button variant="outline" className="w-full gap-2">
                    Solicitar novo link
                  </Button>
                </Link>
              ) : null}
              <Link
                to="/login"
                className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar ao Login
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success-foreground">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-success" />
                <p className="leading-snug">
                  <span className="font-semibold">Confirmação humana exigida:</span>{" "}
                  esta etapa garante que apenas você (e não filtros automáticos do
                  seu provedor de e-mail) consuma o link enviado.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={(!tokenHash && !(rawToken && emailParam)) || submitting}
                className="w-full gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> {copy.cta}
                  </>
                )}
              </Button>
              <Link
                to="/login"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" /> Cancelar
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}