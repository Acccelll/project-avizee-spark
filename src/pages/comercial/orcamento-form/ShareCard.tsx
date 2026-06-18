import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { formatDate } from "@/lib/format";

interface ShareCardProps {
  id?: string | null;
  dataOrcamento?: string | null;
  validade?: string | null;
  clienteEmail?: string | null;
  onOpenMailModal: () => void;
}

export function ShareCard({ id, dataOrcamento, validade, clienteEmail, onOpenMailModal }: ShareCardProps) {
  const copyPublicLink = async () => {
    if (!id) return;
    try {
      const { ensurePublicToken } = await import('@/services/orcamentos.service');
      const token = await ensurePublicToken(id);
      const link = `${window.location.origin}/orcamento-publico?token=${token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link público copiado!');
    } catch (err: unknown) {
      notifyError(err);
    }
  };

  const openPublicLink = async () => {
    if (!id) return;
    try {
      const { ensurePublicToken } = await import('@/services/orcamentos.service');
      const token = await ensurePublicToken(id);
      window.open(`${window.location.origin}/orcamento-publico?token=${token}`, '_blank');
    } catch (err: unknown) {
      notifyError(err);
    }
  };

  return (
    <div className="mt-4 rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Compartilhamento da proposta</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyPublicLink}>
          Copiar link público
        </Button>
        <Button variant="outline" size="sm" onClick={openPublicLink}>
          Abrir link público
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenMailModal}
          disabled={!clienteEmail}
          title={!clienteEmail ? "Cliente sem e-mail cadastrado" : undefined}
        >
          Reenviar por e-mail
        </Button>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p>• Criado em: <span className="text-foreground font-medium">{formatDate(dataOrcamento)}</span></p>
        {validade && (
          <p>• Validade: <span className={`font-medium ${new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive" : "text-foreground"}`}>{formatDate(validade)}</span></p>
        )}
      </div>
    </div>
  );
}