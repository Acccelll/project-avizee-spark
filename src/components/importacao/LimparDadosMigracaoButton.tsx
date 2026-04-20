import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCleaned?: () => void;
}

/**
 * Botão admin para limpar TODOS os dados operacionais de migração + financeiro.
 * Exige digitação literal "LIMPAR" para confirmar.
 */
export function LimparDadosMigracaoButton({ onCleaned }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (typed.trim().toUpperCase() !== "LIMPAR") {
      toast.error('Digite "LIMPAR" para confirmar.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("limpar_dados_migracao", { p_confirmar: true });
      if (error) throw error;
      const r = data as { ok?: boolean; erro?: string; apagados?: Record<string, number> };
      if (r?.erro) {
        toast.error(r.erro);
        return;
      }
      const total = Object.values(r.apagados ?? {}).reduce((a, b) => a + b, 0);
      toast.success(`Limpeza concluída — ${total.toLocaleString("pt-BR")} registros apagados.`);
      setOpen(false);
      setTyped("");
      onCleaned?.();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 text-rose-700 border-rose-200 hover:bg-rose-50" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Limpar dados de migração
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              Limpar dados operacionais
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação <strong>apaga permanentemente</strong> todos os lotes, logs, staging,
                financeiro (lançamentos, baixas) e movimentos de caixa.
              </p>
              <p className="text-xs">
                <strong>Preserva:</strong> usuários, perfis, configurações, empresa, contas bancárias,
                contas contábeis, clientes, fornecedores, produtos, NFs e estoque.
              </p>
              <div className="space-y-1 pt-2">
                <Label htmlFor="confirma">Digite <strong>LIMPAR</strong> para confirmar:</Label>
                <Input
                  id="confirma"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="LIMPAR"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={busy || typed.trim().toUpperCase() !== "LIMPAR"}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {busy ? "Limpando..." : "Confirmar limpeza"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
