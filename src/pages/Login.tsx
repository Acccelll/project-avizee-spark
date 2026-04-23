import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Zap, Loader2, LogIn, AlertCircle, HelpCircle } from "lucide-react";
import { CapsLockIndicator } from "@/components/auth/CapsLockIndicator";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { ADMIN_EMAIL } from "@/constants/app";
import { useBranding } from "@/hooks/useBranding";

const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL as string | undefined;
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD as string | undefined;
// Dev-only quick-login button: tree-shaken out of production builds via import.meta.env.DEV.
const showDevButton = import.meta.env.DEV && Boolean(DEV_EMAIL && DEV_PASSWORD);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const branding = useBranding();

  // Destino pós-login: prioriza state.from (deep-link via guards), depois ?next=, fallback "/".
  type LocationState = { from?: { pathname?: string; search?: string; hash?: string } } | null;
  const fromState = location.state as LocationState;
  const fromPath = fromState?.from?.pathname
    ? `${fromState.from.pathname}${fromState.from.search ?? ""}${fromState.from.hash ?? ""}`
    : null;
  const nextParam = searchParams.get("next");
  const redirectTo = fromPath || (nextParam && nextParam.startsWith("/") ? nextParam : "/");

  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, user, navigate, redirectTo]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = "Informe seu e-mail";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "E-mail inválido";
    if (!password) newErrors.password = "Informe sua senha";
    else if (password.length < 6) newErrors.password = "Mínimo 6 caracteres";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    if (!supabase) {
      setServerError("Serviço de autenticação não disponível. Contate o administrador do sistema.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const raw = (error.message || "").toLowerCase();
        const status = (error as { status?: number }).status;
        let msg = error.message;
        if (raw.includes("invalid login credentials")) {
          msg = "E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.";
        } else if (raw.includes("email not confirmed")) {
          msg = "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.";
        } else if (status === 429 || raw.includes("rate") || raw.includes("too many")) {
          msg = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
        } else if (raw.includes("network") || raw.includes("fetch")) {
          msg = "Erro de conexão com o servidor. Verifique sua internet e tente novamente.";
        }
        setServerError(msg);
      } else {
        // Sem toast: o redirecionamento já é a confirmação visual.
        navigate(redirectTo, { replace: true });
      }
    } catch {
      setServerError("Erro de conexão com o servidor. Verifique sua internet e tente novamente.");
    }
    setLoading(false);
  };

  if (authLoading) {
    // Splash unificado com branding — coerência com ProtectedRoute/AdminRoute.
    return <AuthLoadingScreen mode="session" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <img
            src={branding.logoUrl}
            alt={branding.marcaTexto || "ERP"}
            width={211}
            height={64}
            fetchPriority="high"
            decoding="async"
            loading="eager"
            className="h-16 mx-auto mb-5 drop-shadow-sm object-contain"
          />
          {(branding.marcaTexto || branding.marcaSubtitulo) && (
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {branding.marcaTexto}
              {branding.marcaSubtitulo && (
                <span className="ml-2 text-base font-medium text-muted-foreground align-middle">{branding.marcaSubtitulo}</span>
              )}
            </h1>
          )}
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            Acesso restrito ao sistema corporativo
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleLogin}
          className="bg-card border border-border/70 rounded-2xl p-8 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)] border-t-2 border-t-primary/80"
          noValidate
        >
          {/* Server error — alert inline persistente */}
          {serverError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-snug ml-1">{serverError}</AlertDescription>
            </Alert>
          )}

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="seu@empresa.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); setServerError(null); }}
                className={`pl-9 h-11 ${errors.email ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                autoComplete="email"
                autoFocus
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })); setServerError(null); }}
                className={`pl-9 pr-11 h-11 ${errors.password ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                tabIndex={0}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.password}
              </p>
            )}
            <CapsLockIndicator />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 mt-1"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar
              </>
            )}
          </Button>

          {/* Esqueceu a senha — abaixo do CTA principal, mais visível */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline underline-offset-4 font-medium transition-colors inline-flex items-center gap-1"
            >
              Esqueceu sua senha?
            </Link>
          </div>

          {showDevButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => { setEmail(DEV_EMAIL!); setPassword(DEV_PASSWORD!); setErrors({}); setServerError(null); }}
            >
              <Zap className="w-3.5 h-3.5" />
              Preencher como Dev
            </Button>
          )}
        </form>

        {/* Footer — contato com administrador */}
        <div className="mt-6 text-center space-y-2">
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Solicitação de acesso ao AviZee ERP")}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Precisa de acesso? Fale com o administrador
          </a>
          <p className="text-xs text-muted-foreground/60 select-none">
            © {new Date().getFullYear()} AviZee ERP — Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
