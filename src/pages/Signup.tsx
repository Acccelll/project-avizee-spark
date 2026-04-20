import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Mail, Lock, User, CheckCircle2, ShieldAlert } from "lucide-react";
import logoAvizee from "@/assets/logoavizee.png";
import { ADMIN_EMAIL, INVITE_ONLY } from "@/constants/app";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; password?: string }>({});

  const blockedByInvite = useMemo(
    () => INVITE_ONLY && inviteToken.length === 0,
    [inviteToken],
  );

  const validate = () => {
    const e: typeof errors = {};
    if (!nome.trim()) e.nome = "Informe seu nome";
    if (!email.trim()) e.email = "Informe seu e-mail";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    if (!password) e.password = "Informe uma senha";
    else if (password.length < 6) e.password = "Mínimo 6 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedByInvite) {
      toast.error("Cadastro disponível apenas por convite.");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nome: nome.trim(), invite_token: inviteToken || undefined },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('[signup]', error);
      toast.error("Erro ao criar conta. Tente novamente.");
    } else {
      setSuccess(true);
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-2">Verifique seu e-mail</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
            Clique no link para ativar sua conta.
          </p>
          <Link to="/login">
            <Button variant="outline" className="gap-2">Voltar ao Login</Button>
          </Link>
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
          <img src={logoAvizee} alt="AviZee ERP" className="h-16 mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Criar Conta</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre-se no AviZee ERP</p>
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
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                className={`pl-9 pr-10 ${errors.password ? "border-destructive" : ""}`}
                autoComplete="new-password"
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
            {password.length > 0 && (
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= level * 3
                        ? level <= 2 ? "bg-warning" : "bg-success"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
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
