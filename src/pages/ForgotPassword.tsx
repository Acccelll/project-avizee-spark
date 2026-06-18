import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, Send, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const getResetPasswordRedirectUrl = () => {
  const configuredAppUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  const baseUrl = configuredAppUrl && /^https?:\/\//.test(configuredAppUrl)
    ? configuredAppUrl
    : window.location.origin;

  return new URL("/reset-password", baseUrl).toString();
};

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);
  const branding = useBranding();

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
      return;
    }
    cooldownTimer.current = window.setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getResetPasswordRedirectUrl(),
    });
    if (err) {
      toast.error("Não foi possível reenviar. Tente novamente em instantes.");
    } else {
      toast.success("Link de recuperação reenviado.");
      setResendCooldown(60);
    }
    setResending(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!email.trim()) { setError("Informe seu e-mail"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido"); return; }
    
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getResetPasswordRedirectUrl(),
    });
    if (err) {
      logger.error('[forgot-password]', err);
      const raw = (err.message || "").toLowerCase();
      if (raw.includes("rate") || raw.includes("too many")) {
        setServerError("Muitas tentativas. Aguarde alguns minutos antes de solicitar novamente.");
      } else {
        // Mensagem neutra (anti-enumeration): mesmo em erro técnico, mostramos a tela de
        // sucesso depois — só erros de rate/conexão sobem para o usuário.
        setSent(true);
        setResendCooldown(60);
      }
    } else {
      // Anti-enumeration: confirmamos envio mesmo se o e-mail não existir.
      setSent(true);
      setResendCooldown(60);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <img src={branding.logoUrl} alt={branding.marcaTexto || "ERP"} className="h-14 mx-auto mb-4 object-contain" />
          </div>
          <div className="bg-card border rounded-xl p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-xl font-bold mb-2">Verifique seu e-mail</h2>
            <p className="text-muted-foreground text-sm mb-2">
              Se <strong className="text-foreground">{email}</strong> estiver cadastrado, você receberá um link de recuperação em instantes.
            </p>
            <p className="text-muted-foreground text-xs mb-6">
              Verifique também a pasta de spam. O link tem validade limitada.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="gap-2 w-full"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
              >
                <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                {resendCooldown > 0
                  ? `Reenviar em ${resendCooldown}s`
                  : resending ? "Reenviando..." : "Reenviar link de recuperação"}
              </Button>
              <Link to="/login">
                <Button variant="ghost" size="lg" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar ao Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={branding.logoUrl} alt={branding.marcaTexto || "ERP"} className="h-14 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Recuperar Senha</h1>
          <p className="text-muted-foreground text-sm mt-1">Informe seu e-mail para receber o link de redefinição</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
          {serverError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-snug ml-1">{serverError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); setServerError(null); }}
                className={`pl-9 h-11 ${error ? "border-destructive" : ""}`}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
            <Send className="w-4 h-4" />
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>

          <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-3 w-3" /> Voltar ao Login
          </Link>
        </form>
      </div>
    </div>
  );
}
