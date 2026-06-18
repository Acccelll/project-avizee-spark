/**
 * Drawer/Dialog de enrolamento TOTP. Mostra QR code + segredo manual
 * e valida o primeiro código de 6 dígitos para concluir.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMfa } from "@/pages/configuracoes/hooks/useMfa";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MfaEnrollDialog({ open, onOpenChange }: Props) {
  const mfa = useMfa();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setFactorId(null); setQr(null); setSecret(null); setCode(""); setVerifying(false);
      return;
    }
    void mfa.enroll("Autenticador").then((res) => {
      if (res) { setFactorId(res.factorId); setQr(res.qrCode); setSecret(res.secret); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    const ok = await mfa.verify(factorId, code);
    setVerifying(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar autenticador (TOTP)</DialogTitle>
          <DialogDescription>
            Escaneie o QR code com Google Authenticator, 1Password ou similar, depois informe o código gerado.
          </DialogDescription>
        </DialogHeader>
        {!qr ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center rounded-md border bg-white p-3">
              <img src={qr} alt="QR code MFA" className="h-44 w-44" />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <Label className="text-xs">Código manual</Label>
              <code className="block break-all font-mono text-[11px] mt-1">{secret}</code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verifying}>Cancelar</Button>
          <Button onClick={handleVerify} disabled={!factorId || code.length !== 6 || verifying}>
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}