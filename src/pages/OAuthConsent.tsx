import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

/**
 * Tela de consentimento OAuth (`/oauth/consent`).
 *
 * O Supabase Auth atua como servidor OAuth 2.1 para clientes externos — em
 * especial o conector MCP do ERP usado pelo Claude. Quando um cliente pede
 * acesso, o Supabase redireciona para cá com `authorization_id`. O usuário,
 * logado no ERP, vê quem está pedindo acesso e decide. A aprovação emite um
 * token que age COMO ESTE USUÁRIO: RLS e permissões do ERP continuam valendo.
 */

interface AuthorizationDetails {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  scope?: string;
  client?: { name?: string; client_name?: string; uri?: string; client_uri?: string };
}

export default function OAuthConsent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const { user, loading: authLoading } = useAuth();

  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!authorizationId) {
      setError("Pedido de autorização inválido: falta o identificador.");
      setLoading(false);
      return;
    }
    if (!user) {
      const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (err || !data) {
        logger.warn("[oauth-consent] detalhes indisponíveis", err);
        setError("Este pedido de autorização expirou ou não é válido. Inicie a conexão novamente.");
      } else {
        const d = data as AuthorizationDetails;
        // Consentimento já concedido antes: o Supabase devolve só o redirect.
        if (!d.authorization_id && d.redirect_url) {
          window.location.assign(d.redirect_url);
          return;
        }
        setDetails(d);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authorizationId, user, navigate]);

  async function decide(decision: "approve" | "deny") {
    if (!authorizationId) return;
    setDeciding(decision);
    const result =
      decision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (result.error || !result.data?.redirect_url) {
      setError(result.error?.message ?? "Não foi possível registrar sua decisão.");
      setDeciding(null);
      return;
    }
    window.location.assign(result.data.redirect_url);
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "Aplicativo externo";
  const scopes = (details?.scope ?? "").split(" ").filter(Boolean);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>Autorizar acesso ao ERP</CardTitle>
          <CardDescription>
            Confira quem está pedindo acesso antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || authLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando pedido…
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : details ? (
            <>
              <p className="text-sm">
                <strong>{clientName}</strong> quer acessar o ERP AviZee <strong>em seu nome</strong>
                {user?.email ? <> ({user.email})</> : null}.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Ele poderá fazer apenas o que o seu usuário já pode fazer no ERP.</li>
                <li>
                  No conector de matérias: consultar, criar, aprovar e publicar matérias no site,
                  conforme as suas permissões.
                </li>
                <li>Você pode revogar o acesso a qualquer momento.</li>
              </ul>
              {scopes.length > 0 && (
                <p className="text-xs text-muted-foreground">Escopos solicitados: {scopes.join(", ")}</p>
              )}
              {details.redirect_uri && (
                <p className="break-all text-xs text-muted-foreground">
                  Retorno para: {details.redirect_uri}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  className="sm:flex-1"
                  onClick={() => decide("approve")}
                  disabled={deciding !== null}
                >
                  {deciding === "approve" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Permitir
                </Button>
                <Button
                  className="sm:flex-1"
                  variant="outline"
                  onClick={() => decide("deny")}
                  disabled={deciding !== null}
                >
                  Recusar
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
