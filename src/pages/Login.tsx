import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Mail, Lock, Zap } from "lucide-react";
import logoAvizee from "@/assets/logoavizee.png";

const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL as string | undefined;
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD as string | undefined;
const showDevButton = Boolean(DEV_EMAIL && DEV_PASSWORD);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate]);

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
    if (!validate()) return;

    if (!supabase) {
      toast.error("Serviço de autenticação não disponível. Contate o administrador do sistema.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const msg = error.message === "Invalid login credentials"
          ? "E-mail ou senha inválidos. Verifique suas credenciais."
          : error.message === "Email not confirmed"
          ? "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada."
          : error.message;
        toast.error(msg);
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/", { replace: true });
      }
    } catch {
      toast.error("Erro de conexão com o servidor. Tente novamente.");
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoAvizee} alt="AviZee ERP" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bem-vindo ao AviZee</h1>
          <p className="text-muted-foreground text-sm mt-1">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                className={`pl-9 ${errors.email ? "border-destructive" : ""}`}
                autoComplete="email"
                autoFocus
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })); }}
                className={`pl-9 pr-10 ${errors.password ? "border-destructive" : ""}`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn className="w-4 h-4" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>

          {showDevButton && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => { setEmail(DEV_EMAIL!); setPassword(DEV_PASSWORD!); setErrors({}); }}
            >
              <Zap className="w-4 h-4" />
              Preencher como Dev
            </Button>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} AviZee ERP — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
