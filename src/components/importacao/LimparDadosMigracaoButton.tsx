import { useState } from "react";
import { Button } from "@/components/ui/button";
import { limparDadosMigracao } from "@/services/importacao.service";
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

type RpcErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const rpcError = err as RpcErrorLike;
    return rpcError.details || rpcError.message || rpcError.hint || "Erro desconhecido ao limpar dados.";
  }
  return "Erro desconhecido ao limpar dados.";
};

/**
 * Botão admin para limpar os dados da carga inicial do ERP.
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
      const r = await limparDadosMigracao();
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
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Limpar dados de migração
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar dados da carga inicial
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação <strong>apaga permanentemente</strong> os dados de migração, staging,
                financeiro, estoque, vendas, compras e os cadastros usados na carga inicial.
              </p>
              <p className="text-xs">
                <strong>Preserva:</strong> dados de acesso e configurações estruturais fora do escopo
                da carga inicial.
              </p>
              <div className="space-y-1 pt-2">
                <Label htmlFor="confirma">
                  Digite <strong>LIMPAR</strong> para confirmar:
                </Label>
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
            <AlertDialogCancel asChild>
              <Button variant="outline" disabled={busy}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  void handleConfirm();
                }}
                disabled={busy || typed.trim().toUpperCase() !== "LIMPAR"}
              >
                {busy ? "Limpando..." : "Confirmar limpeza"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}