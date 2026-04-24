import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, LogOut } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { CapsLockIndicator } from "@/components/auth/CapsLockIndicator";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordPolicy";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [othersDone, setOthersDone] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const navigate = useNavigate();
  const branding = useBranding();

  useEffect(() => {
    // O hash de recovery pode ser processado antes OU depois do efeito montar.
    // Se depender apenas de um único onAuthStateChange, existe uma janela de corrida:
    // o evento pode disparar antes do listener, getSession() ainda retornar null,
    // e a tela ficar presa em "Validando link...". O usuário então clica de novo no
    // e-mail e o token de uso único passa a aparecer como expirado/inválido.
    let mounted = true;
    let settled = false;
    let recoveryEventSeen = false;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashHasRecovery =
      hashParams.get("type") === "recovery" || hashParams.has("access_token");
    const hashError = hashParams.get("error_description");

    const clearPendingTimers = (timers: Array<number>) => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };

    const finishSuccess = (timers: Array<number>) => {
      if (!mounted || settled) return;
      settled = true;
      clearPendingTimers(timers);
      setCheckingSession(false);
    };

    const finishInvalid = (timers: Array<number>) => {
      if (!mounted || settled) return;
      settled = true;
      clearPendingTimers(timers);
      toast.error("Link de recuperação inválido ou expirado");
      navigate("/login", { replace: true });
    };

    const timers: number[] = [];

    if (hashError) {
      finishInvalid(timers);
      return () => {
        mounted = false;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        recoveryEventSeen = true;
      }
      if (event === "PASSWORD_RECOVERY" || session) {
        finishSuccess(timers);
      }
    });

    const initialAccessToken = supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null);

    const checkSession = async () => {
      const [sessionResult, initialToken] = await Promise.all([
        supabase.auth.getSession(),
        initialAccessToken,
      ]);
      const session = sessionResult.data.session;
      if (!mounted || settled) return;

      if (!session) return;

      if (hashHasRecovery) {
        const currentHash = window.location.hash;
        const hashStillHasRecovery =
          currentHash.includes("type=recovery") || currentHash.includes("access_token");
        const sessionChanged = session.access_token !== initialToken;

        if (!recoveryEventSeen && hashStillHasRecovery && !sessionChanged) {
          return;
        }
      }

      if (session) {
        finishSuccess(timers);
      }
    };

    void checkSession();

    const pollSession = window.setInterval(() => {
      void checkSession();
    }, 250);
    timers.push(pollSession);

    const failSafe = window.setTimeout(() => {
      if (hashHasRecovery) {
        finishInvalid(timers);
        return;
      }

      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          finishSuccess(timers);
        } else {
          finishInvalid(timers);
        }
      });
    }, 5000);
    timers.push(failSafe);

    return () => {
      mounted = false;
      clearPendingTimers(timers);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const validate = () => {
    const e: typeof errors = {};
    const pwd = validatePassword(password);
    if (!pwd.valid) e.password = pwd.error;
    if (password !== confirmPassword) e.confirm = "As senhas não coincidem";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error('[reset-password]', error);
      const raw = (error.message || "").toLowerCase();
      if (raw.includes("pwned") || raw.includes("compromised")) {
        toast.error("Esta senha apareceu em vazamentos conhecidos. Escolha outra.");
      } else if (raw.includes("weak") || raw.includes("short")) {
        toast.error("Senha não atende à política mínima. Use uma senha mais forte.");
      } else if (raw.includes("same") || raw.includes("different")) {
        toast.error("A nova senha precisa ser diferente da senha atual.");
      } else {
        toast.error("Erro ao atualizar senha. Tente novamente.");
      }
    } else {
      setSuccess(true);
      toast.success("Senha alterada com sucesso. Faça login com a nova senha.");
    }
    setLoading(false);
  };

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      console.error('[reset-password] signOut others:', error);
      toast.error("Não foi possível encerrar outras sessões. Tente novamente.");
    } else {
      setOthersDone(true);
      toast.success("Sessões em outros dispositivos foram encerradas.");
    }
    setSigningOutOthers(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Validando link...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-2">Senha atualizada!</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sua senha foi redefinida com sucesso. Você já pode acessar o sistema.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 w-full"
              onClick={handleSignOutOthers}
              disabled={signingOutOthers || othersDone}
            >
              <LogOut className="h-4 w-4" />
              {othersDone
                ? "Outras sessões encerradas ✓"
                : signingOutOthers ? "Encerrando..." : "Encerrar outras sessões"}
            </Button>
            <Button onClick={() => navigate("/")} className="gap-2 w-full">
              <ShieldCheck className="h-4 w-4" /> Acessar o sistema
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-snug">
            Recomendamos encerrar sessões em outros dispositivos como precaução de segurança.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={branding.logoUrl} alt={branding.marcaTexto || "ERP"} className="h-14 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Nova Senha</h1>
          <p className="text-muted-foreground text-sm mt-1">Defina sua nova senha de acesso</p>
        </div>

        {/* Banner de contexto — fluxo seguro */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-success" />
          <p className="leading-snug">
            <span className="font-semibold">Fluxo seguro:</span> você está em uma sessão temporária de redefinição de senha autorizada por e-mail.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres com letras e número"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                className={`pl-9 pr-10 ${errors.password ? "border-destructive" : ""}`}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            <CapsLockIndicator />
            <PasswordStrengthIndicator password={password} confirm={confirmPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                className={`pl-9 ${errors.confirm ? "border-destructive" : ""}`}
                autoComplete="new-password"
              />
            </div>
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Salvando..." : "Redefinir Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
