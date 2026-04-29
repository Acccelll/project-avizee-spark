import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, ShieldCheck, ShieldAlert, ShieldX, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  obterCertificadoConfigurado,
  uploadCertificadoA1,
  removerCertificadoA1,
} from "@/services/fiscal/certificado.service";

/**
 * Upload seguro do certificado A1 (.pfx).
 * - Arquivo vai para Storage privado.
 * - Senha vai para Supabase Vault via RPC admin.
 * - Edge function `sefaz-proxy` lê ambos pela action `assinar-e-enviar-vault`.
 */
export function CertificadoUploader() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: cert, isLoading } = useQuery({
    queryKey: ["certificado-digital"],
    queryFn: obterCertificadoConfigurado,
    staleTime: 60_000,
  });

  const handleSubmit = async () => {
    if (!arquivo || !senha) {
      toast.error("Selecione o arquivo .pfx e informe a senha.");
      return;
    }
    setEnviando(true);
    try {
      const info = await uploadCertificadoA1(arquivo, senha);
      toast.success(
        `Certificado salvo. Validade: ${new Date(info.validadeFim).toLocaleDateString("pt-BR")} (${info.diasRestantes} dias)`,
      );
      setArquivo(null);
      setSenha("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["certificado-digital"] });
      qc.invalidateQueries({ queryKey: ["certificado-validade"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar certificado.");
    } finally {
      setEnviando(false);
    }
  };

  const handleRemover = async () => {
    try {
      await removerCertificadoA1();
      toast.success("Certificado removido.");
      qc.invalidateQueries({ queryKey: ["certificado-digital"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  };

  const variantePorDias = (dias: number) => {
    if (dias <= 7) return { label: `Vence em ${dias}d`, cls: "bg-destructive text-destructive-foreground", Icon: ShieldX };
    if (dias <= 30) return { label: `Vence em ${dias}d`, cls: "bg-warning text-warning-foreground", Icon: ShieldAlert };
    return { label: `${dias} dias restantes`, cls: "bg-success text-success-foreground", Icon: ShieldCheck };
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando status do certificado…
        </div>
      ) : cert ? (
        (() => {
          const v = variantePorDias(cert.diasRestantes);
          return (
            <div className="rounded-md border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <v.Icon className="h-4 w-4" />
                  <strong className="text-sm">{cert.razaoSocial || "Certificado configurado"}</strong>
                </div>
                <Badge className={v.cls}>{v.label}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <dt>CNPJ</dt><dd className="text-foreground font-mono">{cert.cnpj || "—"}</dd>
                <dt>Validade</dt>
                <dd className="text-foreground">
                  {cert.validadeInicio ? new Date(cert.validadeInicio).toLocaleDateString("pt-BR") : "—"} → {new Date(cert.validadeFim).toLocaleDateString("pt-BR")}
                </dd>
              </dl>
              <div className="flex justify-end pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover certificado
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover certificado digital?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A emissão de NF-e será bloqueada até que um novo certificado seja configurado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRemover}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          Nenhum certificado configurado. A emissão de NF-e ficará bloqueada até o upload.
        </div>
      )}

      <div className="rounded-md border p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {cert ? "Substituir certificado" : "Enviar certificado A1 (.pfx)"}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cert-file">Arquivo .pfx / .p12</Label>
            <Input
              id="cert-file"
              ref={fileRef}
              type="file"
              accept=".pfx,.p12,application/x-pkcs12"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              disabled={enviando}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-senha">Senha do certificado</Label>
            <Input
              id="cert-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              autoComplete="new-password"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O arquivo é gravado em armazenamento privado e a senha vai para o cofre criptografado.
          Nem o arquivo nem a senha trafegam pelo navegador depois deste envio.
        </p>
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={enviando || !arquivo || !senha}>
            {enviando && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {cert ? "Substituir" : "Salvar certificado"}
          </Button>
        </div>
      </div>
    </div>
  );
}
