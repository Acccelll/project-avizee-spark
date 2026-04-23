import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Mail, Lock, User, CheckCircle2, ShieldAlert, AlertCircle, Send } from "lucide-react";
import { ADMIN_EMAIL, INVITE_ONLY } from "@/constants/app";
import { useBranding } from "@/hooks/useBranding";
import { CapsLockIndicator } from "@/components/auth/CapsLockIndicator";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordPolicy";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<{ message: string; suggestLogin?: boolean } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);
  const branding = useBranding();

  const blockedByInvite = useMemo(
    () => INVITE_ONLY && inviteToken.length === 0,
    [inviteToken],
  );

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

  const validate = () => {
    const e: typeof errors = {};
    if (!nome.trim()) e.nome = "Informe seu nome";
    if (!email.trim()) e.email = "Informe seu e-mail";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    const pwd = validatePassword(password);
    if (!pwd.valid) e.password = pwd.error;
    if (password && confirmPassword !== password) e.confirm = "As senhas não coincidem";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (blockedByInvite) {
      toast.error("Cadastro disponível apenas por convite.");
      return;
    }
    if (!validate()) return;
    setLoading(true);

    // Validação server-side do convite (complementa INVITE_ONLY client-side).
    // Se houver token, valida antes de criar a conta — impede bypass via API direta.
    if (inviteToken) {
      try {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke(
          "validate-invite",
          { body: { token: inviteToken, email: email.trim() } },
        );
        if (inviteError || !inviteData?.valid) {
          const reason = inviteData?.reason as string | undefined;
          const map: Record<string, string> = {
            not_found: "Convite inválido. Verifique o link recebido.",
            already_used: "Este convite já foi utilizado.",
            expired: "Este convite expirou. Solicite um novo ao administrador.",
            email_mismatch: "Este convite é para outro e-mail.",
          };
          setServerError({ message: map[reason ?? ""] ?? "Não foi possível validar o convite." });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[signup] invite validation failed", err);
        setServerError({ message: "Não foi possível validar o convite. Tente novamente." });
        setLoading(false);
        return;
      }
    } else if (INVITE_ONLY) {
      setServerError({ message: "Cadastro disponível apenas por convite." });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Envia tanto `nome` (campo nativo do form) quanto `full_name` (chave esperada
        // pelo trigger anterior) — a função handle_new_user lê ambas.
        data: { nome: nome.trim(), full_name: nome.trim(), invite_token: inviteToken || undefined },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('[signup]', error);
      const raw = (error.message || "").toLowerCase();
      if (raw.includes("already registered") || raw.includes("user already") || raw.includes("already exists")) {
        setServerError({
          message: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
          suggestLogin: true,
        });
      } else if (raw.includes("password") && (raw.includes("weak") || raw.includes("pwned") || raw.includes("compromised"))) {
        setServerError({ message: "Senha fraca ou comprometida em vazamentos conhecidos. Use uma senha mais forte." });
      } else if (raw.includes("rate") || raw.includes("too many")) {
        setServerError({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
      } else {
        setServerError({ message: error.message || "Erro ao criar conta. Tente novamente." });
      }
    } else {
      setSuccess(true);
      setResendCooldown(60);
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      // Fire-and-forget: notifica admin sobre novo cadastro pendente.
      // Falha aqui não deve bloquear o fluxo do usuário.
      void supabase.functions
        .invoke("notify-admin-new-signup", { body: { email: email.trim(), nome: nome.trim() } })
        .catch((err) => console.warn("[signup] admin notification failed", err));
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    if (error) {
      console.error('[signup-resend]', error);
      toast.error("Não foi possível reenviar. Tente novamente em instantes.");
    } else {
      toast.success("E-mail de confirmação reenviado.");
      setResendCooldown(60);
    }
    setResending(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-2">Verifique seu e-mail</h2>
          <p className="text-muted-foreground text-sm mb-2">
            Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
            Clique no link para ativar sua conta.
          </p>
          <p className="text-muted-foreground text-xs mb-6">
            Não recebeu? Verifique a pasta de spam.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
            >
              <Send className="h-4 w-4" />
              {resendCooldown > 0
                ? `Reenviar em ${resendCooldown}s`
                : resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </Button>
            <Link to="/login">
              <Button variant="ghost" className="w-full">Voltar ao Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (blockedByInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-7 w-7 text-warning" />
          </div>
          <h2 className="text-xl font-bold mb-2">Cadastro restrito</h2>
          <p className="text-muted-foreground text-sm mb-6">
            O cadastro está disponível apenas por convite. Entre em contato com o administrador
            do sistema para solicitar acesso.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Solicitação de convite — AviZee ERP")}`}
              className="text-sm text-primary hover:underline"
            >
              {ADMIN_EMAIL}
            </a>
            <Link to="/login">
              <Button variant="outline" className="gap-2 w-full">Voltar ao Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={branding.logoUrl}
            alt={branding.marcaTexto || "ERP"}
            width={211}
            height={64}
            fetchPriority="high"
            decoding="async"
            loading="eager"
            className="h-16 mx-auto mb-5 object-contain"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Criar Conta</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre-se no sistema</p>
        </div>

        {INVITE_ONLY && inviteToken && (
          <Alert className="mb-4">
            <AlertDescription className="text-xs">
              Convite reconhecido. Continue para criar sua conta.
            </AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={handleSignup}
          className="bg-card border border-border/70 rounded-2xl p-8 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)] border-t-2 border-t-primary/80"
          noValidate
        >
          {serverError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-snug ml-1">
                {serverError.message}
                {serverError.suggestLogin && (
                  <>
                    {" "}
                    <Link to="/login" className="font-medium underline underline-offset-2">
                      Ir para login
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="nome"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErrors((p) => ({ ...p, nome: undefined })); }}
                className={`pl-9 ${errors.nome ? "border-destructive" : ""}`}
                autoComplete="name"
                autoFocus
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "nome-error" : undefined}
              />
            </div>
            {errors.nome && (
              <p id="nome-error" role="alert" className="text-xs text-destructive">
                {errors.nome}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                className={`pl-9 ${errors.email ? "border-destructive" : ""}`}
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres com letras e número"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); setServerError(null); }}
                className={`pl-9 pr-10 ${errors.password ? "border-destructive" : ""}`}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={0}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="text-xs text-destructive">
                {errors.password}
              </p>
            )}
            <CapsLockIndicator />
            <PasswordStrengthIndicator password={password} confirm={confirmPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                className={`pl-9 ${errors.confirm ? "border-destructive" : ""}`}
                autoComplete="new-password"
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "confirm-error" : undefined}
              />
            </div>
            {errors.confirm && (
              <p id="confirm-error" role="alert" className="text-xs text-destructive">
                {errors.confirm}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <UserPlus className="w-4 h-4" />
            {loading ? "Criando..." : "Criar Conta"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} AviZee ERP
        </p>
      </div>
    </div>
  );
}
