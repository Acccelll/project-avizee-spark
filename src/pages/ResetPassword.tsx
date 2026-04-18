import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck } from "lucide-react";
import logoAvizee from "@/assets/logoavizee.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    // Valida via getSession(): o Supabase consome o hash automaticamente,
    // então a presença de `window.location.hash` não é confiável após reload.
    // Aceita tanto sessão de recovery quanto qualquer sessão ativa (fluxo de
    // troca voluntária de senha).
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const hashHasRecovery = window.location.hash.includes("type=recovery");
      if (!data.session && !hashHasRecovery) {
        toast.error("Link de recuperação inválido ou expirado");
        navigate("/login");
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const validate = () => {
    const e: typeof errors = {};
    if (!password) e.password = "Informe a nova senha";
    else if (password.length < 6) e.password = "Mínimo 6 caracteres";
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
      toast.error("Erro ao atualizar senha. Tente novamente.");
    } else {
      setSuccess(true);
      toast.success("Senha alterada com sucesso. Faça login com a nova senha.");
    }
    setLoading(false);
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
          <Button onClick={() => navigate("/")} className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Acessar o sistema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logoAvizee} alt="AviZee ERP" className="h-14 mx-auto mb-4" />
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
                placeholder="Mínimo 6 caracteres"
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
