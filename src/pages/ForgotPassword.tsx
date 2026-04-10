import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, Send, CheckCircle2 } from "lucide-react";
import logoAvizee from "@/assets/logoavizee.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Informe seu e-mail"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido"); return; }
    
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { console.error('[forgot-password]', err); toast.error("Erro ao enviar e-mail de recuperação. Tente novamente."); }
    else setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-2">E-mail enviado</h2>
          <p className="text-muted-foreground text-sm mb-2">
            Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>.
          </p>
          <p className="text-muted-foreground text-xs mb-6">
            Se não encontrar, verifique a pasta de spam. O link expira em 1 hora.
          </p>
          <Link to="/login"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao Login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoAvizee} alt="AviZee ERP" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Recuperar Senha</h1>
          <p className="text-muted-foreground text-sm mt-1">Informe seu e-mail para receber o link de redefinição</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className={`pl-9 ${error ? "border-destructive" : ""}`}
                autoComplete="email"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
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
